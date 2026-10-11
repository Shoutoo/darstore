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

    const emailSubject = `Struk Pembayaran Berhasil - ${order.invoice_number} | Dar'sstore`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b131e; color: #e2e8f0; margin: 0; padding: 24px 12px; }
          .container { max-width: 580px; margin: 0 auto; background: #111e2e; border: 1px solid #1e3a5f; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { background: linear-gradient(135deg, #001f3f, #003366); padding: 28px 24px; text-align: center; border-bottom: 2px solid #0099ff; }
          .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; }
          .header h1 span { color: #00aaff; }
          .header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
          .badge { display: inline-block; background: #10b981; color: #ffffff; font-weight: 700; font-size: 12px; padding: 6px 16px; border-radius: 20px; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { padding: 24px; }
          .section-title { font-size: 14px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid #1e3a5f; padding-bottom: 6px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
          .row span:first-child { color: #94a3b8; }
          .row span:last-child { font-weight: 600; color: #ffffff; text-align: right; }
          .highlight { color: #00aaff !important; font-weight: 700 !important; }
          .sn-box { background: rgba(0, 153, 255, 0.1); border: 1px dashed #0088cc; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0; }
          .sn-title { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
          .sn-code { font-size: 17px; font-weight: 800; color: #38bdf8; font-family: monospace; letter-spacing: 1px; }
          .btn-wrap { text-align: center; margin: 24px 0 12px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #0088cc, #0055ff); color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; }
          .footer { background: #0c1522; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
          .footer a { color: #00aaff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Dar's<span>store</span></h1>
            <p>Bukti Pembayaran & Pengiriman Top Up Game</p>
            <div class="badge">✓ Transaksi Sukses</div>
          </div>
          <div class="content">
            <div class="section-title">Rincian Transaksi</div>
            <div class="row">
              <span>Nomor Invoice:</span>
              <span class="highlight">${order.invoice_number}</span>
            </div>
            <div class="row">
              <span>Game:</span>
              <span>${gameTitle}</span>
            </div>
            <div class="row">
              <span>Item Produk:</span>
              <span>${order.nama_item}</span>
            </div>
            <div class="row">
              <span>Akun Tujuan:</span>
              <span>${targetAccount}</span>
            </div>
            <div class="row">
              <span>Metode Pembayaran:</span>
              <span>${order.payment_method}</span>
            </div>
            <div class="row">
              <span>Total Pembayaran:</span>
              <span class="highlight" style="font-size: 16px;">${formattedTotal}</span>
            </div>

            <div class="sn-box">
              <div class="sn-title">Kode Serial Number (SN) / Bukti Pengiriman</div>
              <div class="sn-code">${sn}</div>
            </div>

            <div class="btn-wrap">
              <a href="${invoiceUrl}?invoice=${order.invoice_number}" class="btn" target="_blank">Lihat Status Invoice di Website</a>
            </div>
          </div>
          <div class="footer">
            <p>Terima kasih telah mempercayakan top up game Anda di Dar'sstore!</p>
            <p>Butuh bantuan? Hubungi CS kami via WhatsApp di <a href="https://wa.me/6281234567890">081234567890</a> atau email ke <a href="mailto:support@darstore.com">support@darstore.com</a>.</p>
          </div>
        </div>
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
}

module.exports = new EmailService();
