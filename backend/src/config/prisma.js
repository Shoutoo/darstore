const { PrismaClient } = require('@prisma/client');
const { dbAsync } = require('./db');

let prismaClient = null;
let isPostgresConfigured = false;

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  try {
    prismaClient = new PrismaClient();
    isPostgresConfigured = true;
    console.log('[DATABASE] Prisma configured with PostgreSQL connection string.');
  } catch (err) {
    console.warn('[DATABASE] Failed to initialize Prisma PostgreSQL client:', err.message);
  }
} else {
  console.log('[DATABASE] DATABASE_URL not set to PostgreSQL. Using SQLite fallback for local development.');
}

/**
 * Unified Database Service Adapter
 * Automatically routes to Prisma when PostgreSQL is connected,
 * or SQLite when running in local development mode.
 */
const dbService = {
  isPostgres: () => isPostgresConfigured,
  getPrisma: () => prismaClient,

  // Products
  async getProducts(game) {
    if (isPostgresConfigured && prismaClient) {
      try {
        const where = { isActive: true };
        if (game) where.game = game;
        return await prismaClient.product.findMany({
          where,
          orderBy: { harga: 'asc' }
        });
      } catch (e) {
        console.warn('Prisma query failed, falling back to SQLite:', e.message);
      }
    }
    // SQLite fallback
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
    if (isPostgresConfigured && prismaClient) {
      try {
        return await prismaClient.order.create({
          data: {
            invoiceNumber: data.invoice_number,
            userId: data.user_id || null,
            productId: typeof data.product_id === 'number' ? data.product_id : 1,
            gameUserId: data.game_user_id || null,
            serverId: data.server_id || null,
            riotId: data.riot_id || null,
            contactWa: data.wa_email_guest || null,
            status: 'pending',
            paymentMethod: data.payment_method || null,
            paymentRef: data.payment_ref || null,
            totalHarga: data.total_harga
          }
        });
      } catch (e) {
        console.warn('Prisma createOrder failed, falling back to SQLite:', e.message);
      }
    }
    // SQLite fallback
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
    if (isPostgresConfigured && prismaClient) {
      try {
        const order = await prismaClient.order.findUnique({
          where: { invoiceNumber: invoiceNumber.trim().toUpperCase() },
          include: { product: true }
        });
        if (order) {
          return {
            id: order.id,
            invoice_number: order.invoiceNumber,
            game: order.product?.game || 'mlbb',
            nama_item: order.product?.namaItem || 'Top Up Game',
            game_user_id: order.gameUserId,
            server_id: order.serverId,
            riot_id: order.riotId,
            status: order.status === 'success' ? 'Berhasil' : (order.status === 'processing' ? 'Diproses' : 'Menunggu Pembayaran'),
            payment_method: order.paymentMethod,
            total_harga: order.totalHarga,
            created_at: order.createdAt
          };
        }
      } catch (e) {
        console.warn('Prisma getOrderByInvoice failed, falling back to SQLite:', e.message);
      }
    }
    // SQLite fallback
    return await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [invoiceNumber.trim().toUpperCase()]
    );
  },

  async getOrderHistory(limit = 20) {
    if (isPostgresConfigured && prismaClient) {
      try {
        const orders = await prismaClient.order.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' }
        });
        return orders.map(o => ({
          id: o.id,
          invoice_number: o.invoiceNumber,
          wa_email_guest: o.contactWa || o.contactEmail,
          total_harga: o.totalHarga,
          status: o.status === 'success' ? 'Berhasil' : (o.status === 'processing' ? 'Diproses' : 'Menunggu Pembayaran'),
          created_at: o.createdAt
        }));
      } catch (e) {
        console.warn('Prisma getOrderHistory failed, falling back to SQLite:', e.message);
      }
    }
    // SQLite fallback
    return await dbAsync.all(
      'SELECT id, invoice_number, wa_email_guest, total_harga, status, created_at FROM orders ORDER BY id DESC LIMIT ?',
      [limit]
    );
  }
};

module.exports = {
  prisma: prismaClient,
  dbService
};
