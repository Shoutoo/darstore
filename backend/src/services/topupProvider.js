const crypto = require('crypto');

/**
 * Top Up Game Provider Service
 * Implements Digiflazz API specification with auto-simulation fallback.
 */
class TopupProviderService {
  constructor() {
    this.username = process.env.DIGIFLAZZ_USERNAME || 'darsstore';
    this.apiKey = process.env.DIGIFLAZZ_KEY || 'dev_digiflazz_key';
    this.isSandbox = process.env.NODE_ENV !== 'production' || !process.env.DIGIFLAZZ_KEY;
  }

  /**
   * Process order to Digiflazz or simulate top up
   */
  async processTopup(order) {
    if (this.isSandbox) {
      // Simulate fast network latency (500ms - 1500ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        success: true,
        sn: `SN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        message: 'Top up berhasil diproses ke akun game.',
        raw: {
          ref_id: order.invoice_number,
          status: 'Sukses',
          buyer_sku_code: order.product_id,
          customer_no: order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : order.riot_id
        }
      };
    }

    // Live Digiflazz API call
    const sign = crypto.createHash('md5').update(`${this.username}${this.apiKey}${order.invoice_number}`).digest('hex');
    const customerNo = order.game === 'mlbb' ? `${order.game_user_id}${order.server_id}` : order.riot_id;

    try {
      const response = await fetch('https://api.digiflazz.com/v1/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          buyer_sku_code: order.product_id,
          customer_no: customerNo,
          ref_id: order.invoice_number,
          sign: sign
        })
      });

      const resData = await response.json();
      const status = resData.data?.status;

      if (status === 'Sukses') {
        return {
          success: true,
          sn: resData.data.sn,
          message: resData.data.message || 'Sukses',
          raw: resData
        };
      } else {
        throw new Error(resData.data?.message || 'Gagal memproses topup provider');
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = new TopupProviderService();
