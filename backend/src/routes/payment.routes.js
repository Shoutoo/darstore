const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const orderController = require('../controllers/order.controller');
const paymentGateway = require('../services/paymentGateway');

/**
 * Midtrans Payment Routes
 * Compatible with MIDTRANS_SANDBOX.md specification
 */

// 1. Notification URL (matches MIDTRANS_SANDBOX.md Section 7 & 9)
// Endpoint: POST /api/payment/notification
router.post('/notification', webhookController.handlePaymentWebhook);

// 2. Create Transaction Endpoint (matches MIDTRANS_SANDBOX.md Section 6)
// Endpoint: POST /api/payment/create
router.post('/create', async (req, res) => {
  try {
    const { productId, customer, product_id } = req.body;
    const targetProductId = productId || product_id;

    // Delegate to standard orderController if full order payload provided
    if (req.body.game && req.body.payment_method) {
      return orderController.createOrder(req, res);
    }

    if (!targetProductId) {
      return res.status(400).json({ message: 'productId diperlukan.' });
    }

    const { dbAsync } = require('../config/db');
    const product = await dbAsync.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [targetProductId]);
    if (!product) {
      return res.status(404).json({ message: 'Produk tidak ditemukan atau tidak aktif' });
    }

    const orderId = `ORDER-${Date.now()}`;
    const snapData = await paymentGateway.createSnapTransaction(
      {
        invoice_number: orderId,
        total_harga: product.harga,
        nama_item: product.nama_item,
        product_id: product.id,
      },
      customer || {}
    );

    // Save pending order record in database
    await dbAsync.run(
      `INSERT INTO orders (invoice_number, nama_item, status, payment_method, total_harga, payment_ref) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, product.nama_item, 'Menunggu Pembayaran', 'Midtrans Snap', product.harga, snapData.token]
    );

    return res.json({
      token: snapData.token,
      redirect_url: snapData.redirect_url,
      orderId,
    });
  } catch (err) {
    console.error('Midtrans create error:', err.message);
    return res.status(500).json({ message: 'Gagal membuat transaksi', error: err.message });
  }
});

// 3. Create Midtrans Payment Link Endpoint
// Endpoint: POST /api/payment/payment-link
router.post('/payment-link', async (req, res) => {
  try {
    const { order_id, amount, gross_amount, item_name, customer_name, customer_email, customer_phone } = req.body;
    const finalAmount = amount || gross_amount || 10000;
    const invoiceNumber = order_id || `PLINK-${Date.now()}`;
    const itemName = item_name || 'Top Up Game Darstore';

    const linkData = await paymentGateway.createPaymentLink(
      {
        invoice_number: invoiceNumber,
        total_harga: finalAmount,
        nama_item: itemName,
      },
      {
        name: customer_name || 'Pelanggan Darstore',
        email: customer_email || 'customer@darstore.com',
        phone: customer_phone || '081234567890',
      }
    );

    return res.json({
      success: true,
      message: 'Payment Link berhasil dibuat',
      payment_url: linkData.payment_url,
      redirect_url: linkData.redirect_url,
      order_id: invoiceNumber,
      token: linkData.token,
    });
  } catch (err) {
    console.error('Create Payment Link error:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal membuat Payment Link', error: err.message });
  }
});

module.exports = router;
