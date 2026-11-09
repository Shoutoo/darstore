const { Resend } = require('resend');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.reloadConfig();
  }

  reloadConfig() {
    if (process.env.NODE_ENV === 'test') {
      this.fromEmail = "Dar'sstore <support@darstore.com>";
      this.resend = null;
      this.transporter = null;
      this.preferSmtp = false;
      return;
    }

    this.emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();
    this.resendKey = (process.env.RESEND_API_KEY || '').trim() || null;

    // SMTP Config (e.g. Gmail App Password)
    this.smtpUser = (process.env.EMAIL_USER || '').trim() || null;
    this.smtpPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : null;
    this.smtpHost = process.env.SMTP_HOST || (this.smtpUser && this.smtpUser.includes('@gmail.com') ? 'smtp.gmail.com' : null);
    this.smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

    // Prioritize SMTP whenever EMAIL_USER & EMAIL_PASS exist (unless explicitly forced to 'resend')
    this.preferSmtp = (this.emailProvider === 'smtp') || Boolean(this.smtpUser && this.smtpPass && this.emailProvider !== 'resend');

    if (this.smtpUser && this.smtpPass) {
      this.smtpFromEmail = process.env.EMAIL_FROM || `Dar'sstore <${this.smtpUser}>`;
      this.transporter = nodemailer.createTransport({
        service: this.smtpUser.includes('@gmail.com') ? 'gmail' : undefined,
        host: this.smtpHost || 'smtp.gmail.com',
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });
    } else {
      this.transporter = null;
    }

    if (this.resendKey) {
      this.resendFromEmail = process.env.RESEND_FROM || process.env.EMAIL_FROM || "Dar'sstore <onboarding@resend.dev>";
      this.resend = new Resend(this.resendKey);
    } else {
      this.resend = null;
    }

    if (this.preferSmtp && this.transporter) {
      this.fromEmail = this.smtpFromEmail;
    } else if (this.resend) {
      this.fromEmail = this.resendFromEmail;
    } else if (this.transporter) {
      this.fromEmail = this.smtpFromEmail;
    } else {
      this.fromEmail = process.env.EMAIL_FROM || "Dar'sstore <support@darstore.com>";
    }
  }

  getFrontendBaseUrl() {
    return (process.env.FRONTEND_URL || 'https://darstore.vercel.app').replace(/\/$/, '');
  }

  buildTrackingLink(order) {
    const base = this.getFrontendBaseUrl();
    const inv = encodeURIComponent(order.invoice_number || '');
    const tok = order.access_token ? `&token=${encodeURIComponent(order.access_token)}` : '';
    return `${base}/?invoice=${inv}${tok}`;
  }

  async _deliverEmail({ to, subject, html, label = 'Email' }) {
    this.reloadConfig();

    const recipient = (to || '').trim();
    if (!recipient || !recipient.includes('@')) {
      return { success: false, delivered: false, reason: 'Invalid or missing email' };
    }

    const trySmtp = async () => {
      if (!this.transporter) return null;
      console.log(`[EMAIL SERVICE] Mengirim ${label} via SMTP (${this.smtpUser}) ke: ${recipient}...`);
      const info = await this.transporter.sendMail({
        from: this.smtpFromEmail || this.fromEmail,
        to: recipient,
        subject,
        html,
      });
      console.log(`[EMAIL SERVICE] ${label} berhasil dikirim via SMTP! MessageId: ${info.messageId}`);
      return { success: true, delivered: true, provider: 'smtp', messageId: info.messageId };
    };

    const tryResend = async () => {
      if (!this.resend) return null;
      console.log(`[EMAIL SERVICE] Mengirim ${label} via Resend API ke: ${recipient}...`);
      const { data, error } = await this.resend.emails.send({
        from: this.resendFromEmail || this.fromEmail,
        to: recipient,
        subject,
        html,
      });
      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }
      console.log(`[EMAIL SERVICE] ${label} berhasil dikirim via Resend! ID: ${data?.id}`);
      return { success: true, delivered: true, provider: 'resend', id: data?.id };
    };

    const providers = this.preferSmtp ? [trySmtp, tryResend] : [tryResend, trySmtp];
    let lastError = null;

    for (const attempt of providers) {
      try {
        const res = await attempt();
        if (res) return res;
      } catch (err) {
        lastError = err;
        console.warn(`[EMAIL SERVICE] Provider gagal mengirim ${label} ke ${recipient}, mencoba fallback:`, err.message);
      }
    }

    if (!this.transporter && !this.resend) {
      console.log(`[EMAIL SERVICE (SIMULATION)] ${label} untuk ${recipient} | Subject: ${subject}`);
      return { success: true, delivered: false, simulated: true };
    }

    console.error(`[EMAIL SERVICE ERROR] Semua provider gagal mengirim ${label} ke ${recipient}:`, lastError?.message);
    return { success: false, delivered: false, error: lastError?.message || 'Email delivery failed' };
  }

  /**
   * Send pending payment invoice & Virtual Account instructions right after checkout
   * @param {Object} order - Database order object
   * @param {Object} vaData - { bank, va_number, bill_key, biller_code, expired_at, redirect_url }
   */
  async sendPendingPaymentEmail(order, vaData = {}) {
    const recipient = (order.wa_email_guest || '').trim();
    if (!recipient || !recipient.includes('@')) {
      return { success: false, delivered: false, reason: 'Invalid or missing email' };
    }

    const targetAccount = order.game === 'mlbb'
      ? `${order.game_user_id} (${order.server_id})`
      : (order.riot_id || order.game_user_id || '-');
    const gameTitle = order.game === 'mlbb' ? 'Mobile Legends: Bang Bang' : 'Valorant';
    const formattedTotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total_harga || 0);
    const pendingDiscount = Number(order.discount_amount || 0);
    const pendingFee = order.fee !== undefined ? Number(order.fee) : (String(order.payment_method || '').toLowerCase().includes('gratis') ? 0 : 0);
    const pendingBase = Math.max(0, ((order.total_harga || 0) + pendingDiscount) - pendingFee);
    const formattedPendingBase = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(pendingBase);
    const formattedPendingFee = pendingFee === 0 ? 'Gratis Admin' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(pendingFee);
    const formattedPendingDiscount = pendingDiscount > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(pendingDiscount) : null;
    const bankName = String(vaData.bank || order.payment_method || 'Virtual Account').toUpperCase();
    const vaNumber = vaData.va_number || order.va_number || null;
    const billKey = vaData.bill_key || order.bill_key || null;
    const billerCode = vaData.biller_code || order.biller_code || null;
    const expiredStr = (vaData.expired_at || order.expired_at)
      ? new Date(vaData.expired_at || order.expired_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
      : '24 Jam sejak pemesanan';
    const trackingUrl = this.buildTrackingLink(order);

    const paymentCodeHtml = vaNumber
      ? `
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
          NOMOR VIRTUAL ACCOUNT (${bankName})
        </div>
        <div style="font-size: 20px; font-weight: 900; color: #0284c7; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; margin: 8px 0 4px;">
          ${vaNumber}
        </div>
      `
      : (billKey && billerCode)
        ? `
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
            MANDIRI BILL PAYMENT
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0284c7; font-family: 'Courier New', Courier, monospace; margin: 8px 0 4px;">
            Kode Perusahaan: ${billerCode}<br/>Kode Bayar: ${billKey}
          </div>
        `
        : `
          <div style="font-size: 12px; font-weight: 700; color: #0284c7;">
            Metode Pembayaran: ${order.payment_method}
          </div>
        `;

    const emailSubject = `[TAGIHAN PEMBAYARAN] ${order.invoice_number} - Menunggu Pembayaran | Dar'sstore`;
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tagihan Pembayaran - ${order.invoice_number}</title>
      </head>
      <body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <center>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); overflow: hidden; text-align: left;">
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 22px 24px; text-align: center; color: #ffffff;">
                <div style="font-size: 20px; font-weight: 900; letter-spacing: 2px; font-family: 'Courier New', Courier, monospace;">DAR'SSTORE</div>
                <div style="font-size: 12px; color: #38bdf8; font-weight: 700; margin-top: 4px; text-transform: uppercase;">Instruksi Pembayaran Pesanan</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <div style="text-align: center; margin-bottom: 16px;">
                  <span style="display: inline-block; background-color: #fef9c3; color: #a16207; border: 1px solid #fde047; font-size: 11.5px; font-weight: 800; padding: 5px 14px; border-radius: 999px; text-transform: uppercase;">
                    ⏳ Menunggu Pembayaran
                  </span>
                </div>

                <p style="font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 16px;">
                  Terima kasih telah memesan di <strong>Dar'sstore</strong>. Silakan selesaikan pembayaran sesuai rincian di bawah ini agar item otomatis dikirim ke akun game Anda:
                </p>

                <div style="background-color: #f8fafc; border: 1.5px dashed #0284c7; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 18px;">
                  ${paymentCodeHtml}
                  <div style="font-size: 11px; color: #64748b; margin-top: 6px;">
                    Total Transfer Tepat: <strong style="color: #0f172a; font-size: 14px;">${formattedTotal}</strong>
                  </div>
                  <div style="font-size: 11px; color: #dc2626; margin-top: 4px;">
                    Batas Waktu: ${expiredStr}
                  </div>
                </div>

                <table width="100%" cellpadding="5" cellspacing="0" border="0" style="font-size: 12.5px; color: #334155; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-bottom: 18px;">
                  <tr>
                    <td style="color: #64748b;">No. Invoice</td>
                    <td style="text-align: right; font-weight: 800; color: #0f172a; font-family: monospace;">${order.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">Game</td>
                    <td style="text-align: right; font-weight: 700;">${gameTitle}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">Akun Tujuan</td>
                    <td style="text-align: right; font-weight: 800; color: #0284c7;">${targetAccount}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">Item Produk</td>
                    <td style="text-align: right; font-weight: 700;">${order.nama_item}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">Metode Bayar</td>
                    <td style="text-align: right;">${order.payment_method}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">Harga Produk</td>
                    <td style="text-align: right; font-weight: 700;">${formattedPendingBase}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">Biaya Admin</td>
                    <td style="text-align: right; font-weight: 700; color: ${pendingFee === 0 ? '#16a34a' : '#d97706'};">${formattedPendingFee}</td>
                  </tr>
                  ${formattedPendingDiscount ? `
                  <tr>
                    <td style="color: #ca8a04;">Diskon Poin (${order.points_used || 0} Poin)</td>
                    <td style="text-align: right; font-weight: 700; color: #ca8a04;">-${formattedPendingDiscount}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="color: #0f172a; font-weight: 800;">Total Bayar</td>
                    <td style="text-align: right; font-weight: 900; color: #0284c7; font-size: 14px;">${formattedTotal}</td>
                  </tr>
                </table>

                <div style="text-align: center; margin: 18px 0 8px;">
                  <a href="${trackingUrl}" target="_blank" style="background: linear-gradient(135deg, #0284c7, #0369a1); background-color: #0284c7; color: #ffffff; display: block; font-size: 13.5px; font-weight: 800; line-height: 44px; text-align: center; text-decoration: none; border-radius: 8px; text-transform: uppercase;">
                    🔍 Pantau Status Pesanan
                  </a>
                </div>
                <div style="font-size: 11px; color: #64748b; text-align: center; margin-top: 10px;">
                  Struk resmi beserta Serial Number (SN) akan dikirimkan otomatis ke email ini segera setelah pembayaran Anda terkonfirmasi.
                </div>
              </td>
            </tr>
          </table>
        </center>
      </body>
      </html>
    `;

    return await this._deliverEmail({
      to: recipient,
      subject: emailSubject,
      html: emailHtml,
      label: `tagihan pesanan ${order.invoice_number}`
    });
  }

  /**
   * Send order success receipt email
   * @param {Object} order - Database order object
   * @param {Object} topupResult - { sn, message, success }
   */
  async sendOrderReceipt(order, topupResult = {}) {
    const recipient = (order.wa_email_guest || '').trim();
    if (!recipient || !recipient.includes('@')) {
      console.log(`[EMAIL SERVICE] Pembeli (${order.invoice_number}) tidak menyertakan email valid: "${recipient}". Email dilewati.`);
      return { success: false, delivered: false, reason: 'Invalid or missing email' };
    }

    const sn = topupResult.sn || order.sn || `SN-${Date.now()}`;
    const targetAccount = order.game === 'mlbb'
      ? `${order.game_user_id} (${order.server_id})`
      : (order.riot_id || order.game_user_id || '-');
    const gameTitle = order.game === 'mlbb' ? 'Mobile Legends: Bang Bang' : 'Valorant';
    const trackingUrl = this.buildTrackingLink(order);
    const formattedTotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total_harga || 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    const discountAmount = order.discount_amount || 0;
    const formattedDiscount = discountAmount > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(discountAmount) : 'Rp 0';
    const paymentMethodLabel = order.payment_method || 'Midtrans Virtual Account';
    const feeAmount = order.fee !== undefined ? Number(order.fee) : (String(paymentMethodLabel).toLowerCase().includes('gratis') ? 0 : 0);
    const basePrice = Math.max(0, ((order.total_harga || 0) + discountAmount) - feeAmount);
    const formattedBase = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(basePrice);
    const formattedFee = feeAmount > 0
      ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(feeAmount)
      : 'Gratis Admin';

    const emailSubject = `[STRUK RESMI] Pembayaran Sukses - ${order.invoice_number} | Dar'sstore`;

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Struk Pembayaran Resmi - ${order.invoice_number}</title>
      </head>
      <body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <center>
          <!-- Perforated Cut Line Top -->
          <div style="max-width: 460px; text-align: center; font-size: 11px; color: #94a3b8; font-family: monospace; letter-spacing: 2px; margin-bottom: 6px;">
            ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂
          </div>

          <!-- Receipt Container -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 460px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); overflow: hidden; text-align: left;">
            <tr>
              <td style="padding: 24px 22px;">

                <!-- Receipt Header -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="text-align: center; margin-bottom: 16px;">
                  <tr>
                    <td align="center">
                      <div style="font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 2px; font-family: 'Courier New', Courier, monospace; text-transform: uppercase;">
                        DAR'SSTORE
                      </div>
                      <div style="font-size: 11px; font-weight: 700; color: #0284c7; letter-spacing: 1px; margin-top: 2px; text-transform: uppercase;">
                        STRUK PEMBAYARAN & TOP-UP RESMI
                      </div>
                      <div style="font-size: 10.5px; color: #64748b; margin-top: 4px; font-family: 'Courier New', Courier, monospace;">
                        Platform Top Up Game Tercepat & Terpercaya<br/>
                        MID: M738281649
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 12px;">
                      <div style="display: inline-block; border: 2px dashed #16a34a; background-color: #f0fdf4; color: #16a34a; font-family: monospace; font-size: 12px; font-weight: 800; padding: 4px 16px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">
                        ✓ LUNAS / PAYMENT CONFIRMED
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Dashed Divider -->
                <div style="border-top: 2px dashed #cbd5e1; margin: 14px 0;"></div>

                <!-- Transaction Info (POS Monospace) -->
                <table width="100%" cellpadding="3" cellspacing="0" border="0" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #334155;">
                  <tr>
                    <td style="color: #64748b; width: 40%;">NO. INVOICE</td>
                    <td style="text-align: right; font-weight: 800; color: #0f172a;">${order.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">TANGGAL</td>
                    <td style="text-align: right; color: #334155;">${dateStr}, ${timeStr}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">METODE BAYAR</td>
                    <td style="text-align: right; color: #334155;">${paymentMethodLabel}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">STATUS TRANSAKSI</td>
                    <td style="text-align: right; font-weight: 700; color: #16a34a;">BERHASIL / SUKSES</td>
                  </tr>
                </table>

                <!-- Dashed Divider -->
                <div style="border-top: 1px dashed #cbd5e1; margin: 12px 0;"></div>

                <!-- Customer & Game Account -->
                <table width="100%" cellpadding="3" cellspacing="0" border="0" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #334155;">
                  <tr>
                    <td style="color: #64748b; width: 40%;">GAME</td>
                    <td style="text-align: right; font-weight: 700; color: #0f172a;">${gameTitle}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">AKUN TUJUAN</td>
                    <td style="text-align: right; font-weight: 800; color: #0284c7;">${targetAccount}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b;">EMAIL PEMBELI</td>
                    <td style="text-align: right; color: #334155;">${order.wa_email_guest || '-'}</td>
                  </tr>
                </table>

                <!-- Dashed Divider -->
                <div style="border-top: 2px dashed #94a3b8; margin: 14px 0 10px;"></div>

                <!-- Itemized Header -->
                <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="text-align: left; width: 55%;">ITEM PRODUK</td>
                    <td style="text-align: center; width: 15%;">QTY</td>
                    <td style="text-align: right; width: 30%;">HARGA</td>
                  </tr>
                </table>

                <!-- Item Row -->
                <table width="100%" cellpadding="4" cellspacing="0" border="0" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #0f172a; margin-top: 4px;">
                  <tr>
                    <td style="text-align: left; font-weight: 700; width: 55%;">${order.nama_item}</td>
                    <td style="text-align: center; color: #64748b; width: 15%;">1x</td>
                    <td style="text-align: right; font-weight: 800; width: 30%;">${formattedBase}</td>
                  </tr>
                </table>

                <!-- Subtotal & Discount Breakdown -->
                <table width="100%" cellpadding="3" cellspacing="0" border="0" style="font-family: 'Courier New', Courier, monospace; font-size: 11.5px; color: #475569; margin-top: 8px;">
                  <tr>
                    <td style="text-align: right; width: 70%;">Subtotal Produk:</td>
                    <td style="text-align: right; width: 30%; font-weight: 600;">${formattedBase}</td>
                  </tr>
                  <tr>
                    <td style="text-align: right;">Biaya Layanan:</td>
                    <td style="text-align: right; font-weight: 600;">${formattedFee}</td>
                  </tr>
                  ${discountAmount > 0 ? `
                  <tr>
                    <td style="text-align: right; color: #ca8a04;">Diskon Poin (${order.points_used || 0} Poin):</td>
                    <td style="text-align: right; color: #ca8a04; font-weight: 700;">-${formattedDiscount}</td>
                  </tr>
                  ` : ''}
                </table>

                <!-- Double Dashed Line for Total -->
                <div style="border-top: 2px dashed #0f172a; border-bottom: 2px dashed #0f172a; padding: 10px 0; margin: 12px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: 'Courier New', Courier, monospace;">
                    <tr>
                      <td style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                        TOTAL BAYAR
                      </td>
                      <td style="text-align: right; font-size: 18px; font-weight: 900; color: #0284c7;">
                        ${formattedTotal}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 10px; color: #64748b; padding-top: 4px;">
                        METODE: ${paymentMethodLabel}
                      </td>
                      <td style="text-align: right; font-size: 10px; color: #16a34a; font-weight: 700; padding-top: 4px;">
                        ✓ LUNAS TERKONFIRMASI
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Delivery Proof / Serial Number (SN) -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px dashed #0284c7; border-radius: 6px; margin: 16px 0 18px; text-align: center;">
                  <tr>
                    <td style="padding: 12px 14px;">
                      <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 1px; font-family: monospace; text-transform: uppercase;">
                        KODE SERIAL NUMBER (SN) / BUKTI PENGIRIMAN
                      </div>
                      <div style="font-size: 15px; font-weight: 900; color: #0369a1; font-family: 'Courier New', Courier, monospace; letter-spacing: 1px; margin: 6px 0 4px;">
                        ${sn}
                      </div>
                      <div style="font-size: 10.5px; color: #15803d; font-weight: 600;">
                        ✓ Status: Item telah sukses ditambahkan ke akun game Anda.
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Barcode Simulation -->
                <div style="text-align: center; margin: 16px 0 10px;">
                  <div style="display: inline-block; letter-spacing: 3px; color: #0f172a; font-family: monospace; font-size: 26px; line-height: 1; user-select: none;">
                    ||||| | |||| || ||||| || |||||| | ||| ||||
                  </div>
                  <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #64748b; letter-spacing: 2px; margin-top: 4px;">
                    *${order.invoice_number}*
                  </div>
                </div>

                <!-- CTA Button to Check Invoice on Website -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 18px 0 10px;">
                  <tr>
                    <td align="center">
                      <a href="${trackingUrl}" target="_blank" style="background: linear-gradient(135deg, #0284c7, #0369a1); background-color: #0284c7; color: #ffffff; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 800; line-height: 46px; text-align: center; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                        🔍 LIHAT & UNDUH INVOICE DI WEBSITE
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="font-size: 11px; color: #64748b; text-align: center; line-height: 1.4; margin-bottom: 14px;">
                  Klik tombol di atas untuk membuka riwayat transaksi Anda secara realtime di website resmi Dar'sstore.
                </div>

                <!-- Bottom Perforated Line -->
                <div style="border-top: 1px dashed #cbd5e1; margin: 16px 0 12px;"></div>

                <!-- Footer Notes -->
                <div style="font-size: 10.5px; color: #64748b; text-align: center; font-family: 'Courier New', Courier, monospace; line-height: 1.5;">
                  * Simpan struk digital ini sebagai bukti transaksi resmi *<br/>
                  Layanan Pelanggan (CS 24 Jam): WhatsApp <a href="https://wa.me/6282135439524" style="color: #0284c7; text-decoration: none;">+62 821-3543-9524</a><br/>
                  Email Support: <a href="mailto:bayusaputro.bs2@gmail.com" style="color: #0284c7; text-decoration: none;">bayusaputro.bs2@gmail.com</a><br/>
                  <strong>TERIMA KASIH TELAH BERBELANJA DI DAR'SSTORE!</strong>
                </div>

              </td>
            </tr>
          </table>

          <!-- Perforated Cut Line Bottom -->
          <div style="max-width: 460px; text-align: center; font-size: 11px; color: #94a3b8; font-family: monospace; letter-spacing: 2px; margin-top: 6px;">
            ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂
          </div>
        </center>
      </body>
      </html>
    `;

    return await this._deliverEmail({
      to: recipient,
      subject: emailSubject,
      html: emailHtml,
      label: `struk resmi ${order.invoice_number}`
    });
  }

  /**
   * Send order failure notification email
   * @param {Object} order - Database order object
   * @param {string} failureReason - Error message
   */
  async sendOrderFailedNotice(order, failureReason) {
    const recipient = (order.wa_email_guest || '').trim();
    if (!recipient || !recipient.includes('@')) {
      return { success: false, delivered: false, reason: 'Invalid or missing email' };
    }

    const emailSubject = `[Pemberitahuan] Pesanan ${order.invoice_number} Gagal Diproses - Dar'sstore`;
    const targetAccount = order.game === 'mlbb' ? `${order.game_user_id} (${order.server_id})` : (order.riot_id || '-');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 24px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">⚠️ Pesanan Gagal Diproses</h2>
            <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Provider Game Menolak Permintaan Top-Up</p>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6;">
              Halo Pelanggan <strong>Dar'sstore</strong>,<br>
              Pesanan dengan nomor invoice <strong>${order.invoice_number}</strong> tidak dapat diselesaikan oleh server provider game.
            </p>
            
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
              <strong style="color: #991b1b; font-size: 13px;">Alasan Kegagalan:</strong>
              <div style="color: #b91c1c; font-size: 13px; margin-top: 4px;">${failureReason || 'ID Akun / Server tidak ditemukan di publisher game.'}</div>
            </div>

            <table width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; margin-bottom: 20px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="color: #64748b;">Invoice:</td>
                <td style="text-align: right; font-weight: bold;">${order.invoice_number}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="color: #64748b;">Game & Item:</td>
                <td style="text-align: right; font-weight: bold;">${order.nama_item}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="color: #64748b;">Akun Tujuan:</td>
                <td style="text-align: right; font-weight: bold; color: #ef4444;">${targetAccount}</td>
              </tr>
            </table>

            <p style="font-size: 13px; color: #475569; line-height: 1.5;">
              <strong>Jangan Khawatir:</strong> Poin reward yang Anda gunakan (jika ada) telah otomatis dikembalikan ke akun Anda. Untuk bantuan perbaikan ID atau proses pengembalian dana (refund), silakan hubungi tim Customer Support kami:
            </p>

            <div style="text-align: center; margin: 24px 0 10px;">
              <a href="https://wa.me/6282135439524?text=Halo%20Dar'sstore,%20pesanan%20saya%20${order.invoice_number}%20gagal%20karena%20salah%20ID.%20Mohon%20bantuan." 
                 style="background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                Hubungi CS via WhatsApp (+62 821-3543-9524)
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            © 2026 Dar'sstore. Layanan Top Up Game Resmi & Terpercaya.
          </div>
        </div>
      </body>
      </html>
    `;

    return await this._deliverEmail({
      to: recipient,
      subject: emailSubject,
      html: emailHtml,
      label: `notifikasi kegagalan ${order.invoice_number}`
    });
  }
}

module.exports = new EmailService();
