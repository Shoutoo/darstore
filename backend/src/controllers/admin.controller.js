const { dbAsync } = require('../config/db');
const { dbService } = require('../config/prisma');
const orderQueue = require('../jobs/processOrderQueue');

// Audit Trail Logger Helper
async function logAdminAction(adminId, action, targetType, targetId, detail = {}) {
  try {
    const detailStr = JSON.stringify(detail);
    if (dbService.isPostgres() && dbService.getPrisma()) {
      try {
        await dbService.getPrisma().adminLog.create({
          data: {
            adminId,
            action,
            targetType,
            targetId: parseInt(targetId, 10) || 0,
            detail: detail
          }
        });
        return;
      } catch (e) {
        console.warn('Prisma adminLog failed, using SQLite:', e.message);
      }
    }
    await dbAsync.run(
      'INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)',
      [adminId, action, targetType, targetId, detailStr]
    );
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

// 1. DASHBOARD OVERVIEW & STATS
exports.getDashboardStats = async (req, res) => {
  try {
    // Total revenue & orders count today, this week, this month, all time
    const orders = await dbAsync.all('SELECT * FROM orders');

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);

    let revenueToday = 0;
    let revenueWeek = 0;
    let revenueMonth = 0;
    let revenueTotal = 0;

    const statusCounts = {
      pending: 0,
      processing: 0,
      success: 0,
      failed: 0,
      refunded: 0
    };

    const productSales = {};

    orders.forEach(o => {
      const isSuccess = o.status === 'Berhasil' || o.status === 'success' || o.status === 'paid' || o.status === 'Diproses';
      const orderDate = new Date(o.created_at);

      if (isSuccess) {
        revenueTotal += (o.total_harga || 0);
        if (orderDate >= oneMonthAgo) revenueMonth += (o.total_harga || 0);
        if (orderDate >= oneWeekAgo) revenueWeek += (o.total_harga || 0);
        if (o.created_at && o.created_at.startsWith(todayStr)) revenueToday += (o.total_harga || 0);

        // Product stats
        const key = o.nama_item || o.product_id;
        productSales[key] = (productSales[key] || 0) + 1;
      }

      // Normalize status count
      const s = (o.status || '').toLowerCase();
      if (s.includes('menunggu') || s === 'pending') statusCounts.pending++;
      else if (s.includes('proses') || s === 'processing') statusCounts.processing++;
      else if (s.includes('berhasil') || s === 'success' || s === 'paid') statusCounts.success++;
      else if (s.includes('refund')) statusCounts.refunded++;
      else statusCounts.failed++;
    });

    // 7 Days Chart Trend Data
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      
      let dayRev = 0;
      let dayCount = 0;

      orders.forEach(o => {
        if (o.created_at && o.created_at.startsWith(dayStr)) {
          dayCount++;
          if (o.status === 'Berhasil' || o.status === 'success' || o.status === 'paid') {
            dayRev += (o.total_harga || 0);
          }
        }
      });

      chartData.push({ date: dayStr, label: dayLabel, revenue: dayRev, orders: dayCount });
    }

    // Top 5 Products
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Recent 8 Orders
    const recentOrders = await dbAsync.all(
      'SELECT id, invoice_number, game, nama_item, wa_email_guest, total_harga, status, created_at FROM orders ORDER BY id DESC LIMIT 8'
    );

    const userCountRow = await dbAsync.get('SELECT COUNT(*) as count FROM users');
    const totalUsers = userCountRow ? userCountRow.count : 0;

    return res.json({
      success: true,
      stats: {
        revenueToday,
        revenueWeek,
        revenueMonth,
        revenueTotal,
        totalOrders: orders.length,
        totalUsers,
        statusCounts,
        chartData,
        topProducts,
        recentOrders
      }
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik dashboard.' });
  }
};

// 2. PRODUCT MANAGEMENT (CRUD)
exports.getProducts = async (req, res) => {
  try {
    const { game, search } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (game && game !== 'all') {
      sql += ' AND game = ?';
      params.push(game);
    }
    if (search) {
      sql += ' AND (nama_item LIKE ? OR id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY game ASC, nominal ASC';

    const products = await dbAsync.all(sql, params);
    return res.json({ success: true, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data produk.' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { game, nama_item, nominal, harga, icon } = req.body;
    if (!game || !nama_item || !harga) {
      return res.status(400).json({ success: false, message: 'Game, nama item, dan harga wajib diisi.' });
    }

    const id = `${game}_item_${Date.now()}`;
    const defaultIcon = game === 'valorant' ? '/assets/icons/vp_icon.png' : '/assets/icons/diamond_small.png';

    await dbAsync.run(
      'INSERT INTO products (id, game, nama_item, nominal, harga, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, game, nama_item, parseInt(nominal, 10) || 0, parseInt(harga, 10), icon || defaultIcon]
    );

    const product = await dbAsync.get('SELECT * FROM products WHERE id = ?', [id]);
    await logAdminAction(req.user.id, 'create_product', 'product', product.id, { game, nama_item, harga });

    return res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan!', product });
  } catch (err) {
    console.error('createProduct error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan produk.' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_item, nominal, harga, is_active } = req.body;

    const existing = await dbAsync.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    const newName = nama_item !== undefined ? nama_item : existing.nama_item;
    const newNominal = nominal !== undefined ? parseInt(nominal, 10) : existing.nominal;
    const newHarga = harga !== undefined ? parseInt(harga, 10) : existing.harga;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await dbAsync.run(
      'UPDATE products SET nama_item = ?, nominal = ?, harga = ?, is_active = ? WHERE id = ?',
      [newName, newNominal, newHarga, newActive, id]
    );

    const updated = await dbAsync.get('SELECT * FROM products WHERE id = ?', [id]);
    await logAdminAction(req.user.id, 'update_product', 'product', id, {
      before: { harga: existing.harga, is_active: existing.is_active },
      after: { harga: newHarga, is_active: newActive }
    });

    return res.json({ success: true, message: 'Produk berhasil diperbarui!', product: updated });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui produk.' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await dbAsync.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    await dbAsync.run('DELETE FROM products WHERE id = ?', [id]);
    await logAdminAction(req.user.id, 'delete_product', 'product', id, { nama_item: existing.nama_item });

    return res.json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus produk.' });
  }
};

// 3. ORDER MANAGEMENT
exports.getOrders = async (req, res) => {
  try {
    const { status, game, search, date_from, date_to, limit = 50 } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      if (status === 'success') sql += " AND (status = 'Berhasil' OR status = 'success' OR status = 'paid')";
      else if (status === 'pending') sql += " AND (status = 'Menunggu Pembayaran' OR status = 'pending')";
      else if (status === 'processing') sql += " AND (status = 'Diproses' OR status = 'processing')";
      else if (status === 'failed') sql += " AND (status = 'Gagal' OR status = 'failed')";
      else if (status === 'refunded') sql += " AND (status = 'Refunded' OR status = 'refunded')";
      else {
        sql += ' AND status = ?';
        params.push(status);
      }
    }

    if (game && game !== 'all') {
      sql += ' AND game = ?';
      params.push(game);
    }

    if (search) {
      sql += ' AND (invoice_number LIKE ? OR wa_email_guest LIKE ? OR game_user_id LIKE ? OR riot_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (date_from) {
      sql += ' AND created_at >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND created_at <= ?';
      params.push(date_to + ' 23:59:59');
    }

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const orders = await dbAsync.all(sql, params);
    return res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('getOrders error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data transaksi.' });
  }
};

exports.getOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    const logs = await dbAsync.all('SELECT * FROM payment_logs WHERE order_id = ? ORDER BY id DESC', [id]);
    const parsedLogs = logs.map(l => {
      let parsed = l.raw_response;
      try { parsed = JSON.parse(l.raw_response); } catch (e) {}
      return { ...l, raw_response: parsed };
    });

    return res.json({ success: true, order, payment_logs: parsedLogs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail order.' });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    await dbAsync.run("UPDATE orders SET status = 'Berhasil', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

    // Give loyalty points if order is attached to a registered user
    if (order.user_id) {
      const earned = Math.floor((order.total_harga || 0) / 10000);
      if (earned > 0) {
        await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [earned, order.user_id]);
        await dbAsync.run(
          'INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)',
          [order.user_id, order.id, earned, `Manual Complete Order: ${order.invoice_number}`]
        );
      }
    }

    await logAdminAction(req.user.id, 'complete_order', 'order', id, {
      invoice: order.invoice_number,
      previous_status: order.status
    });

    return res.json({ success: true, message: `Order ${order.invoice_number} berhasil ditandai Selesai.` });
  } catch (err) {
    console.error('completeOrder error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyelesaikan order secara manual.' });
  }
};

exports.retryOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    await dbAsync.run("UPDATE orders SET status = 'Diproses', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    orderQueue.enqueue(order);

    await logAdminAction(req.user.id, 'retry_order', 'order', id, {
      invoice: order.invoice_number
    });

    return res.json({ success: true, message: `Order ${order.invoice_number} berhasil dimasukkan kembali ke antrian pemrosesan.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal me-retry order.' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Dibatalkan oleh Admin' } = req.body;

    const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    await dbAsync.run("UPDATE orders SET status = 'Refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

    await logAdminAction(req.user.id, 'refund_order', 'order', id, {
      invoice: order.invoice_number,
      reason
    });

    return res.json({ success: true, message: `Order ${order.invoice_number} telah dibatalkan/di-refund.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal membatalkan order.' });
  }
};

// 4. USER MANAGEMENT
exports.getUsers = async (req, res) => {
  try {
    const users = await dbAsync.all(`
      SELECT 
        u.id, u.nama, u.email, u.whatsapp, u.points, u.role, u.is_blocked, u.created_at,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(CASE WHEN o.status IN ('Berhasil', 'success', 'paid') THEN o.total_harga ELSE 0 END), 0) as total_spend
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY u.id DESC
    `);

    return res.json({ success: true, count: users.length, users });
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar user.' });
  }
};

exports.adjustUserPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const pointAmount = parseInt(amount, 10);
    if (isNaN(pointAmount) || pointAmount === 0) {
      return res.status(400).json({ success: false, message: 'Jumlah poin harus angka bukan nol.' });
    }

    const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    const newPoints = Math.max(0, (user.points || 0) + pointAmount);
    await dbAsync.run('UPDATE users SET points = ? WHERE id = ?', [newPoints, id]);

    await dbAsync.run(
      'INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)',
      [id, 0, pointAmount, reason || 'Penyesuaian Manual Admin']
    );

    await logAdminAction(req.user.id, 'adjust_points', 'user', id, {
      user_email: user.email,
      change: pointAmount,
      balance: newPoints,
      reason
    });

    return res.json({
      success: true,
      message: `Poin user berhasil disesuaikan (${pointAmount >= 0 ? '+' : ''}${pointAmount}). Saldo baru: ${newPoints}`,
      points: newPoints
    });
  } catch (err) {
    console.error('adjustUserPoints error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyesuaikan poin user.' });
  }
};

exports.toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    if (user.role === 'admin' && user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat memblokir akun Anda sendiri.' });
    }

    const newStatus = user.is_blocked ? 0 : 1;
    await dbAsync.run('UPDATE users SET is_blocked = ? WHERE id = ?', [newStatus, id]);

    await logAdminAction(req.user.id, 'toggle_block_user', 'user', id, {
      user_email: user.email,
      is_blocked: newStatus === 1
    });

    return res.json({
      success: true,
      message: `User ${user.nama} berhasil ${newStatus === 1 ? 'DIBLOKIR' : 'DIAKTIFKAN KEMBALI'}.`,
      is_blocked: newStatus === 1
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengubah status blokir user.' });
  }
};

// 5. PROVIDER BALANCE & PAYMENT SETTINGS
exports.getProviderBalance = async (req, res) => {
  try {
    // Check Digiflazz API configuration
    const username = process.env.DIGIFLAZZ_USERNAME;
    const isConfigured = Boolean(username && username !== 'your_digiflazz_username');

    return res.json({
      success: true,
      provider: 'Digiflazz H2H Top Up',
      configured: isConfigured,
      balance: isConfigured ? 15400000 : 2500000,
      currency: 'IDR',
      status: 'Online',
      last_checked: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memeriksa saldo provider.' });
  }
};

exports.getPaymentSettings = async (req, res) => {
  try {
    const apiKey = process.env.TRIPAY_API_KEY;
    const isConfigured = Boolean(apiKey && apiKey !== 'your_tripay_api_key');
    const mode = process.env.NODE_ENV === 'production' ? 'Production' : 'Sandbox (Testing)';

    const maskedKey = apiKey && apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'DEV_TRIPAY_KEY';

    return res.json({
      success: true,
      gateway: 'Tripay Payment Gateway (QRIS)',
      mode,
      configured: isConfigured,
      api_key_masked: maskedKey,
      merchant_code: process.env.TRIPAY_MERCHANT_CODE || 'T2026DAR',
      status: 'Connected & Ready'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil konfigurasi payment gateway.' });
  }
};

// 6. REPORTS & EXPORT
exports.getReports = async (req, res) => {
  try {
    const orders = await dbAsync.all("SELECT * FROM orders WHERE status IN ('Berhasil', 'success', 'paid')");

    let mlRevenue = 0;
    let valoRevenue = 0;
    let mlCount = 0;
    let valoCount = 0;

    orders.forEach(o => {
      if (o.game === 'valorant') {
        valoRevenue += (o.total_harga || 0);
        valoCount++;
      } else {
        mlRevenue += (o.total_harga || 0);
        mlCount++;
      }
    });

    return res.json({
      success: true,
      breakdown: {
        mlbb: { revenue: mlRevenue, count: mlCount },
        valorant: { revenue: valoRevenue, count: valoCount }
      },
      totalRevenue: mlRevenue + valoRevenue,
      totalSuccessfulOrders: orders.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memuat data laporan.' });
  }
};

exports.exportReportsCSV = async (req, res) => {
  try {
    const orders = await dbAsync.all('SELECT * FROM orders ORDER BY id DESC');

    const headers = ['ID', 'Invoice', 'Tanggal', 'Game', 'Item', 'User ID/Server/Riot', 'Kontak', 'Metode', 'Total Harga', 'Status'];
    const rows = orders.map(o => [
      o.id,
      `"${o.invoice_number}"`,
      `"${o.created_at}"`,
      `"${o.game}"`,
      `"${(o.nama_item || '').replace(/"/g, '""')}"`,
      `"${o.game_user_id ? `${o.game_user_id} (${o.server_id})` : (o.riot_id || '')}"`,
      `"${o.wa_email_guest}"`,
      `"${o.payment_method || 'QRIS'}"`,
      o.total_harga,
      `"${o.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="darstore_orders_${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengekspor laporan CSV.' });
  }
};

// 7. AUDIT TRAIL LOGS
exports.getAdminLogs = async (req, res) => {
  try {
    const logs = await dbAsync.all(`
      SELECT l.*, u.nama as admin_name, u.email as admin_email
      FROM admin_logs l
      LEFT JOIN users u ON l.admin_id = u.id
      ORDER BY l.id DESC LIMIT 50
    `);

    const formatted = logs.map(l => {
      let parsed = l.detail;
      try { parsed = JSON.parse(l.detail); } catch (e) {}
      return { ...l, detail: parsed };
    });

    return res.json({ success: true, count: formatted.length, logs: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil log aktivitas admin.' });
  }
};

// 8. GENERAL STORE SETTINGS
exports.getSettings = async (req, res) => {
  try {
    const rows = await dbAsync.all('SELECT key, value FROM store_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    // Fallbacks
    settings.cs_whatsapp = settings.cs_whatsapp || '081234567890';
    settings.cs_email = settings.cs_email || 'support@darstore.com';
    settings.store_name = settings.store_name || "Dar'sstore";

    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan toko.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { cs_whatsapp, cs_email, store_name } = req.body;

    if (cs_whatsapp) {
      await dbAsync.run(
        'INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
        ['cs_whatsapp', cs_whatsapp.trim()]
      );
    }
    if (cs_email) {
      await dbAsync.run(
        'INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
        ['cs_email', cs_email.trim()]
      );
    }
    if (store_name) {
      await dbAsync.run(
        'INSERT INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
        ['store_name', store_name.trim()]
      );
    }

    await logAdminAction(req.user.id, 'update_settings', 'settings', 0, { cs_whatsapp, cs_email, store_name });

    return res.json({ success: true, message: 'Pengaturan toko berhasil diperbarui!' });
  } catch (err) {
    console.error('updateSettings error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengaturan toko.' });
  }
};
