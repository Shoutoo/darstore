const { dbAsync } = require('./db');

const isPostgres = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));

/**
 * Unified Database Service Adapter
 * Seamlessly routes queries through dbAsync (PostgreSQL in cloud, SQLite locally)
 */
const dbService = {
  isPostgres: () => isPostgres,
  getPrisma: () => null, // dbAsync handles both Postgres and SQLite directly

  // Products
  async getProducts(game) {
    let sql = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];
    if (game) {
      sql += ' AND game = ?';
      params.push(game);
    }
    sql += ' ORDER BY nominal ASC';
    return await dbAsync.all(sql, params);
  },

  // Orders
  async createOrder(data) {
    const result = await dbAsync.run(
      `INSERT INTO orders (
        invoice_number, user_id, product_id, game, nama_item,
        game_user_id, server_id, riot_id, wa_email_guest,
        status, payment_method, payment_ref, qris_string, qris_url, total_harga
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.invoice_number,
        data.user_id,
        data.product_id,
        data.game,
        data.nama_item,
        data.game_user_id,
        data.server_id,
        data.riot_id,
        data.wa_email_guest,
        'Menunggu Pembayaran',
        data.payment_method,
        data.payment_ref,
        data.qris_string,
        data.qris_url,
        data.total_harga
      ]
    );
    return await dbAsync.get('SELECT * FROM orders WHERE id = ?', [result.id]);
  },

  async getOrderByInvoice(invoiceNumber) {
    return await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [invoiceNumber.trim().toUpperCase()]
    );
  },

  async getOrderHistory(limit = 20) {
    return await dbAsync.all(
      'SELECT id, invoice_number, wa_email_guest, total_harga, status, created_at FROM orders ORDER BY id DESC LIMIT ?',
      [limit]
    );
  }
};

module.exports = {
  prisma: null,
  dbService
};
