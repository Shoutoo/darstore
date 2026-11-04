const crypto = require('crypto');

/**
 * Top Up Game Provider Service
 * Implements Digiflazz API specification with auto-simulation fallback.
 */
class TopupProviderService {
  getUsername() {
    return process.env.DIGIFLAZZ_USERNAME || 'viziziDbLbOg';
  }

  getApiKey() {
    if (process.env.DIGIFLAZZ_MODE === 'production') {
      return (process.env.DIGIFLAZZ_PROD_KEY || process.env.DIGIFLAZZ_KEY || process.env.DIGIFLAZZ_API_KEY || '').trim() || '0b367413-6219-533c-8602-515ee3d45e31';
    }
    return (process.env.DIGIFLAZZ_DEV_KEY || process.env.DIGIFLAZZ_KEY || process.env.DIGIFLAZZ_API_KEY || '').trim() || 'dev-dd8fea20-cd56-11f1-9889-539063f8d4ac';
  }

  isDevelopment() {
    const key = this.getApiKey();
    return key.startsWith('dev-') || process.env.DIGIFLAZZ_MODE !== 'production';
  }

  isConfigured() {
    const username = this.getUsername();
    const key = this.getApiKey();
    return Boolean(username && key && username !== 'your_digiflazz_username' && key !== 'your_digiflazz_api_key');
  }

  /**
   * Check deposit/balance directly from Digiflazz
   * Endpoint: POST https://api.digiflazz.com/v1/cek-saldo
   */
  async checkBalance() {
    const username = this.getUsername();
    const apiKey = this.getApiKey();
    const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');

    try {
      const response = await fetch('https://api.digiflazz.com/v1/cek-saldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmd: 'deposit',
          username,
          sign
        })
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('[DIGIFLAZZ CHECK BALANCE ERROR]:', err.message);
      return null;
    }
  }

  /**
   * Direct API request to Digiflazz transaction endpoint
   * Useful for testing test cases & live transactions
   */
  /**
   * Direct API request to Digiflazz transaction endpoint
   * Useful for testing test cases & live transactions
   */
  async requestTransaction({ buyer_sku_code, customer_no, ref_id, testing }) {
    const username = this.getUsername();
    const apiKey = this.getApiKey();
    const refId = ref_id || `DARS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sign = crypto.createHash('md5').update(`${username}${apiKey}${refId}`).digest('hex');
    const isDev = testing !== undefined ? Boolean(testing) : this.isDevelopment();

    const payload = {
      username,
      buyer_sku_code,
      customer_no,
      ref_id: refId,
      sign,
      ...(isDev ? { testing: true } : {})
    };

    const response = await fetch('https://api.digiflazz.com/v1/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });

    const resData = await response.json();
    return {
      payload,
      response: resData
    };
  }

  /**
   * Resolve appropriate Digiflazz buyer_sku_code based on order details
   */
  resolveBuyerSku(order) {
    if (order.buyer_sku_code) return order.buyer_sku_code;
    const prodId = String(order.product_id || '').trim();
    if (/^(ml\d+|mlweek|xld\d+|ff\d+|valo\d+|vp\d+)$/i.test(prodId)) {
      return prodId.toLowerCase();
    }
    const nama = String(order.nama_item || '').toLowerCase();
    const game = String(order.game || '').toLowerCase();

    if (game === 'mlbb' || nama.includes('mobile legends')) {
      if (nama.includes('weekly') || nama.includes('pass')) return 'mlweek';
      const cleaned = nama.replace(/\(x\d+\)/gi, '').replace(/\./g, '');
      const numMatch = cleaned.match(/(\d+)\s*diamond/i) || cleaned.match(/(?:^|\D)(\d+)(?:\D|$)/);
      if (numMatch && numMatch[1]) {
        return `ml${numMatch[1]}`;
      }
    }

    if (this.isDevelopment()) {
      return 'xld10';
    }

    return prodId || 'ml5';
  }

  /**
   * Reconcile transaction status with Digiflazz using the existing ref_id
   * According to Digiflazz API, calling with the same ref_id returns current status without duplicate charging
   */
  async reconcileTransaction(order) {
    const customerNo = order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : order.riot_id;
    return await this.requestTransaction({
      buyer_sku_code: this.resolveBuyerSku(order),
      customer_no: customerNo,
      ref_id: order.invoice_number
    });
  }

  /**
   * Process order to Digiflazz or simulate top up
   */
  async processTopup(order) {
    if (!this.isConfigured()) {
      // Simulate fast network latency when not configured
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        success: true,
        sn: `SN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        message: 'Top up berhasil diproses (Simulasi).',
        raw: {
          ref_id: order.invoice_number,
          status: 'Sukses',
          buyer_sku_code: this.resolveBuyerSku(order),
          customer_no: order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : order.riot_id
        }
      };
    }

    const customerNo = order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : order.riot_id;
    const isDev = this.isDevelopment();

    // Di mode development sandbox Digiflazz, customer_no non-test akan berstatus 'Pending' terus.
    // Jika customer_no bukan format test 0878..., gunakan 087800001230 agar sandbox merespons 'Sukses' (RC: 00)
    const sendCustomerNo = (isDev && (!customerNo || !String(customerNo).startsWith('08780000123')))
      ? '087800001230'
      : customerNo;

    // Resolve buyer_sku_code
    const sendBuyerSku = this.resolveBuyerSku(order);

    try {
      const { payload, response: resData } = await this.requestTransaction({
        buyer_sku_code: sendBuyerSku,
        customer_no: sendCustomerNo,
        ref_id: order.digiflazz_ref_id || order.invoice_number
      });

      const status = resData.data?.status;

      if (status === 'Sukses') {
        return {
          success: true,
          sn: resData.data.sn,
          message: resData.data.message || 'Sukses',
          raw: resData
        };
      } else if (status === 'Pending') {
        return {
          success: true,
          pending: true,
          sn: resData.data?.sn || '',
          message: resData.data?.message || 'Transaksi Pending di Provider',
          raw: resData
        };
      } else {
        const rc = resData.data?.rc;
        const msg = resData.data?.message || resData.message || '';
        let errorMsg = msg;

        // Jika berjalan di Serverless (Vercel) dengan IP dinamis yang belum ter-whitelist,
        // tunda pemrosesan agar tidak langsung menandai Gagal dan biarkan worker ber-IP whitelist memprosesnya
        if (process.env.VERCEL && (/ip anda tidak kami kenali/i.test(msg) || rc === '42')) {
          console.warn(`[DIGIFLAZZ DEFER] Serverless dynamic IP terdeteksi (${msg}). Menjaga status Diproses untuk worker IP Whitelist.`);
          return {
            success: true,
            pending: true,
            deferredToWorker: true,
            sn: '',
            message: 'Menunggu eksekusi otomatis oleh worker H2H ber-IP Whitelist',
            raw: resData
          };
        }

        // Pemetaan resmi Response Code Digiflazz
        if (rc === '40') {
          errorMsg = `Kesalahan format parameter/payload pesanan (RC: 40 - ${msg || 'Payload Error'})`;
        } else if (rc === '41') {
          errorMsg = /signature/i.test(msg)
            ? `Signature API Digiflazz tidak valid, periksa Production Key (RC: 41 - ${msg})`
            : `Buyer SKU Code / Signature tidak valid (RC: 41 - ${msg || 'SKU/Signature Invalid'})`;
        } else if (rc === '42' || /ip anda tidak kami kenali/i.test(msg)) {
          errorMsg = `IP Server belum terdaftar di IP Whitelist Digiflazz (RC: ${rc || '45'} - ${msg})`;
        } else if (rc === '43') {
          errorMsg = `SKU produk sedang gangguan atau tidak aktif di provider (RC: 43 - ${msg || 'SKU Gangguan/Tidak Aktif'})`;
        } else if (rc === '44') {
          errorMsg = `Saldo deposit Digiflazz tidak mencukupi (RC: 44 - ${msg || 'Saldo Kurang'})`;
        } else if (['50', '54', '56'].includes(rc) || /tujuan salah|tidak ditemukan|invalid customer|nomor tidak terdaftar|region|salah/i.test(msg)) {
          errorMsg = `ID Akun Game / Server tidak ditemukan atau tidak sesuai region (RC: ${rc || '54'} - ${msg || 'Tujuan Salah'})`;
        } else if (rc === '02') {
          errorMsg = `Transaksi Gagal dari Provider Digiflazz (RC: 02 - ${msg || 'Gagal'})`;
        } else if (rc === '49' || rc === '53') {
          errorMsg = `Duplikasi transaksi ref_id (RC: ${rc} - ${msg || 'Duplicate'})`;
        } else {
          errorMsg = rc ? `Gagal dari provider game (RC: ${rc} - ${msg || 'Transaksi Gagal'})` : (msg || 'Gagal memproses transaksi di provider game');
        }

        const err = new Error(errorMsg);
        err.rc = rc;
        err.raw = resData;
        throw err;
      }
    } catch (err) {
      // Tangani timeout tanpa langsung menganggap transaksi gagal permanen
      if (err.name === 'TimeoutError' || err.name === 'AbortError' || /timeout|econnreset|etimedout/i.test(err.message)) {
        console.warn(`[DIGIFLAZZ TIMEOUT] Transaksi ${order.invoice_number} timeout. Status belum pasti, ditandai pending.`);
        return {
          success: true,
          pending: true,
          message: 'Koneksi ke Digiflazz timeout. Transaksi berstatus pending menunggu konfirmasi callback/rekonsiliasi.',
          raw: { status: 'Pending', timeout: true }
        };
      }
      throw err;
    }
  }
}

module.exports = new TopupProviderService();

