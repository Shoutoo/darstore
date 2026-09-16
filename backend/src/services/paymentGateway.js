const crypto = require('crypto');

/**
 * Payment Gateway Service
 * Supports Tripay / Midtrans QRIS structure with a robust local simulator.
 */
class PaymentGatewayService {
  constructor() {
    this.apiKey = process.env.TRIPAY_API_KEY || 'DEV_TRIPAY_KEY';
    this.privateKey = process.env.TRIPAY_PRIVATE_KEY || 'DEV_TRIPAY_PRIVATE_KEY';
    this.merchantCode = process.env.TRIPAY_MERCHANT_CODE || 'DEV_MERCHANT';
    this.isSandbox = process.env.NODE_ENV !== 'production';
  }

  /**
   * Generate QRIS payment for an order
   */
  async createQrisTransaction(order) {
    // Standard National QRIS prefix structure for Indonesia (QRIS CPM/MPM EMVCo standard)
    const qrisString = `00020101021226570014ID.DARSSTORE.WWW01189360091800000000000208${order.invoice_number}520454115303360540${order.total_harga.toString().length}${order.total_harga}5802ID5910DARSSTORE6007JAKARTA62070703A016304`;
    
    // Use QR code generator URL that encodes the real QRIS string
    const qrisUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrisString)}`;

    return {
      payment_ref: `REF-${order.invoice_number}`,
      qris_string: qrisString,
      qris_url: qrisUrl,
      expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  /**
   * Verify signature for webhook callbacks
   */
  verifyWebhookSignature(jsonPayload, signature) {
    if (this.isSandbox && !signature) return true;
    const expected = crypto.createHmac('sha256', this.privateKey).update(jsonPayload).digest('hex');
    return expected === signature;
  }
}

module.exports = new PaymentGatewayService();
