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
   * Calculate profit margin strictly within Rp 200 .. Rp 2.500
   */
  calculateProfitMargin(modal, opts = {}) {
    const cost = Math.max(0, Number(modal) || 0);
    if (opts.isSmallest3Dm) return 200;
    if (cost <= 2500) return 250;
    if (cost <= 3500) return 300;
    if (cost <= 5000) return 350;
    if (cost <= 10000) return 450;
    if (cost <= 12000) return 550;
    if (cost <= 15000) return 600;
    if (cost <= 25000) return 800;
    if (cost <= 40000) return 1000;
    if (cost <= 75000) return 1200;
    if (cost <= 125000) return 1500;
    if (cost <= 200000) return 1800;
    if (cost <= 300000) return 2200;
    return 2500;
  }

  /**
   * Fetch live prepaid price list from Digiflazz
   * Endpoint: POST https://api.digiflazz.com/v1/price-list
   */
  async fetchPriceList() {
    const username = this.getUsername();
    const apiKey = this.getApiKey();
    const sign = crypto.createHash('md5').update(`${username}${apiKey}pricelist`).digest('hex');

    const response = await fetch('https://api.digiflazz.com/v1/price-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'prepaid',
        username,
        sign
      }),
      signal: AbortSignal.timeout(15000)
    });

    const resData = await response.json();
    if (!Array.isArray(resData?.data)) {
      const msg = resData?.data?.message || resData?.message || 'Gagal mengambil daftar harga Digiflazz';
      const err = new Error(msg);
      err.rc = resData?.data?.rc;
      err.raw = resData;
      throw err;
    }
    return resData.data;
  }

  /**
   * Resolve appropriate Digiflazz buyer_sku_code based on order details
   */
  resolveBuyerSku(order) {
    if (order.buyer_sku_code) return order.buyer_sku_code;
    const prodId = String(order.product_id || '').trim();
    if (/^(ml\d+|mlweek|mltwilight|xld\d+|ff\d+|valo-?\d+|vp-?\d+)$/i.test(prodId)) {
      return prodId.toLowerCase();
    }
    const nama = String(order.nama_item || '').toLowerCase();
    const game = String(order.game || '').toLowerCase();

    if (game === 'mlbb' || nama.includes('mobile legends')) {
      const wpMatch = nama.match(/weekly\s+diamond\s+pass(?:\s*(\d+)x)?/i);
      if (wpMatch) {
        const mult = wpMatch[1] ? Number(wpMatch[1]) : 1;
        return mult > 1 ? `mlweek${mult}` : 'mlweek';
      }
      if (nama.includes('weekly') && nama.includes('elite')) return 'mlweeklyelite';
      if (nama.includes('monthly') && nama.includes('epic')) return 'mlmonthlyepic';
      if (nama.includes('twilight')) return 'mltwilight';
      if (nama.includes('super value pass')) return 'mlsupervalue';
      if (nama.includes('coupon pass')) return 'mlcouponpass';
      if (nama.includes('starlight') || nama.includes('startlight')) {
        if (nama.includes('plus')) return 'mlstarplus';
        const comboDm = nama.match(/(\d+)\s*diamonds?\s*\+/i);
        return comboDm ? `mlstar${comboDm[1]}` : 'mlstar';
      }
      const cleaned = nama.replace(/\(x\d+\)/gi, '').replace(/\./g, '');
      const bundleMatch = cleaned.match(/bundle\s+(\d+)\s*\+\s*(\d+)\s*diamonds?/i);
      if (bundleMatch) {
        return `ml${Number(bundleMatch[1]) + Number(bundleMatch[2])}`;
      }
      const numMatch = cleaned.match(/(\d+)\s*diamonds?/i) || cleaned.match(/(?:^|\D)(\d+)(?:\D|$)/);
      if (numMatch && numMatch[1]) {
        return `ml${numMatch[1]}`;
      }
    }

    if (game === 'valorant' || nama.includes('valorant')) {
      const skuPrefix = (process.env.DIGIFLAZZ_VALO_SKU_PREFIX || 'valo-').trim().toLowerCase();
      if (order.nominal && /^\d+$/.test(String(order.nominal).trim())) {
        return `${skuPrefix}${String(order.nominal).trim()}`;
      }
      const cleaned = nama.replace(/\(x\d+\)/gi, '').replace(/\./g, '');
      const vpMatch = cleaned.match(/(\d+)\s*(?:valorant\s*)?(?:points?|vp)\b/i) || cleaned.match(/(?:^|\D)(\d+)(?:\D|$)/);
      if (vpMatch && vpMatch[1]) {
        return `${skuPrefix}${vpMatch[1]}`;
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
    const cleanRiotId = order.game === 'valorant'
      ? String(order.riot_id || '').split('#').map(s => s.trim()).join('#')
      : order.riot_id;
    const customerNo = order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : cleanRiotId;
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
    const normalizedRiotId = order.game === 'valorant'
      ? String(order.riot_id || '').split('#').map(s => s.trim()).join('#')
      : order.riot_id;

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
          customer_no: order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : normalizedRiotId
        }
      };
    }

    const customerNo = order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : normalizedRiotId;
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

        // Jika IP pemanggil (Serverless Vercel maupun jaringan lokal yang berganti IP dinamis)
        // belum terdaftar di Whitelist IP Digiflazz, jaga status tetap 'Diproses' agar otomatis
        // tereksekusi begitu IP Whitelist diperbarui tanpa menggagalkan pesanan yang sudah dibayar
        if (/ip anda tidak kami kenali/i.test(msg) || rc === '42') {
          console.warn(`[DIGIFLAZZ DEFER] IP belum ter-whitelist di Digiflazz (${msg}). Menjaga status Diproses untuk retry otomatis.`);
          return {
            success: true,
            pending: true,
            deferredToWorker: true,
            ipNotWhitelisted: true,
            sn: '',
            message: msg || 'Menunggu eksekusi otomatis oleh worker H2H ber-IP Whitelist',
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

