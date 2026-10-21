const crypto = require('crypto');
const midtransClient = require('midtrans-client');

/**
 * Midtrans Payment Gateway Service (Production & Sandbox Mode)
 * Implements Midtrans CoreApi (QRIS) & Snap (Multi-payment).
 */
class PaymentGatewayService {
  constructor() {
    this.reloadConfig();
  }

  /**
   * Reload configuration and enforce sandbox guardrails
   */
  reloadConfig() {
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim() || 'SB-Mid-server-xxxxxxxxxxxxx';
    this.clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim() || 'SB-Mid-client-xxxxxxxxxxxxx';

    // Validasi pencegahan salah pasang key
    if (this.isProduction) {
      if (this.serverKey.startsWith('SB-')) {
        throw new Error('Konfigurasi Error: MIDTRANS_IS_PRODUCTION=true aktif, tetapi MIDTRANS_SERVER_KEY masih menggunakan key Sandbox (berawalan "SB-"). Harap gunakan Server Key Production dari dashboard.midtrans.com.');
      }
      console.log('[MIDTRANS] Mode PRODUCTION Aktif. Menggunakan Midtrans Live Gateway.');
    } else {
      console.log('[MIDTRANS] Mode SANDBOX Aktif. Menggunakan Midtrans Testing Environment.');
    }

    // Initialize Core API for QRIS direct checkout
    this.coreApi = new midtransClient.CoreApi({
      isProduction: this.isProduction,
      serverKey: this.serverKey,
      clientKey: this.clientKey,
    });

    // Initialize Snap API for popup / multi-channel checkout
    this.snap = new midtransClient.Snap({
      isProduction: this.isProduction,
      serverKey: this.serverKey,
      clientKey: this.clientKey,
    });
  }

  /**
   * Charge Midtrans Core API with payment_type: 'qris'
   * @param {Object} order - { invoice_number, total_harga, nama_item, product_id, ... }
   */
  async createQrisTransaction(order) {
    this.reloadConfig();
    const isMock = !this.serverKey || this.serverKey.includes('xxxxxxxxxxxxx');

    if (isMock) {
      console.log(`[MIDTRANS] Dev Mode (Mock): Server key placeholder aktif. Mengenerate QRIS lokal untuk ${order.invoice_number}`);
      const mockRef = `MID-MOCK-${Date.now()}`;
      const qrisString = `00020101021226570014ID.DARSSTORE.WWW01189360091800000000000208${order.invoice_number}520454115303360540${order.total_harga.toString().length}${order.total_harga}5802ID5910DARSSTORE6007JAKARTA62070703A016304`;
      const mockQrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisString)}`;
      const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return {
        payment_ref: mockRef,
        qris_string: qrisString,
        qris_url: mockQrisUrl,
        simulator_url: 'https://simulator.sandbox.midtrans.com/qris/index',
        expired_at: expiry,
        raw_response: {
          status_code: '201',
          status_message: 'Midtrans mock QRIS transaction generated',
          transaction_id: mockRef,
          order_id: order.invoice_number,
          gross_amount: String(order.total_harga),
          payment_type: 'qris',
          transaction_time: new Date().toISOString(),
          transaction_status: 'pending',
          actions: [
            {
              name: 'generate-qr-code',
              method: 'GET',
              url: mockQrisUrl
            }
          ]
        }
      };
    }

    // Live Midtrans Sandbox Core API Call
    try {
      const chargePromise = this.coreApi.charge({
        payment_type: 'qris',
        transaction_details: {
          order_id: order.invoice_number,
          gross_amount: Math.round(Number(order.total_harga)),
        },
        qris: {
          acquirer: 'gopay', // default acquirer
        },
        custom_expiry: {
          expiry_duration: 15,
          unit: 'minute',
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Midtrans API connection timeout (8000ms)')), 8000)
      );

      const chargeResponse = await Promise.race([chargePromise, timeoutPromise]);

      // Extract QR code URL from Midtrans actions array
      const qrAction = Array.isArray(chargeResponse.actions)
        ? chargeResponse.actions.find((a) => a.name === 'generate-qr-code')
        : null;

      const qrCodeUrl = qrAction
        ? qrAction.url
        : (chargeResponse.qr_string
            ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(chargeResponse.qr_string)}`
            : null);

      return {
        payment_ref: chargeResponse.transaction_id,
        qris_string: chargeResponse.qr_string || null,
        qris_url: qrCodeUrl,
        simulator_url: this.isProduction ? null : 'https://simulator.sandbox.midtrans.com/qris/index',
        expired_at: chargeResponse.expiry_time || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        raw_response: chargeResponse,
      };
    } catch (chargeErr) {
      if (this.isProduction) {
        console.error(`[MIDTRANS PRODUCTION NOTICE]: Core API QRIS: ${chargeErr.message}`);
        // Jika channel GoPay/QRIS Core API belum aktif di MAP atau timeout atau 404, alihkan otomatis ke Midtrans Snap Live Checkout
        if (
          chargeErr.message.includes('Payment channel is not activated') ||
          chargeErr.message.includes('Merchant pop id') ||
          chargeErr.message.includes('404') ||
          chargeErr.message.includes('timeout') ||
          (chargeErr.ApiResponse && chargeErr.ApiResponse.status_message && (
            chargeErr.ApiResponse.status_message.includes('Payment channel is not activated') ||
            chargeErr.ApiResponse.status_message.includes('Merchant pop id')
          ))
        ) {
          console.log('[MIDTRANS PRODUCTION] Core API QRIS channel belum diaktifkan di dashboard Midtrans. Mengalihkan ke Midtrans Snap Live Checkout...');
          try {
            const snapRes = await this.createSnapTransaction(order, {
              name: order.wa_email_guest || 'Pelanggan Darstore',
              email: order.wa_email_guest && order.wa_email_guest.includes('@') ? order.wa_email_guest : 'customer@darstore.com'
            });

            // Buat QR code yang mengarahkan langsung ke halaman pembayaran Snap
            const snapQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(snapRes.redirect_url)}`;
            const expiryTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

            return {
              payment_ref: snapRes.token,
              qris_string: snapRes.redirect_url,
              qris_url: snapQrUrl,
              redirect_url: snapRes.redirect_url,
              simulator_url: null,
              snap_token: snapRes.token,
              expired_at: expiryTime,
              raw_response: {
                status_code: '201',
                status_message: 'Midtrans Snap production transaction generated (Seamless Channel Fallback)',
                token: snapRes.token,
                redirect_url: snapRes.redirect_url,
                order_id: order.invoice_number,
                payment_type: 'snap_live'
              }
            };
          } catch (snapErr) {
            console.error('[MIDTRANS SNAP LIVE ERROR]:', snapErr.message);
            throw new Error(`Gagal membuat transaksi Midtrans Snap: ${snapErr.message}`);
          }
        }

        throw new Error(`Gagal membuat tagihan QRIS Midtrans Production: ${chargeErr.message}`);
      }

      console.warn(`[MIDTRANS] Peringatan Sandbox: ${chargeErr.message}`);
      if (chargeErr.message.includes('401') || chargeErr.message.includes('Unauthorized')) {
        console.warn(
          '💡 Petunjuk: Key Sandbox belum valid atau sudah kedaluwarsa. Salin Server Key aktif dari https://dashboard.sandbox.midtrans.com -> Settings > Access Keys ke .env.'
        );
      }

      // Fallback aman untuk development/sandbox agar alur UI & testing tetap berjalan mulus
      const mockRef = `MID-SANDBOX-${Date.now()}`;
      const qrisString = `00020101021226570014ID.DARSSTORE.WWW01189360091800000000000208${order.invoice_number}520454115303360540${order.total_harga.toString().length}${order.total_harga}5802ID5910DARSSTORE6007JAKARTA62070703A016304`;
      const mockQrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisString)}`;
      return {
        payment_ref: mockRef,
        qris_string: qrisString,
        qris_url: mockQrisUrl,
        simulator_url: 'https://simulator.sandbox.midtrans.com/qris/index',
        expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        raw_response: {
          status_code: '201',
          status_message: 'Midtrans sandbox simulated transaction (fallback)',
          transaction_id: mockRef,
          order_id: order.invoice_number,
          payment_type: 'qris'
        }
      };
    }
  }

  /**
   * Create Snap Transaction (Multi-payment: Kartu Kredit, VA BSI/Mandiri/Permata, GoPay, QRIS)
   * @param {Object} order - { invoice_number, total_harga, nama_item }
   * @param {Object} customer - { name, email, phone }
   */
  async createSnapTransaction(order, customer = {}) {
    this.reloadConfig();
    const parameter = {
      transaction_details: {
        order_id: order.invoice_number,
        gross_amount: Math.round(Number(order.total_harga)),
      },
      item_details: [
        {
          id: String(order.product_id || order.invoice_number),
          price: Math.round(Number(order.total_harga)),
          quantity: 1,
          name: (order.nama_item || 'Produk Top Up Game').substring(0, 50),
        },
      ],
      customer_details: {
        first_name: customer.name || 'Pelanggan',
        email: customer.email || 'customer@darsstore.com',
        phone: customer.phone || '081234567890',
      },
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const snapRes = await this.snap.createTransaction(parameter);
        return {
          token: snapRes.token,
          redirect_url: snapRes.redirect_url,
          order_id: order.invoice_number,
        };
      } catch (err) {
        if (attempt === 1 && (err.message.includes('EAI_AGAIN') || err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET'))) {
          console.warn(`[MIDTRANS SNAP RETRY] Mencoba ulang koneksi ke Snap API (attempt ${attempt + 1})...`);
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        console.error('[MIDTRANS SNAP ERROR]:', err.message);
        throw err;
      }
    }
  }

  /**
   * Create Midtrans Payment Link / Hosted Checkout
   * @param {Object} order - { invoice_number, total_harga, nama_item, product_id }
   * @param {Object} customer - { name, email, phone }
   */
  async createPaymentLink(order, customer = {}) {
    this.reloadConfig();
    try {
      const snapRes = await this.createSnapTransaction(order, customer);
      return {
        order_id: order.invoice_number,
        payment_url: snapRes.redirect_url,
        redirect_url: snapRes.redirect_url,
        token: snapRes.token
      };
    } catch (err) {
      console.error('[MIDTRANS PAYMENT LINK ERROR]:', err.message);
      throw err;
    }
  }

  /**
   * Verify SHA-512 signature from Midtrans Webhook
   * Formula: SHA512(order_id + status_code + gross_amount + ServerKey)
   */
  verifyWebhookSignature(payload, headerSignature) {
    this.reloadConfig();
    const { order_id, status_code, gross_amount, signature_key } = payload;
    const signature = signature_key || headerSignature;

    if (!signature) {
      if (process.env.NODE_ENV !== 'production' && (!this.serverKey || this.serverKey.includes('xxxxxxxxxxxxx'))) {
        return true; // Allow local mock test
      }
      return false;
    }

    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${this.serverKey}`)
      .digest('hex');

    return signature.toLowerCase() === expectedSignature.toLowerCase();
  }

  /**
   * Check live status directly from Midtrans API
   * @param {string} orderId - invoice number / order ID
   */
  async checkTransactionStatus(orderId) {
    this.reloadConfig();
    if (!orderId || !this.serverKey || this.serverKey.includes('xxxxxxxxxxxxx')) {
      return null;
    }
    try {
      const res = await this.coreApi.transaction.status(orderId);
      return res;
    } catch (err) {
      // Return null if transaction not found or network error
      return null;
    }
  }
}

module.exports = new PaymentGatewayService();
