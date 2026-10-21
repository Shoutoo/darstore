const { dbAsync } = require('../config/db');
const topupProvider = require('../services/topupProvider');
const emailService = require('../services/emailService');

// Points ratio: Rp 10.000 = 1 Point
const RUPIAH_PER_POINT = parseInt(process.env.RUPIAH_PER_POINT || '10000', 10);

class OrderQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  async enqueue(order) {
    this.queue.push({
      order,
      attempts: 0,
      maxAttempts: 3
    });
    return await this.processNext();
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const task = this.queue.shift();
    const { order } = task;

    try {
      task.attempts++;
      console.log(`[QUEUE] Processing order ${order.invoice_number} (Attempt ${task.attempts}/${task.maxAttempts})...`);

      // Update status to 'Diproses'
      await dbAsync.run(
        `UPDATE orders SET status = 'Diproses', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [order.id]
      );

      // Call top-up provider
      const result = await topupProvider.processTopup(order);

      if (result.pending) {
        console.log(`[QUEUE] Order ${order.invoice_number} is pending at Digiflazz. Waiting for webhook callback.`);
        if (result.sn) {
          await dbAsync.run(
            `UPDATE orders SET sn = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [result.sn, order.id]
          );
        }
        return;
      }

      // Success! Update order to 'Berhasil' with SN
      await dbAsync.run(
        `UPDATE orders SET status = 'Berhasil', sn = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [result.sn || null, order.id]
      );

      console.log(`[QUEUE] Order ${order.invoice_number} completed successfully with SN: ${result.sn}`);

      // Kirim struk bukti transaksi digital via Email
      try {
        await emailService.sendOrderReceipt(order, result);
      } catch (mailErr) {
        console.warn(`[EMAIL] Peringatan pengiriman struk email untuk ${order.invoice_number}:`, mailErr.message);
      }

      // If user is registered, award loyalty points
      if (order.user_id) {
        const pointsToAward = Math.floor(order.total_harga / RUPIAH_PER_POINT);
        if (pointsToAward > 0) {
          // Add to point history
          await dbAsync.run(
            `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
            [
              order.user_id,
              order.id,
              pointsToAward,
              `Reward top up ${order.nama_item} (${order.invoice_number})`
            ]
          );

          // Update user total points
          await dbAsync.run(
            `UPDATE users SET points = points + ? WHERE id = ?`,
            [pointsToAward, order.user_id]
          );

          console.log(`[LOYALTY] Awarded ${pointsToAward} points to user ID ${order.user_id} for order ${order.invoice_number}`);
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Gagal memproses ke provider game.';
      console.error(`[QUEUE] Error processing order ${order.invoice_number}:`, errorMsg);

      // Detect fatal non-retryable errors from provider (e.g. region mismatch, invalid account, rejected, RC 40, RC 02)
      const isFatal = /rc:\s*(40|02|41|42)|region|tujuan salah|user id salah|invalid customer|tidak ditemukan|saldo tidak cukup|nomor tidak terdaftar|blocked|unauthorized/i.test(errorMsg);

      if (task.attempts < task.maxAttempts && !isFatal) {
        console.log(`[QUEUE] Re-queueing order ${order.invoice_number} for retry (Attempt ${task.attempts}/${task.maxAttempts})...`);
        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, 2000 * task.attempts);
      } else {
        console.error(`[QUEUE] Order ${order.invoice_number} permanently failed. Marking as 'Gagal'. Reason: ${errorMsg}`);
        await dbAsync.run(
          `UPDATE orders SET status = 'Gagal', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [errorMsg, order.id]
        );

        // Refund point loyalitas jika customer menggunakan poin
        if (order.user_id && order.points_used > 0) {
          try {
            await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [order.points_used, order.user_id]);
            await dbAsync.run(
              `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
              [
                order.user_id,
                order.id,
                order.points_used,
                `[REFUND] Pengembalian ${order.points_used} poin karena pesanan ${order.invoice_number} gagal (${errorMsg})`
              ]
            );
            console.log(`[LOYALTY] Refunded ${order.points_used} points to user ${order.user_id} for order ${order.invoice_number}`);
          } catch (refundErr) {
            console.warn('[LOYALTY REFUND ERROR]:', refundErr.message);
          }
        }

        // Kirim email notifikasi kegagalan pesanan ke customer
        try {
          await emailService.sendOrderFailedNotice(order, errorMsg);
        } catch (mailErr) {
          console.warn('[EMAIL SERVICE] Gagal kirim email kegagalan pesanan:', mailErr.message);
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }
}

module.exports = new OrderQueue();
