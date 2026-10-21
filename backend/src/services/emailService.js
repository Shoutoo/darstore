const { Resend } = require('resend');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.reloadConfig();
  }

  reloadConfig() {
    this.emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    this.resendKey = process.env.RESEND_API_KEY || null;
    
    // SMTP Config (e.g. Gmail)
    this.smtpUser = process.env.EMAIL_USER || null;
    this.smtpPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : null;
    this.smtpHost = process.env.SMTP_HOST || (this.smtpUser && this.smtpUser.includes('@gmail.com') ? 'smtp.gmail.com' : null);
    this.smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

    // Prioritize SMTP if EMAIL_PROVIDER='smtp' OR if EMAIL_USER & EMAIL_PASS exist
    const useSmtp = (this.emailProvider === 'smtp') || (this.smtpUser && this.smtpPass && this.emailProvider !== 'resend');

    if (useSmtp && this.smtpUser && this.smtpPass) {
      this.fromEmail = process.env.EMAIL_FROM || `Dar'sstore <${this.smtpUser}>`;
      this.transporter = nodemailer.createTransport({
        service: (this.smtpUser && this.smtpUser.includes('@gmail.com')) ? 'gmail' : undefined,
        host: this.smtpHost || 'smtp.gmail.com',
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });
      this.resend = null;
      console.log(`[EMAIL SERVICE] Gmail / SMTP provider configured (${this.smtpUser}).`);
    } else if (this.resendKey) {
      this.fromEmail = process.env.EMAIL_FROM || "Dar'sstore <onboarding@resend.dev>";
      this.resend = new Resend(this.resendKey);
      this.transporter = null;
      console.log('[EMAIL SERVICE] Resend API provider configured.');
    } else {
      this.fromEmail = process.env.EMAIL_FROM || "Dar'sstore <support@darstore.com>";
      this.resend = null;
      this.transporter = null;
      console.log('[EMAIL SERVICE] Menunggu RESEND_API_KEY atau EMAIL_USER/EMAIL_PASS config. Mode simulasi aktif.');
    }
  }

  /**
   * Send order success receipt email
   * @param {Object} order - Database order object
   * @param {Object} topupResult - { sn, message, success }
   */
  async sendOrderReceipt(order, topupResult = {}) {
    this.reloadConfig();

    const recipient = (order.wa_email_guest || '').trim();
    if (!recipient || !recipient.includes('@')) {
      console.log(`[EMAIL SERVICE] Pembeli (${order.invoice_number}) tidak menyertakan email valid: "${recipient}". Email dilewati.`);
      return { success: false, reason: 'Invalid or missing email' };
    }

    const sn = topupResult.sn || `SN-${Date.now()}`;
    const targetAccount = order.game === 'mlbb'
      ? `${order.game_user_id} (${order.server_id})`
      : (order.riot_id || order.game_user_id || '-');
    const gameTitle = order.game === 'mlbb' ? 'Mobile Legends: Bang Bang' : 'Valorant';
    const invoiceUrl = `https://darstore-pearl.vercel.app/cek-transaksi`;
    const formattedTotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total_harga);

    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    const discountAmount = order.discount_amount || 0;
    const formattedDiscount = discountAmount > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(discountAmount) : 'Rp 0';
    const basePrice = (order.total_harga || 0) + discountAmount;
    const formattedBase = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(basePrice);

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
                        Website: darstore-pearl.vercel.app | MID: M738281649
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
                    <td style="color: #64748b;">KASIR / GATEWAY</td>
                    <td style="text-align: right; color: #334155;">Midtrans (QRIS Auto-Sync)</td>
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
                    <td style="text-align: right; width: 30%;">TOTAL</td>
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
                    <td style="text-align: right; width: 70%;">Subtotal:</td>
                    <td style="text-align: right; width: 30%; font-weight: 600;">${formattedBase}</td>
                  </tr>
                  ${discountAmount > 0 ? `
                  <tr>
                    <td style="text-align: right; color: #ca8a04;">Diskon Poin (${order.points_used || 0} Poin):</td>
                    <td style="text-align: right; color: #ca8a04; font-weight: 700;">-${formattedDiscount}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="text-align: right;">Biaya Admin / Fee:</td>
                    <td style="text-align: right; font-weight: 600; color: #16a34a;">Rp 0 (GRATIS)</td>
                  </tr>
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
                        METODE: ${order.payment_method}
                      </td>
                      <td style="text-align: right; font-size: 10px; color: #16a34a; font-weight: 700; padding-top: 4px;">
                        ✓ LUNAS / MIDTRANS QRIS
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
                      <a href="${invoiceUrl}?invoice=${order.invoice_number}" target="_blank" style="background: linear-gradient(135deg, #0284c7, #0369a1); background-color: #0284c7; color: #ffffff; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 800; line-height: 46px; text-align: center; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
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
                  Layanan Pelanggan (CS 24 Jam): WhatsApp <a href="https://wa.me/6281234567890" style="color: #0284c7; text-decoration: none;">0812-3456-7890</a><br/>
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

    try {
      if (this.resend) {
        console.log(`[EMAIL SERVICE] Mengirim struk via Resend API ke: ${recipient}...`);
        const { data, error } = await this.resend.emails.send({
          from: this.fromEmail,
          to: recipient,
          subject: emailSubject,
          html: emailHtml,
        });

        if (error) {
          console.error('[EMAIL RESEND ERROR]:', error);
          return { success: false, error };
        }

        console.log(`[EMAIL SERVICE] Struk berhasil dikirim via Resend! ID: ${data?.id}`);
        return { success: true, provider: 'resend', id: data?.id };
      } else if (this.transporter) {
        console.log(`[EMAIL SERVICE] Mengirim struk via SMTP ke: ${recipient}...`);
        const info = await this.transporter.sendMail({
          from: this.fromEmail,
          to: recipient,
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`[EMAIL SERVICE] Struk berhasil dikirim via SMTP! MessageId: ${info.messageId}`);
        return { success: true, provider: 'smtp', messageId: info.messageId };
      } else {
        console.log(`[EMAIL SERVICE (SIMULATION)] Struk pesanan ${order.invoice_number} dikirim ke ${recipient}:`);
        console.log(`  Subject: ${emailSubject}`);
        console.log(`  SN: ${sn}`);
        console.log(`  Item: ${order.nama_item} | Total: ${formattedTotal}`);
        return { success: true, simulated: true };
      }
    } catch (err) {
      console.error(`[EMAIL SERVICE ERROR] Gagal mengirim email ke ${recipient}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send order failure notification email
   * @param {Object} order - Database order object
   * @param {string} failureReason - Error message
   */
  async sendOrderFailedNotice(order, failureReason) {
    this.reloadConfig();

    const recipient = (order.wa_email_guest || '').trim();
    if (!recipient || !recipient.includes('@')) {
      return { success: false, reason: 'Invalid or missing email' };
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
              <a href="https://wa.me/6281234567890?text=Halo%20Dar'sstore,%20pesanan%20saya%20${order.invoice_number}%20gagal%20karena%20salah%20ID.%20Mohon%20bantuan." 
                 style="background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                Hubungi CS via WhatsApp
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

    try {
      if (this.resend) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to: recipient,
          subject: emailSubject,
          html: emailHtml,
        });
        console.log(`[EMAIL SERVICE] Notifikasi kegagalan dikirim via Resend ke: ${recipient}`);
      } else if (this.transporter) {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to: recipient,
          subject: emailSubject,
          html: emailHtml,
        });
        console.log(`[EMAIL SERVICE] Notifikasi kegagalan dikirim via SMTP ke: ${recipient}`);
      }
      return { success: true };
    } catch (err) {
      console.warn(`[EMAIL SERVICE] Gagal kirim email kegagalan:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new EmailService();
