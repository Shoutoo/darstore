const crypto = require('crypto');
const midtransClient = require('midtrans-client');

/**
 * Midtrans Payment Gateway Service (QRIS Only)
 * Implements Midtrans CoreApi charge for QRIS payment_type.
 */
class PaymentGatewayService {
  constructor() {
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-xxxxxxxxxxxxx';
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxxxxxxxxxx';
    this.coreApi = new midtransClient.CoreApi({
      isProduction: this.isProduction,
      serverKey: this.serverKey,
      clientKey: this.clientKey,
    });
  }

  /**
   * Reload configuration if environment variables change
   */
  reloadConfig() {
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-xxxxxxxxxxxxx';
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxxxxxxxxxx';
    this.coreApi = new midtransClient.CoreApi({
      isProduction: this.isProduction,
      serverKey: this.serverKey,
      clientKey: this.clientKey,
    });
  }

  /**
   * Charge Midtrans Core API with payment_type: 'qris'
   * @param {Object} order - { invoice_number, total_harga, ... }
   */
  async createQrisTransaction(order) {
    this.reloadConfig();
    const isMock = !this.serverKey || this.serverKey.includes('xxxxxxxxxxxxx');

    if (isMock) {
      console.log(`[MIDTRANS] Dev Mode (Mock): Server key not configured. Generating simulated QRIS transaction for ${order.invoice_number}`);
      const mockRef = `MID-MOCK-${Date.now()}`;
      const mockQrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('MOCK_QRIS_' + order.invoice_number)}`;
      const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      return {
        payment_ref: mockRef,
        qris_string: `00020101021226570014ID.DARSSTORE.WWW01189360091800000000000208${order.invoice_number}520454115303360540${order.total_harga.toString().length}${order.total_harga}5802ID5910DARSSTORE6007JAKARTA62070703A016304`,
        qris_url: mockQrisUrl,
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

    // Live Midtrans Core API Call
    const chargeResponse = await this.coreApi.charge({
      payment_type: 'qris',
      transaction_details: {
        order_id: order.invoice_number,
        gross_amount: Math.round(Number(order.total_harga)),
      },
      qris: {
        acquirer: 'gopay', // acquirer default
      },
      custom_expiry: {
        expiry_duration: 15,
        unit: 'minute',
      },
    });

    // Extract QR code URL from Midtrans actions array
    const qrAction = Array.isArray(chargeResponse.actions)
      ? chargeResponse.actions.find((a) => a.name === 'generate-qr-code')
      : null;

    const qrCodeUrl = qrAction ? qrAction.url : (chargeResponse.qr_string ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(chargeResponse.qr_string)}` : null);

    return {
      payment_ref: chargeResponse.transaction_id,
      qris_string: chargeResponse.qr_string || null,
      qris_url: qrCodeUrl,
      expired_at: chargeResponse.expiry_time || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      raw_response: chargeResponse,
    };
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
}

module.exports = new PaymentGatewayService();
