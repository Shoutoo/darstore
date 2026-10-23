const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const webhookController = require('../controllers/webhook.controller');
const orderController = require('../controllers/order.controller');
const paymentGateway = require('../services/paymentGateway');
const { dbAsync } = require('../config/db');
const { dbService } = require('../config/prisma');
const { optionalToken } = require('../middlewares/auth.middleware');

/**
 * Midtrans Payment Routes
 * Compatible with MIDTRANS_SANDBOX.md and hardened against price tampering
 */

// 1. Notification Webhook URL (matches MIDTRANS_SANDBOX.md Section 7 & 9)
// Endpoint: POST /api/payment/notification
router.post('/notification', webhookController.handlePaymentWebhook);

// 2. Create Transaction Endpoint (Hardened against nominal tampering)
// Endpoint: POST /api/payment/create
router.post('/create', optionalToken, async (req, res) => {
  try {
    const { productId, customer, product_id, qty = 1 } = req.body;
    const targetProductId = productId || product_id;

    // Delegasikan ke orderController jika payload pesanan lengkap disediakan
    if (req.body.game && req.body.payment_method) {
      return orderController.createOrder(req, res);
    }

    if (!targetProductId) {
      return res.status(400).json({ success: false, message: 'productId diperlukan.' });
    }

    // 1. Ambil harga produk resmi dari database (bukan dari frontend)
    const product = await dbAsync.get(
      'SELECT * FROM products WHERE id = ? AND is_active = 1',
      [targetProductId]
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau tidak aktif di katalog database.' });
    }

    // 2. Kontak customer wajib ada untuk guest / user
    const contact = (customer && (customer.email || customer.phone)) || req.body.wa_email_guest;
    if (!contact) {
      return res.status(400).json({
        success: false,
        message: 'Kontak pelanggan (Email atau WhatsApp) wajib diisi untuk membuat pesanan.'
      });
    }

    // 3. Hitung total harga resmi di backend
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const fee = 1000;
    const finalAmount = (product.harga * quantity) + fee;

    // 4. Buat invoice unik dan token akses aman
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    const orderId = `DS${dateStr}${randStr}`;
    const accessToken = crypto.randomBytes(24).toString('hex');

    // 5. Simpan pesanan ke database sebelum memanggil payment gateway
    const createdOrder = await dbService.createOrder({
      invoice_number: orderId,
      user_id: req.user ? req.user.id : null,
      product_id: product.id,
      game: product.game,
      nama_item: `${product.nama_item} (x${quantity})`,
      wa_email_guest: contact,
      status: 'Menunggu Pembayaran',
      payment_method: 'Midtrans Snap',
      payment_ref: null,
      total_harga: finalAmount,
      access_token: accessToken,
      expired_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    // 6. Buat transaksi Snap dengan nominal resmi dari database
    const snapData = await paymentGateway.createSnapTransaction(
      {
        invoice_number: orderId,
        total_harga: finalAmount,
        nama_item: product.nama_item,
        product_id: product.id,
      },
      customer || { name: contact, email: contact.includes('@') ? contact : 'customer@darstore.com' }
    );

    // 7. Update payment_ref dan redirect_url ke order
    await dbAsync.run(
      `UPDATE orders SET payment_ref = ?, redirect_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [snapData.token, snapData.redirect_url, createdOrder.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dibuat.',
      token: snapData.token,
      redirect_url: snapData.redirect_url,
      orderId,
      access_token: accessToken,
      total_harga: finalAmount
    });
  } catch (err) {
    console.error('Midtrans create error:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal membuat transaksi', error: err.message });
  }
});

// 3. Create Midtrans Payment Link Endpoint (Hardened: validasi pesanan & cegah manipulasi nominal)
// Endpoint: POST /api/payment/payment-link
router.post('/payment-link', optionalToken, async (req, res) => {
  try {
    const { order_id, invoice_number, access_token } = req.body;
    const targetInvoice = (order_id || invoice_number || '').trim().toUpperCase();

    if (!targetInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Nomor pesanan (order_id / invoice_number) wajib disertakan.'
      });
    }

    // 1. Cari pesanan di database
    const order = await dbService.getOrderByInvoice(targetInvoice);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pesanan tidak ditemukan di database. Tagihan hanya dapat diterbitkan untuk pesanan yang valid.'
      });
    }

    // 2. Verifikasi otorisasi pesanan secara terpusat (DENY BY DEFAULT)
    const { evaluateOrderAuthorization } = require('../utils/orderAuth');
    const authResult = evaluateOrderAuthorization(order, req);
    if (!authResult.authorized) {
      return res.status(authResult.status || 403).json({
        success: false,
        message: authResult.reason
      });
    }

    // 3. Status pesanan tidak boleh yang sudah selesai atau gagal
    if (order.status === 'Berhasil') {
      return res.status(400).json({
        success: false,
        message: 'Pesanan ini sudah berhasil dibayar sebelumnya.'
      });
    }
    if (order.status === 'Gagal') {
      return res.status(400).json({
        success: false,
        message: 'Pesanan ini sudah kedaluwarsa atau dibatalkan.'
      });
    }

    // 4. Cegah pembuatan tagihan ganda secara tidak terkendali:
    // Jika sudah ada redirect_url aktif yang belum kedaluwarsa, kembalikan tagihan yang sudah ada
    if (order.redirect_url && order.expired_at) {
      const isExpired = new Date(order.expired_at) < new Date();
      if (!isExpired) {
        return res.json({
          success: true,
          message: 'Menggunakan tautan pembayaran aktif yang sudah diterbitkan sebelumnya.',
          payment_url: order.redirect_url,
          redirect_url: order.redirect_url,
          order_id: order.invoice_number,
          token: order.payment_ref
        });
      }
    }

    // 5. Total harga DIAMBIL DARI DATABASE (req.body.amount diabaikan secara total)
    const finalAmount = Math.round(Number(order.total_harga));
    const customerContact = order.wa_email_guest || 'customer@darstore.com';

    const linkData = await paymentGateway.createPaymentLink(
      {
        invoice_number: order.invoice_number,
        total_harga: finalAmount,
        nama_item: order.nama_item || 'Top Up Game Darstore',
        product_id: order.product_id
      },
      {
        name: customerContact,
        email: customerContact.includes('@') ? customerContact : 'customer@darstore.com',
        phone: !customerContact.includes('@') ? customerContact : '081234567890',
      }
    );

    // 6. Simpan URL tagihan aktif ke database
    await dbAsync.run(
      `UPDATE orders SET redirect_url = ?, payment_ref = COALESCE(?, payment_ref), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [linkData.redirect_url || linkData.payment_url, linkData.token || null, order.id]
    );

    return res.json({
      success: true,
      message: 'Payment Link berhasil diterbitkan dengan nominal resmi pesanan.',
      payment_url: linkData.payment_url,
      redirect_url: linkData.redirect_url,
      order_id: order.invoice_number,
      token: linkData.token,
    });
  } catch (err) {
    console.error('Create Payment Link error:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal membuat Payment Link', error: err.message });
  }
});

module.exports = router;

