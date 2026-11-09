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
  reloadConfig(force = false) {
    const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    const sKey = (process.env.MIDTRANS_SERVER_KEY || '').trim() || 'SB-Mid-server-xxxxxxxxxxxxx';
    const cKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim() || 'SB-Mid-client-xxxxxxxxxxxxx';

    if (!force && this.isProduction === isProd && this.serverKey === sKey && this.clientKey === cKey && this.coreApi && this.snap) {
      return;
    }

    this.isProduction = isProd;
    this.serverKey = sKey;
    this.clientKey = cKey;

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
   * Charge Midtrans for Virtual Account Payment (Bank Transfer)
   * Active Channels: 'bni_va', 'bri_va', 'echannel' (Mandiri), 'cimb_va', 'permata_va'
   * @param {Object} order - { invoice_number, total_harga, nama_item, payment_channel, payment_method, ... }
   * @param {Object} customer - { name, email, phone }
   */
  async createVaTransaction(order, customer = {}) {
    this.reloadConfig();

    // Guard: QRIS Demo dilarang membuat transaksi nyata pada payment gateway
    const methodStr = String(order.payment_method || '').toLowerCase();
    const channelStr = String(order.payment_channel || '').toLowerCase();
    if (methodStr.includes('demo') || channelStr.includes('demo')) {
      throw new Error('QRIS Demo hanya merupakan pratinjau antarmuka dan tidak dapat digunakan untuk memproses transaksi pembayaran.');
    }

    const isMock = !this.serverKey || this.serverKey.includes('xxxxxxxxxxxxx') || this.serverKey === 'SB-Mid-server-test-key';

    // Normalisasi channel bank
    let bank = 'bni';
    let channel = order.payment_channel || 'bni_va';
    if (channel.includes('bri')) { bank = 'bri'; channel = 'bri_va'; }
    else if (channel.includes('mandiri') || channel.includes('echannel')) { bank = 'mandiri'; channel = 'echannel'; }
    else if (channel.includes('cimb')) { bank = 'cimb'; channel = 'cimb_va'; }
    else if (channel.includes('permata')) { bank = 'permata'; channel = 'permata_va'; }
    else { bank = 'bni'; channel = 'bni_va'; }

    // Expiry Virtual Account 24 jam (bukan 15 menit QRIS)
    const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (isMock) {
      console.log(`[MIDTRANS] Mode Mock/Sandbox Test: Mengenerate Virtual Account ${bank.toUpperCase()} untuk invoice ${order.invoice_number}`);
      const mockRef = `MID-VA-${Date.now()}`;
      
      let vaNum = null;
      let billKey = null;
      let billerCode = null;

      if (bank === 'mandiri') {
        billerCode = '70012';
        billKey = `0812${Math.floor(10000000 + Math.random() * 90000000)}`;
      } else if (bank === 'bri') {
        vaNum = `12800${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      } else if (bank === 'cimb') {
        vaNum = `5919${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      } else if (bank === 'permata') {
        vaNum = `8471${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      } else {
        // BNI
        vaNum = `8808${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      }

      return {
        payment_ref: mockRef,
        payment_type: bank === 'mandiri' ? 'echannel' : 'bank_transfer',
        bank: bank.toUpperCase(),
        va_number: vaNum,
        bill_key: billKey,
        biller_code: billerCode,
        redirect_url: `https://simulator.sandbox.midtrans.com/openapi/va/index?order_id=${order.invoice_number}`,
        expired_at: expiryTime,
        raw_response: {
          status_code: '201',
          status_message: `Midtrans mock ${bank.toUpperCase()} VA generated`,
          transaction_id: mockRef,
          order_id: order.invoice_number,
          gross_amount: String(order.total_harga),
          payment_type: bank === 'mandiri' ? 'echannel' : 'bank_transfer',
          va_numbers: vaNum ? [{ bank, va_number: vaNum }] : undefined,
          bill_key: billKey,
          biller_code: billerCode,
          permata_va_number: bank === 'permata' ? vaNum : undefined,
          transaction_time: new Date().toISOString(),
          transaction_status: 'pending'
        }
      };
    }

    // Live Midtrans Execution (Production)
    try {
      const chargePayload = {
        payment_type: bank === 'mandiri' ? 'echannel' : (bank === 'permata' ? 'permata' : 'bank_transfer'),
        transaction_details: {
          order_id: order.invoice_number,
          gross_amount: Math.round(Number(order.total_harga))
        },
        item_details: this.buildItemDetails(order),
        customer_details: {
          first_name: customer.name || order.wa_email_guest || 'Pelanggan',
          email: customer.email || (order.wa_email_guest && order.wa_email_guest.includes('@') ? order.wa_email_guest : 'customer@darstore.com'),
          phone: customer.phone || '081234567890'
        },
        custom_expiry: {
          expiry_duration: 24,
          unit: 'hour'
        }
      };

      if (bank === 'mandiri') {
        chargePayload.echannel = {
          bill_info1: 'Pembayaran Top Up:',
          bill_info2: (order.nama_item || 'Game Top Up').slice(0, 30)
        };
      } else if (bank !== 'permata') {
        chargePayload.bank_transfer = { bank };
      }

      const chargeRes = await this.coreApi.charge(chargePayload);

      let extractedVa = null;
      if (Array.isArray(chargeRes.va_numbers) && chargeRes.va_numbers.length > 0) {
        extractedVa = chargeRes.va_numbers[0].va_number;
      } else if (chargeRes.permata_va_number) {
        extractedVa = chargeRes.permata_va_number;
      }

      return {
        payment_ref: chargeRes.transaction_id || chargeRes.order_id,
        payment_type: chargeRes.payment_type || 'bank_transfer',
        bank: bank.toUpperCase(),
        va_number: extractedVa,
        bill_key: chargeRes.bill_key || null,
        biller_code: chargeRes.biller_code || null,
        redirect_url: chargeRes.redirect_url || null,
        expired_at: chargeRes.expiry_time || expiryTime,
        raw_response: chargeRes
      };
    } catch (coreErr) {
      console.warn(`[MIDTRANS CORE API VA] Core API VA ${bank} dialihkan ke Snap:`, coreErr.message);

      // Fallback ke Snap dengan channel bank yang dipilih
      const snapRes = await this.createSnapTransaction(order, {
        name: customer.name || order.wa_email_guest || 'Pelanggan Darstore',
        email: customer.email || (order.wa_email_guest && order.wa_email_guest.includes('@') ? order.wa_email_guest : 'customer@darstore.com')
      });

      return {
        payment_ref: snapRes.token,
        payment_type: 'bank_transfer',
        bank: bank.toUpperCase(),
        va_number: null,
        bill_key: null,
        biller_code: null,
        redirect_url: snapRes.redirect_url,
        snap_token: snapRes.token,
        expired_at: expiryTime,
        raw_response: {
          status_code: '201',
          status_message: `Midtrans Snap ${bank.toUpperCase()} VA generated`,
          token: snapRes.token,
          redirect_url: snapRes.redirect_url,
          order_id: order.invoice_number
        }
      };
    }
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
        item_details: this.buildItemDetails(order),
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
        
        // Klasifikasi error: hanya alihkan ke Snap jika QRIS memang belum aktif di akun merchant
        const errMsg = (chargeErr.message || '').toLowerCase();
        const apiStatusMsg = (chargeErr.ApiResponse?.status_message || '').toLowerCase();
        const combinedErr = `${errMsg} ${apiStatusMsg}`;

        const isChannelInactive =
          combinedErr.includes('payment channel is not activated') ||
          combinedErr.includes('channel is not activated') ||
          combinedErr.includes('merchant pop id') ||
          combinedErr.includes('acquirer is not active') ||
          combinedErr.includes('not activated for this merchant') ||
          combinedErr.includes('404') ||
          (chargeErr.ApiResponse && Number(chargeErr.ApiResponse.status_code) === 404);

        if (isChannelInactive) {
          console.log('[MIDTRANS PRODUCTION] Core API QRIS channel belum diaktifkan di dashboard Midtrans. Mengalihkan ke Midtrans Snap Live Checkout...');
          try {
            const snapRes = await this.createSnapTransaction(order, {
              name: order.wa_email_guest || 'Pelanggan Darstore',
              email: order.wa_email_guest && order.wa_email_guest.includes('@') ? order.wa_email_guest : 'customer@darstore.com'
            });

            const expiryTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

            return {
              payment_ref: snapRes.token,
              qris_string: null,
              qris_url: null,
              redirect_url: snapRes.redirect_url,
              simulator_url: null,
              snap_token: snapRes.token,
              is_fallback_snap: true,
              expired_at: expiryTime,
              raw_response: {
                status_code: '201',
                status_message: 'Midtrans Snap production transaction generated (QRIS Channel Inactive Fallback)',
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

        // Jangan fallback untuk error otentikasi (401) atau bad request (400)
        throw new Error(`Gagal membuat tagihan QRIS Midtrans Production: ${chargeErr.message}`);
      }

      console.warn(`[MIDTRANS] Peringatan Sandbox: ${chargeErr.message}`);
      if (chargeErr.message.includes('401') || chargeErr.message.includes('Unauthorized')) {
        console.warn(
          '💡 Petunjuk: Key Sandbox belum valid atau sudah kedaluwarsa. Salin Server Key aktif dari https://dashboard.sandbox.midtrans.com -> Settings > Access Keys ke .env.'
        );
      }

      // Fallback aman HANYA untuk mode sandbox / development
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
   * Build transparent item details for Midtrans transactions
   * Guarantees that the sum of item_details matches gross_amount exactly
   * and separates the base product price and admin fee.
   * @param {Object} order
   * @returns {Array<Object>}
   */
  buildItemDetails(order) {
    const total = Math.round(Number(order.total_harga));
    const fee = order.fee !== undefined
      ? Number(order.fee)
      : (order.payment_method && order.payment_method.toLowerCase().includes('gratis') ? 0 : 1000);
    const discount = Number(order.discount_amount || 0);
    const qty = Math.max(1, parseInt(order.quantity, 10) || 1);

    // Calculate base price of the product
    let basePrice = order.base_price !== undefined
      ? Number(order.base_price)
      : (order.unit_price !== undefined ? Number(order.unit_price) * qty : (total - fee + discount));

    if (basePrice <= 0 || (basePrice + fee - discount) !== total) {
      basePrice = total - fee + discount;
    }

    const items = [];
    const rawItemName = (order.nama_item || 'Produk Top Up Game').replace(/\s*\(x\d+\)$/i, '').trim();

    if (discount > 0) {
      // Some bank VA channels reject negative price line items.
      // Apply discount to the product line item so all prices are non-negative.
      const effectiveProductTotal = Math.max(0, basePrice - discount);
      items.push({
        id: String(order.product_id || 'PROD').slice(0, 50),
        name: `${rawItemName} (Diskon Poin)`.slice(0, 50),
        price: Math.round(effectiveProductTotal),
        quantity: 1,
      });
    } else {
      const unitPrice = Math.round(basePrice / qty);
      items.push({
        id: String(order.product_id || 'PROD').slice(0, 50),
        name: rawItemName.slice(0, 50),
        price: unitPrice,
        quantity: qty,
      });
    }

    if (fee > 0) {
      const methodLabel = (order.payment_method || 'Virtual Account')
        .replace(/\s*\([^)]*\)/g, '')
        .trim();
      items.push({
        id: 'ADMIN_FEE',
        name: `Biaya Admin (${methodLabel || 'VA'})`.slice(0, 50),
        price: Math.round(fee),
        quantity: 1,
      });
    }

    // Verify sum equals total
    const sum = items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    if (sum === total) {
      return items;
    }

    // Fallback single line item if discrepancy exists
    return [
      {
        id: String(order.product_id || order.invoice_number || 'PROD').slice(0, 50),
        name: (order.nama_item || 'Produk Top Up Game').slice(0, 50),
        price: total,
        quantity: 1,
      },
    ];
  }

  /**
   * Create Snap Transaction (Active: GoPay, Mandiri, BNI, BRI, Permata, CIMB)
   * @param {Object} order - { invoice_number, total_harga, nama_item, payment_channel }
   * @param {Object} customer - { name, email, phone }
   */
  async createSnapTransaction(order, customer = {}) {
    this.reloadConfig();
    const activeChannels = ['gopay', 'bni_va', 'bri_va', 'echannel', 'permata_va', 'cimb_va'];
    const enabledPayments = (order.payment_channel && activeChannels.includes(order.payment_channel))
      ? [order.payment_channel]
      : activeChannels;

    const parameter = {
      transaction_details: {
        order_id: order.invoice_number,
        gross_amount: Math.round(Number(order.total_harga)),
      },
      enabled_payments: enabledPayments,
      item_details: this.buildItemDetails(order),
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
   * @param {Object} order - { invoice_number, total_harga, nama_item, product_id, payment_channel }
   * @param {Object} customer - { name, email, phone }
   */
  async createPaymentLink(order, customer = {}) {
    this.reloadConfig();
    const activeChannels = ['gopay', 'bni_va', 'bri_va', 'echannel', 'permata_va', 'cimb_va'];
    const enabledPayments = (order.payment_channel && activeChannels.includes(order.payment_channel))
      ? [order.payment_channel]
      : activeChannels;

    const endpoint = this.isProduction
      ? 'https://api.midtrans.com/v1/payment-links'
      : 'https://api.sandbox.midtrans.com/v1/payment-links';
    const auth = Buffer.from(this.serverKey + ':').toString('base64');

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: order.invoice_number,
            gross_amount: Math.round(Number(order.total_harga))
          },
          usage_limit: 1,
          enabled_payments: enabledPayments,
          customer_details: {
            first_name: customer.name || 'Pelanggan Darstore',
            email: customer.email || 'customer@darstore.com',
            phone: customer.phone || '081234567890'
          },
          item_details: this.buildItemDetails(order)
        })
      });

      if (resp.ok) {
        const linkRes = await resp.json();
        return {
          order_id: order.invoice_number,
          payment_url: linkRes.payment_url,
          redirect_url: linkRes.payment_url,
          qr_url: linkRes.qr_url,
          token: linkRes.order_id
        };
      }
    } catch (e) {
      console.warn('[MIDTRANS PAYMENT LINK API] Fallback to Snap:', e.message);
    }

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
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const { order_id, status_code, gross_amount, signature_key } = payload;
    const signature = signature_key || headerSignature;

    if (!signature || !order_id || !status_code || gross_amount === undefined || gross_amount === null) {
      return false;
    }

    if (!this.serverKey) {
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
