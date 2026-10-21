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
      return process.env.DIGIFLAZZ_PROD_KEY || process.env.DIGIFLAZZ_KEY || '0b367413-6219-533c-8602-515ee3d45e31';
    }
    return process.env.DIGIFLAZZ_DEV_KEY || process.env.DIGIFLAZZ_KEY || 'dev-dd8fea20-cd56-11f1-9889-539063f8d4ac';
  }

  isDevelopment() {
    const key = this.getApiKey();
    return key.startsWith('dev-') || process.env.DIGIFLAZZ_MODE !== 'production';
  }

  isConfigured() {
    const username = this.getUsername();
    const key = this.getApiKey();
    return Boolean(username && key && username !== 'your_digiflazz_username');
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
      body: JSON.stringify(payload)
    });

    const resData = await response.json();
    return {
      payload,
      response: resData
    };
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
          buyer_sku_code: order.product_id,
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

    // Di mode sandbox dev, SKU internal dapat diteruskan atau difallback ke xld10
    const sendBuyerSku = order.product_id || 'xld10';

    try {
      const { payload, response: resData } = await this.requestTransaction({
        buyer_sku_code: sendBuyerSku,
        customer_no: sendCustomerNo,
        ref_id: order.invoice_number
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
        const errorMsg = resData.data?.message || resData.message || (resData.data?.rc ? `Error provider RC: ${resData.data.rc}` : 'Gagal memproses transaksi di provider game');
        throw new Error(errorMsg);
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = new TopupProviderService();

