const crypto = require('crypto');
const { dbAsync } = require('../config/db');
const paymentGateway = require('../services/paymentGateway');
const orderQueue = require('../jobs/processOrderQueue');

function isProductionEnv() {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase().trim();
  const midtransProd = (process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase().trim();
  return nodeEnv === 'production' || vercelEnv === 'production' || midtransProd === 'true';
}

function sanitizePayload(data) {
  if (!data || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitivePatterns = /password|secret|server_key|token|cvv|card_number|auth/i;
  for (const key of Object.keys(sanitized)) {
    if (sensitivePatterns.test(key)) {
      sanitized[key] = '***MASKED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizePayload(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Handle Midtrans Webhook Notification
 * Endpoint: POST /api/webhook/payment
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id
    } = body;

    const invoiceNumber = order_id || body.merchant_ref;

    // Midtrans test probe tanpa invoice number
    if (!invoiceNumber) {
      console.log('[WEBHOOK] Test ping tanpa invoice number diterima dari Midtrans. Menjawab 200 OK.');
      return res.status(200).json({ status: 'ok', message: 'Test ping acknowledged' });
    }

    // 1. Verifikasi signature SHA-512 secara ketat (tanpa bypass)
    const isValidSignature = paymentGateway.verifyWebhookSignature(body, req.headers['x-signature']);
    if (!isValidSignature) {
      console.warn(`[WEBHOOK SECURITY] Signature tidak valid untuk pesanan ${invoiceNumber}`);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // 2. Cari order di database
    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [invoiceNumber.trim().toUpperCase()]
    );

    if (!order) {
      console.warn(`[WEBHOOK] Order ${invoiceNumber} tidak ditemukan di database.`);
      return res.status(404).json({ error: 'Order not found in database' });
    }

    // 3. Verifikasi nominal pembayaran (mencegah manipulasi nominal)
    const receivedAmount = Math.round(Number(gross_amount));
    const expectedAmount = Math.round(Number(order.total_harga));
    if (isNaN(receivedAmount) || receivedAmount !== expectedAmount) {
      console.error(`[WEBHOOK SECURITY ALERT] Nominal mismatch untuk invoice ${order.invoice_number}: Midtrans=${receivedAmount}, DB=${expectedAmount}`);
      try {
        await dbAsync.run(
          `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
          [
            order.id,
            transaction_id || 'UNKNOWN',
            'amount_mismatch',
            JSON.stringify({ error: 'Nominal tidak sesuai', receivedAmount, expectedAmount })
          ]
        );
      } catch (_) {}
      return res.status(400).json({ error: 'Gross amount mismatch' });
    }

    // 4. Cegah perubahan status mundur & Idempotensi
    if (order.status === 'Berhasil') {
      return res.status(200).json({ message: 'Pesanan sudah berstatus Berhasil (Idempoten)' });
    }
    if (order.status === 'Diproses' && (transaction_status === 'settlement' || transaction_status === 'capture')) {
      return res.status(200).json({ message: 'Pesanan sedang diproses di antrean (Idempoten)' });
    }

    // 5. Catat log transaksi yang telah disanitasi ke payment_logs
    try {
      const safeLog = sanitizePayload(body);
      await dbAsync.run(
        `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
        [
          order.id,
          transaction_id || req.body.reference || 'MIDTRANS_NOTIFICATION',
          transaction_status || req.body.status || 'UNKNOWN',
          JSON.stringify(safeLog)
        ]
      );
    } catch (logErr) {
      console.warn('Payment log write error in webhook:', logErr.message);
    }

    // 6. Mapping status Midtrans secara aman dan atomik
    if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept')) {
      console.log(`[WEBHOOK] Payment confirmed (${transaction_status}) for invoice ${order.invoice_number}`);

      // Mekanisme atomik: Update ke 'Diproses' hanya jika status saat ini masih 'Menunggu Pembayaran' / 'pending'
      // Ini mencegah race condition jika Midtrans mengirim 2 webhook bersamaan
      const updateResult = await dbAsync.run(
        `UPDATE orders SET status = 'Diproses', payment_ref = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending')`,
        [transaction_id || order.payment_ref, order.id]
      );

      if (updateResult.changes === 0) {
        console.log(`[WEBHOOK] Order ${order.invoice_number} sudah diproses oleh request bersamaan. Melewati enqueue ganda.`);
        return res.status(200).json({ message: 'Sudah diproses oleh request bersamaan' });
      }

      // Picu pemenuhan produk digital Digiflazz melalui queue
      await orderQueue.enqueue({
        ...order,
        payment_ref: transaction_id || order.payment_ref,
        status: 'Diproses'
      });
    } else if (transaction_status === 'capture' && fraud_status === 'challenge') {
      console.warn(`[WEBHOOK] Transaksi kartu kredit berstatus challenge untuk invoice ${order.invoice_number}. Menunggu keputusan.`);
      // Tetap berstatus Menunggu Pembayaran
    } else if (['expire', 'deny', 'cancel'].includes(transaction_status)) {
      console.log(`[WEBHOOK] Payment failed/expired (${transaction_status}) for invoice ${order.invoice_number}`);

      const failResult = await dbAsync.run(
        `UPDATE orders SET status = 'Gagal', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending')`,
        [`Midtrans: Pembayaran ${transaction_status}`, order.id]
      );

      // Refund poin secara atomik dan idempoten (hanya sekali jika points_refunded masih 0)
      if (failResult.changes > 0 && order.user_id && order.points_used > 0) {
        const refundClaim = await dbAsync.run(
          `UPDATE orders SET points_refunded = 1 WHERE id = ? AND (points_refunded = 0 OR points_refunded IS NULL)`,
          [order.id]
        );
        if (refundClaim.changes > 0) {
          await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [order.points_used, order.user_id]);
          await dbAsync.run(
            `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
            [
              order.user_id,
              order.id,
              order.points_used,
              `[REFUND] Pengembalian ${order.points_used} poin karena pesanan ${order.invoice_number} ${transaction_status}`
            ]
          );
          console.log(`[LOYALTY] Refunded ${order.points_used} points to user ID ${order.user_id} for failed/expired order ${order.invoice_number}`);
        }
      }
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
 * Ketentuan: Terlarang di production (mengembalikan 404). Tidak memicu Digiflazz nyata.
 */
exports.simulatePayment = async (req, res) => {
  try {
    // 1. Tolak jika di environment production
    if (isProductionEnv()) {
      return res.status(404).json({
        success: false,
        message: 'Endpoint simulasi tidak tersedia pada environment production.'
      });
    }

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

    if (order.status === 'Berhasil') {
      return res.json({
        success: true,
        message: 'Pesanan ini sudah berhasil sebelumnya.',
        order
      });
    }

    const simSN = `SIM-SN-${Date.now()}`;

    // Catat payment log simulasi
    await dbAsync.run(
      `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
      [
        order.id,
        `SIM-MID-${Date.now()}`,
        'settlement',
        JSON.stringify({ simulated: true, provider: 'simulator_dev', at: new Date().toISOString() })
      ]
    );

    // Tandai langsung status order jadi 'Berhasil' dengan serial number simulasi
    // JANGAN panggil orderQueue atau Digiflazz live API agar saldo tidak terpotong nyata
    await dbAsync.run(
      `UPDATE orders SET status = 'Berhasil', sn = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [simSN, order.id]
    );

    // Tambahkan reward poin loyalitas jika pengguna terdaftar (secara idempoten)
    if (order.user_id) {
      const RUPIAH_PER_POINT = parseInt(process.env.RUPIAH_PER_POINT || '10000', 10);
      const pointsToAward = Math.floor(order.total_harga / RUPIAH_PER_POINT);
      if (pointsToAward > 0) {
        const claim = await dbAsync.run(
          `UPDATE orders SET points_awarded = 1 WHERE id = ? AND (points_awarded = 0 OR points_awarded IS NULL)`,
          [order.id]
        );
        if (claim.changes > 0) {
          await dbAsync.run(
            `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
            [order.user_id, order.id, pointsToAward, `Reward top up ${order.nama_item} (${order.invoice_number}) (Simulasi)`]
          );
          await dbAsync.run(`UPDATE users SET points = points + ? WHERE id = ?`, [pointsToAward, order.user_id]);
          console.log(`[SIMULASI] Awarded ${pointsToAward} points to user ${order.user_id}`);
        }
      }
    }

    const updatedOrder = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [order.id]);

    return res.json({
      success: true,
      message: 'Pembayaran berhasil disimulasikan (Mode Development). Diamond/Points dialokasikan.',
      order: updatedOrder
    });
  } catch (err) {
    console.error('Simulate payment error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mensimulasikan pembayaran.' });
  }
};

/**
 * Handle Digiflazz Webhook Callback
 * Endpoint: POST /api/webhook/digiflazz
 */
exports.handleDigiflazzWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const data = body.data || body;
    console.log('[DIGIFLAZZ WEBHOOK] Received callback:', JSON.stringify(data));

    const refId = data.ref_id;
    if (!refId) {
      return res.status(200).json({ status: 'ok', message: 'Ping acknowledged' });
    }

    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [refId.trim().toUpperCase()]
    );

    if (!order) {
      console.log(`[DIGIFLAZZ WEBHOOK] Order ${refId} not found in DB`);
      return res.status(200).json({ status: 'ok', message: 'Order unmapped' });
    }

    const status = data.status; // 'Sukses', 'Gagal', 'Pending'
    if (status === 'Sukses') {
      // Idempotent update: update only if not already Berhasil
      const succRes = await dbAsync.run(
        `UPDATE orders SET status = 'Berhasil', sn = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'Berhasil'`,
        [data.sn || null, order.id]
      );
      console.log(`[DIGIFLAZZ WEBHOOK] Order ${order.invoice_number} marked as Berhasil (SN: ${data.sn})`);

      // Kirim email receipt
      try {
        const emailService = require('../services/emailService');
        await emailService.sendOrderReceipt(order, { sn: data.sn, message: data.message || 'Sukses' });
      } catch (mailErr) {
        console.warn(`[DIGIFLAZZ WEBHOOK] Warning email receipt:`, mailErr.message);
      }

      // Berikan reward poin jika ada user_id secara idempoten
      if (order.user_id && succRes.changes > 0) {
        const RUPIAH_PER_POINT = parseInt(process.env.RUPIAH_PER_POINT || '10000', 10);
        const pointsToAward = Math.floor(order.total_harga / RUPIAH_PER_POINT);
        if (pointsToAward > 0) {
          const claim = await dbAsync.run(
            `UPDATE orders SET points_awarded = 1 WHERE id = ? AND (points_awarded = 0 OR points_awarded IS NULL)`,
            [order.id]
          );
          if (claim.changes > 0) {
            await dbAsync.run(
              `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
              [order.user_id, order.id, pointsToAward, `Reward top up ${order.nama_item} (${order.invoice_number})`]
            );
            await dbAsync.run(`UPDATE users SET points = points + ? WHERE id = ?`, [pointsToAward, order.user_id]);
            console.log(`[DIGIFLAZZ WEBHOOK] Awarded ${pointsToAward} points to user ${order.user_id}`);
          }
        }
      }
    } else if (status === 'Gagal') {
      const failRes = await dbAsync.run(
        `UPDATE orders SET status = 'Gagal', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status NOT IN ('Gagal', 'Berhasil')`,
        [data.message || 'Gagal dari provider Digiflazz', order.id]
      );
      console.log(`[DIGIFLAZZ WEBHOOK] Order ${order.invoice_number} marked as Gagal: ${data.message}`);

      // Refund used points secara idempoten
      if (failRes.changes > 0 && order.user_id && order.points_used > 0) {
        const refundClaim = await dbAsync.run(
          `UPDATE orders SET points_refunded = 1 WHERE id = ? AND (points_refunded = 0 OR points_refunded IS NULL)`,
          [order.id]
        );
        if (refundClaim.changes > 0) {
          await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [order.points_used, order.user_id]);
          await dbAsync.run(
            `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
            [order.user_id, order.id, order.points_used, `[REFUND] Pengembalian ${order.points_used} poin karena provider gagal`]
          );
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[DIGIFLAZZ WEBHOOK ERROR]:', err);
    return res.status(500).json({ error: err.message });
  }
};


