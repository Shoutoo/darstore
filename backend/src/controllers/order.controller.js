const { dbAsync } = require('../config/db');
const { dbService } = require('../config/prisma');
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

    if (game === 'mlbb') {
      const uid = String(game_user_id || '').trim();
      const srv = String(server_id || '').trim();
      if (!uid || !srv) {
        return res.status(400).json({
          success: false,
          message: 'User ID dan Server ID Mobile Legends wajib diisi.'
        });
      }
      if (!/^\d{6,10}$/.test(uid)) {
        return res.status(400).json({
          success: false,
          message: 'User ID Mobile Legends tidak valid (harus 6-10 digit angka). Contoh: 123456789'
        });
      }
      if (!/^\d{3,5}$/.test(srv)) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID/Server Mobile Legends tidak valid (harus 3-5 digit angka). Contoh: 2114'
        });
      }
    }

    if (game === 'valorant') {
      const rid = String(riot_id || '').trim();
      if (!rid || !rid.includes('#')) {
        return res.status(400).json({
          success: false,
          message: 'Riot ID Valorant wajib menyertakan tagline dengan tanda # (Contoh: Player#1234).'
        });
      }
      const parts = rid.split('#');
      if (parts.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Format Riot ID tidak valid. Pastikan hanya ada 1 tanda # (Contoh: Player#1234).'
        });
      }
      const [namaPart, tagPart] = parts;
      if (!/^.{3,16}$/.test(namaPart.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Nama pada Riot ID harus 3-16 karakter. Contoh: Player#1234'
        });
      }
      if (!/^\d{3,5}$/.test(tagPart.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Tagline Riot ID harus berupa angka saja (3-5 digit) untuk Region Indonesia. Contoh: Player#1234'
        });
      }
    }

    // Look up product in database
    let product = null;
    if (dbService.isPostgres() && dbService.getPrisma()) {
      try {
        const numId = parseInt(product_id, 10);
        const p = await dbService.getPrisma().product.findFirst({
          where: isNaN(numId) ? { namaItem: { contains: String(product_id) } } : { id: numId }
        });
        if (p) {
          product = {
            id: p.id,
            game: p.game,
            nama_item: p.namaItem,
            harga: p.harga,
            nominal: p.nominal
          };
        }
      } catch (e) {
        console.warn('Prisma product lookup failed:', e.message);
      }
    }
    if (!product) {
      product = await dbAsync.get('SELECT * FROM products WHERE (id = ? OR nama_item LIKE ?) AND is_active = 1', [product_id, `%${product_id}%`]);
    }

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
      product_id: product.id,
      nama_item: `${product.nama_item} (x${quantity})`
    };

    // 1. Simpan order ke database dengan status awal Menunggu Pembayaran
    const createdOrder = await dbService.createOrder({
      invoice_number,
      user_id,
      product_id: product.id,
      game,
      nama_item: tempOrder.nama_item,
      game_user_id: game_user_id || null,
      server_id: server_id || null,
      riot_id: riot_id || null,
      wa_email_guest,
      status: 'Menunggu Pembayaran',
      payment_method,
      payment_ref: null,
      qris_string: null,
      qris_url: null,
      total_harga
    });

    // 2. Charge ke Midtrans Core API dengan payment_type: 'qris'
    try {
      const qrisData = await paymentGateway.createQrisTransaction(tempOrder);

      // 3. Update data order dengan payment_ref dan URL QRIS Midtrans
      await dbAsync.run(
        `UPDATE orders SET payment_ref = ?, qris_string = ?, qris_url = ?, expired_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [qrisData.payment_ref, qrisData.qris_string, qrisData.qris_url, qrisData.expired_at, createdOrder.id]
      );

      // 4. Catat payment log transaksi Midtrans
      try {
        await dbAsync.run(
          `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
          [
            createdOrder.id,
            qrisData.payment_ref,
            'pending',
            JSON.stringify(qrisData.raw_response || { initiated: true })
          ]
        );
      } catch (logErr) {
        console.warn('Payment log write error:', logErr.message);
      }

      const updatedOrder = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [createdOrder.id]);

      return res.status(201).json({
        success: true,
        message: 'Pesanan berhasil dibuat.',
        invoiceNumber: invoice_number,
        qrCodeUrl: qrisData.qris_url,
        expiredAt: qrisData.expired_at,
        totalHarga: total_harga,
        order: {
          ...updatedOrder,
          qrCodeUrl: qrisData.qris_url,
          expiredAt: qrisData.expired_at
        }
      });
    } catch (chargeErr) {
      console.error('Midtrans QRIS charge error:', chargeErr);
      // Jika charge Midtrans gagal, tandai status order jadi Gagal supaya tidak menggantung
      await dbAsync.run(
        `UPDATE orders SET status = 'Gagal', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [`Gagal membuat tagihan Midtrans: ${chargeErr.message}`, createdOrder.id]
      );
      return res.status(500).json({
        success: false,
        error: 'Gagal membuat transaksi pembayaran',
        detail: chargeErr.message
      });
    }
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

    const order = await dbService.getOrderByInvoice(invoice);

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
    const orders = await dbService.getOrderHistory(20);

    // Mask phone number for privacy: e.g. 0812****890
    const formatted = orders.map(o => {
      let masked = '0812****890';
      const contact = o.wa_email_guest || o.contactWa || o.contactEmail;
      if (contact) {
        const str = contact.trim();
        if (str.includes('@')) {
          const parts = str.split('@');
          masked = parts[0].slice(0, 2) + '***@' + parts[1];
        } else if (str.length >= 8) {
          masked = str.slice(0, 4) + '****' + str.slice(-3);
        }
      }
      return {
        id: o.id,
        invoice_number: o.invoice_number || o.invoiceNumber,
        masked_contact: masked,
        total_harga: o.total_harga || o.totalHarga,
        status: o.status,
        created_at: o.created_at || o.createdAt
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
    const products = await dbService.getProducts(game);
    return res.json({ success: true, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memuat produk dari database.' });
  }
};
