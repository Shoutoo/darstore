const crypto = require('crypto');

/**
 * Top Up Game Provider Service
 * Implements Digiflazz API specification with auto-simulation fallback.
 */
class TopupProviderService {
  getUsername() {
    return process.env.DIGIFLAZZ_USERNAME || 'tuwumiWXAdqg';
  }

  getApiKey() {
    return process.env.DIGIFLAZZ_KEY || 'dev-b8bd5f40-d97c-11ef-8d09-333896381645';
  }

  isDevelopment() {
    const key = this.getApiKey();
    return key.startsWith('dev-') || process.env.DIGIFLAZZ_MODE === 'development';
  }

  isConfigured() {
    const username = this.getUsername();
    const key = this.getApiKey();
    return Boolean(username && key && username !== 'your_digiflazz_username');
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

    try {
      const { payload, response: resData } = await this.requestTransaction({
        buyer_sku_code: order.product_id,
        customer_no: customerNo,
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

