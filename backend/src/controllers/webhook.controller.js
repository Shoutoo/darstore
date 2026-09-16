const { dbAsync } = require('../config/db');
const paymentGateway = require('../services/paymentGateway');
const orderQueue = require('../jobs/processOrderQueue');

exports.handlePaymentWebhook = async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-callback-signature'] || req.headers['x-signature'];

    if (!paymentGateway.verifyWebhookSignature(rawBody, signature)) {
      return res.status(403).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const { merchant_ref, status, reference } = req.body;
    const invoiceNumber = merchant_ref || req.body.order_id;

    if (!invoiceNumber) {
      return res.status(400).json({ success: false, message: 'Missing merchant_ref/order_id' });
    }

    const order = await dbAsync.get('SELECT * FROM orders WHERE invoice_number = ?', [invoiceNumber]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Log raw payment response
    await dbAsync.run(
      `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
      [order.id, reference || 'GATEWAY_CALLBACK', status, rawBody]
    );

    // Idempotency: don't re-process if already success
    if (order.status === 'Berhasil' || order.status === 'Diproses') {
      return res.json({ success: true, message: 'Order already processed or in progress' });
    }

    if (status === 'PAID' || status === 'SETTLED' || status === 'SUCCESS') {
      orderQueue.enqueue(order);
    } else if (status === 'EXPIRED' || status === 'FAILED') {
      await dbAsync.run(`UPDATE orders SET status = 'Gagal', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [order.id]);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error in webhook handler' });
  }
};

exports.simulatePayment = async (req, res) => {
  try {
    const { invoice_number } = req.body;
    if (!invoice_number) {
      return res.status(400).json({ success: false, message: 'Nomor invoice diperlukan.' });
    }

    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [invoice_number.trim().toUpperCase()]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    // Log payment
    await dbAsync.run(
      `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
      [order.id, `SIM-${Date.now()}`, 'PAID', JSON.stringify({ simulated: true, at: new Date().toISOString() })]
    );

    if (order.status === 'Berhasil') {
      return res.json({
        success: true,
        message: 'Pesanan ini sudah berhasil sebelumnya.',
        order
      });
    }

    // Enqueue order to process through worker queue
    orderQueue.enqueue(order);

    // Wait slightly for worker simulation to complete so response reflects updated status
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedOrder = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [order.id]);

    return res.json({
      success: true,
      message: 'Pembayaran QRIS berhasil dikonfirmasi! Diamond/Points telah dikirimkan ke akun game.',
      order: updatedOrder
    });
  } catch (err) {
    console.error('Simulate payment error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mensimulasikan pembayaran.' });
  }
};
