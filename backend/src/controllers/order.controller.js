const { dbAsync } = require('../config/db');
const paymentGateway = require('../services/paymentGateway');

function generateInvoiceNumber() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DS${dateStr}${rand}`;
}

exports.createOrder = async (req, res) => {
  try {
    const {
      product_id,
      game,
      game_user_id,
      server_id,
      riot_id,
      wa_email_guest,
      payment_method,
      qty = 1
    } = req.body;

    if (!product_id || !game || !wa_email_guest || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Data pesanan belum lengkap. Harap isi semua field yang diperlukan.'
      });
    }

    if (game === 'mlbb' && (!game_user_id || !server_id)) {
      return res.status(400).json({
        success: false,
        message: 'User ID dan Server ID Mobile Legends wajib diisi.'
      });
    }

    if (game === 'valorant' && (!riot_id || !riot_id.includes('#'))) {
      return res.status(400).json({
        success: false,
        message: 'Riot ID Valorant wajib menyertakan tagline (Contoh: Player#1234).'
      });
    }

    // Look up product in database
    const product = await dbAsync.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [product_id]);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan atau sedang tidak aktif.'
      });
    }

    // Calculate total price based on product unit price + fee
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const fee = payment_method.toLowerCase().includes('qris') ? 800 : 1000;
    const total_harga = (product.harga * quantity) + fee;

    const invoice_number = generateInvoiceNumber();
    const user_id = req.user ? req.user.id : null;

    // Create temporary order object for payment gateway
    const tempOrder = {
      invoice_number,
      total_harga,
      product_id,
      nama_item: `${product.nama_item} (x${quantity})`
    };

    const qrisData = await paymentGateway.createQrisTransaction(tempOrder);

    // Save to orders table
    const result = await dbAsync.run(
      `INSERT INTO orders (
        invoice_number, user_id, product_id, game, nama_item,
        game_user_id, server_id, riot_id, wa_email_guest,
        status, payment_method, payment_ref, qris_string, qris_url, total_harga
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice_number,
        user_id,
        product_id,
        game,
        tempOrder.nama_item,
        game_user_id || null,
        server_id || null,
        riot_id || null,
        wa_email_guest,
        'Menunggu Pembayaran',
        payment_method,
        qrisData.payment_ref,
        qrisData.qris_string,
        qrisData.qris_url,
        total_harga
      ]
    );

    const createdOrder = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [result.id]);

    return res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat.',
      order: createdOrder
    });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses pesanan Anda.'
    });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { invoice } = req.query;
    if (!invoice) {
      return res.status(400).json({ success: false, message: 'Nomor invoice diperlukan.' });
    }

    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE UPPER(invoice_number) = ?',
      [invoice.trim().toUpperCase()]
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Nomor Invoice tidak ditemukan.' });
    }

    return res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mencari detail pesanan.' });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const orders = await dbAsync.all(
      'SELECT id, invoice_number, wa_email_guest, total_harga, status, created_at FROM orders ORDER BY id DESC LIMIT 20'
    );

    // Mask phone number for privacy: e.g. 0812****890
    const formatted = orders.map(o => {
      let masked = '0812****890';
      if (o.wa_email_guest) {
        const str = o.wa_email_guest.trim();
        if (str.includes('@')) {
          const parts = str.split('@');
          masked = parts[0].slice(0, 2) + '***@' + parts[1];
        } else if (str.length >= 8) {
          masked = str.slice(0, 4) + '****' + str.slice(-3);
        }
      }
      return {
        id: o.id,
        invoice_number: o.invoice_number,
        masked_contact: masked,
        total_harga: o.total_harga,
        status: o.status,
        created_at: o.created_at
      };
    });

    return res.json({
      success: true,
      orders: formatted
    });
  } catch (err) {
    console.error('Order history error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat transaksi.' });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { game } = req.query;
    let sql = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];
    if (game) {
      sql += ' AND game = ?';
      params.push(game);
    }
    sql += ' ORDER BY nominal ASC';
    const products = await dbAsync.all(sql, params);
    return res.json({ success: true, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memuat produk.' });
  }
};
