const crypto = require('crypto');
const { dbAsync } = require('../config/db');
const paymentGateway = require('../services/paymentGateway');
const orderQueue = require('../jobs/processOrderQueue');

/**
 * Handle Midtrans Webhook Notification
 * Endpoint: POST /api/webhook/payment
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id
    } = req.body;

    const invoiceNumber = order_id || req.body.merchant_ref;

    if (!invoiceNumber) {
      return res.status(400).json({ error: 'Missing order_id or invoice number' });
    }

    // 1. Verifikasi signature SHA-512 (WAJIB)
    const isValidSignature = paymentGateway.verifyWebhookSignature(req.body, req.headers['x-signature']);
    if (!isValidSignature) {
      console.warn(`[WEBHOOK] Invalid signature for order ${invoiceNumber}`);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Cari order di database
    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [invoiceNumber.trim().toUpperCase()]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    // 2. Idempotency — kalau order sudah diproses sebelumnya (bukan pending/menunggu pembayaran),
    // jangan proses ulang, balas OK supaya Midtrans berhenti retry
    const isPending = order.status === 'Menunggu Pembayaran' || order.status === 'pending';
    if (!isPending) {
      return res.status(200).json({ message: 'Sudah diproses sebelumnya' });
    }

    // 3. Catat log mentah untuk audit ke payment_logs
    try {
      await dbAsync.run(
        `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
        [
          order.id,
          transaction_id || req.body.reference || 'MIDTRANS_NOTIFICATION',
          transaction_status || req.body.status || 'UNKNOWN',
          JSON.stringify(req.body)
        ]
      );
    } catch (logErr) {
      console.warn('Payment log write error in webhook:', logErr.message);
    }

    // 4. Mapping status Midtrans -> status order kita
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      console.log(`[WEBHOOK] Payment confirmed (${transaction_status}) for invoice ${order.invoice_number}`);
      
      // Update payment_ref dari Midtrans transaction_id
      if (transaction_id) {
        await dbAsync.run(
          `UPDATE orders SET payment_ref = ? WHERE id = ?`,
          [transaction_id, order.id]
        );
      }

      // Picu proses pengiriman item top up ke akun game via background queue
      // Worker queue akan otomatis mengupdate status jadi 'Diproses' -> 'Berhasil'
      // dan menambahkan poin loyalitas ke akun pengguna jika ada user_id.
      orderQueue.enqueue(order);
    } else if (['expire', 'deny', 'cancel'].includes(transaction_status)) {
      console.log(`[WEBHOOK] Payment failed/expired (${transaction_status}) for invoice ${order.invoice_number}`);
      await dbAsync.run(
        `UPDATE orders SET status = 'Gagal', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [`Midtrans: Pembayaran ${transaction_status}`, order.id]
      );
    } else {
      console.log(`[WEBHOOK] Status ${transaction_status} received for invoice ${order.invoice_number}. Order remains pending.`);
    }

    return res.status(200).json({ message: 'OK' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal server error in webhook handler', detail: err.message });
  }
};

/**
 * Simulator lokal untuk uji coba alur pembayaran di development
 * Endpoint: POST /api/webhook/simulate-payment
 */
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
      [
        order.id,
        `SIM-MID-${Date.now()}`,
        'settlement',
        JSON.stringify({ simulated: true, provider: 'midtrans_simulator', at: new Date().toISOString() })
      ]
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
