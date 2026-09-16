const { dbAsync } = require('../config/db');
const topupProvider = require('../services/topupProvider');

// Points ratio: Rp 10.000 = 1 Point
const RUPIAH_PER_POINT = parseInt(process.env.RUPIAH_PER_POINT || '10000', 10);

class OrderQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(order) {
    this.queue.push({
      order,
      attempts: 0,
      maxAttempts: 3
    });
    this.processNext();
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

      // Success! Update order to 'Berhasil'
      await dbAsync.run(
        `UPDATE orders SET status = 'Berhasil', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [order.id]
      );

      console.log(`[QUEUE] Order ${order.invoice_number} completed successfully with SN: ${result.sn}`);

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
      console.error(`[QUEUE] Error processing order ${order.invoice_number}:`, err.message);

      if (task.attempts < task.maxAttempts) {
        console.log(`[QUEUE] Re-queueing order ${order.invoice_number} for retry...`);
        // Backoff delay before retry
        setTimeout(() => {
          this.queue.push(task);
          this.processNext();
        }, 2000 * task.attempts);
      } else {
        console.error(`[QUEUE] Order ${order.invoice_number} failed after ${task.maxAttempts} attempts. Marking as 'Gagal'.`);
        await dbAsync.run(
          `UPDATE orders SET status = 'Gagal', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [order.id]
        );
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
