const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');

// Ensure test environment uses local SQLite
process.env.DB_PATH = path.join(__dirname, '../test-database.sqlite');
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;

const { initDatabase, dbAsync } = require('../src/config/db');
const webhookController = require('../src/controllers/webhook.controller');
const orderController = require('../src/controllers/order.controller');
const paymentGateway = require('../src/services/paymentGateway');
const topupProvider = require('../src/services/topupProvider');
const orderQueue = require('../src/jobs/processOrderQueue');
const emailService = require('../src/services/emailService');

// Helper to create mock req and res
function createMockReqRes({ body = {}, headers = {}, params = {}, query = {}, user = null, method = 'POST' } = {}) {
  const req = {
    body,
    headers,
    params,
    query,
    user,
    method
  };
  const res = {
    statusCode: 200,
    headersSent: false,
    _headers: {},
    _json: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
    setHeader(k, v) {
      this._headers[k] = v;
      return this;
    }
  };
  return { req, res };
}

// Generate valid SHA-512 signature for Midtrans webhook test
function generateMidtransSignature(orderId, statusCode, grossAmount, serverKey) {
  return crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
}

let originalProcessTopup;

test.before(async () => {
  originalProcessTopup = topupProvider.processTopup.bind(topupProvider);
  process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test-key';
  process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-test-key';
  process.env.MIDTRANS_IS_PRODUCTION = 'false';
  paymentGateway.reloadConfig(true);

  await initDatabase();
  // Ensure test products exist
  await dbAsync.run(
    `INSERT OR IGNORE INTO products (id, game, nama_item, nominal, harga, icon, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['test_item_1', 'mlbb', '100 Diamonds Test', 100, 30000, '/assets/test.png', 1]
  );
  // Ensure test user exists
  await dbAsync.run(
    `INSERT OR IGNORE INTO users (id, nama, email, whatsapp, password_hash, points, role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [999, 'Tester Darstore', 'tester@darstore.com', '081299998888', 'hash', 100, 'user']
  );

  // Stub emailService to avoid network calls
  emailService.sendOrderReceipt = async () => true;
  emailService.sendOrderFailedNotice = async () => true;
});

// =========================================================================
// SKENARIO 1: Simulasi pembayaran ditolak pada production
// =========================================================================
test('Skenario 1: Simulasi pembayaran ditolak pada production (mengembalikan 404 & tidak mengubah status)', async () => {
  const invoice = `TEST-SIM-PROD-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 30000, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  // Set production environment
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    const { req, res } = createMockReqRes({
      body: { invoice_number: invoice }
    });

    await webhookController.simulatePayment(req, res);

    assert.equal(res.statusCode, 404, 'Endpoint simulasi harus mengembalikan status 404 di production');
    assert.equal(res._json.success, false, 'Response success harus false');

    // Pastikan status di database sama sekali tidak berubah
    const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
    assert.equal(orderInDb.status, 'Menunggu Pembayaran', 'Status pesanan tidak boleh berubah di production');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

// =========================================================================
// SKENARIO 2: Nominal yang dimanipulasi frontend ditolak atau diabaikan
// =========================================================================
test('Skenario 2: Nominal yang dimanipulasi frontend diabaikan (menggunakan total_harga dari database)', async () => {
  const invoice = `TEST-MANIP-PRICE-${Date.now()}`;
  const realPrice = 30000;
  const guestToken = 'token-scenario-2-valid';
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', realPrice, 'Menunggu Pembayaran', guestToken, 'Virtual Account']
  );

  // Mock createPaymentLink to spy on the amount passed
  let amountPassedToGateway = null;
  const originalCreatePaymentLink = paymentGateway.createPaymentLink;
  paymentGateway.createPaymentLink = async (orderPayload) => {
    amountPassedToGateway = orderPayload.total_harga;
    return {
      order_id: orderPayload.invoice_number,
      payment_url: 'https://app.midtrans.com/snap/v2/vtweb/mock',
      redirect_url: 'https://app.midtrans.com/snap/v2/vtweb/mock',
      token: 'mock-token'
    };
  };

  try {
    // Frontend mencoba mengirim nominal Rp 1 untuk pesanan Rp 30.000
    const paymentRoutes = require('../src/routes/payment.routes');
    const { req, res } = createMockReqRes({
      body: {
        order_id: invoice,
        access_token: guestToken,
        amount: 1, // Manipulasi!
        gross_amount: 100 // Manipulasi!
      }
    });

    const paymentLinkLayer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link');
    await paymentLinkLayer.route.stack[1].handle(req, res);

    assert.equal(res.statusCode, 200, 'Payment link berhasil dibuat');
    assert.equal(amountPassedToGateway, realPrice, 'Nominal yang dikirim ke Midtrans harus tetap 30000 (dari DB), mengabaikan 1 rupiah dari frontend');
  } finally {
    paymentGateway.createPaymentLink = originalCreatePaymentLink;
  }
});

// =========================================================================
// SKENARIO 3: Pembayaran dengan invoice tidak valid ditolak
// =========================================================================
test('Skenario 3: Pembayaran dengan invoice tidak valid ditolak (404 Not Found)', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const dummyInvoice = `DS-NONEXISTENT-${Date.now()}`;
  const signature = generateMidtransSignature(dummyInvoice, '200', '10000', paymentGateway.serverKey);

  const { req, res } = createMockReqRes({
    body: {
      order_id: dummyInvoice,
      status_code: '200',
      gross_amount: '10000',
      signature_key: signature,
      transaction_status: 'settlement'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 404, 'Pesanan dengan invoice yang tidak ada di DB harus ditolak 404');
});

// =========================================================================
// SKENARIO 4: Pembayaran dengan nominal berbeda tidak dianggap lunas
// =========================================================================
test('Skenario 4: Pembayaran dengan nominal berbeda (gross amount mismatch) ditolak & tidak lunas', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-DIFF-AMT-${Date.now()}`;
  const realPrice = 30000;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', realPrice, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  // Webhook mengirim nominal 10.000 (kurang bayar) padahal total_harga 30.000
  const underpaidAmount = '10000.00';
  const signature = generateMidtransSignature(invoice, '200', underpaidAmount, paymentGateway.serverKey);

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '200',
      gross_amount: underpaidAmount,
      signature_key: signature,
      transaction_status: 'settlement'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 400, 'Nominal berbeda harus ditolak dengan HTTP 400');
  assert.equal(res._json.error, 'Gross amount mismatch');

  // Pastikan order tidak menjadi lunas
  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Menunggu Pembayaran', 'Pesanan underpaid tidak boleh ditandai lunas');
});

// =========================================================================
// SKENARIO 5: Signature webhook yang salah ditolak
// =========================================================================
test('Skenario 5: Signature webhook yang salah ditolak (403 Forbidden)', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-BAD-SIGN-${Date.now()}`;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 30000, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '200',
      gross_amount: '30000.00',
      signature_key: 'forged_fake_signature_hex_1234567890abcdef',
      transaction_status: 'settlement'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 403, 'Signature yang salah harus ditolak 403');
  assert.equal(res._json.error, 'Invalid signature');

  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Menunggu Pembayaran');
});

// =========================================================================
// SKENARIO 6: Webhook valid diproses dengan benar
// =========================================================================
test('Skenario 6: Webhook valid diproses dengan benar (status berubah ke Diproses/Berhasil)', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-VALID-WEBHOOK-${Date.now()}`;
  const totalHarga = 30000;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', totalHarga, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  // Stub topup provider
  topupProvider.processTopup = async () => ({
    success: true,
    sn: 'SN-TEST-VALID-01',
    message: 'Top up sukses (stub)'
  });

  const grossStr = '30000.00';
  const signature = generateMidtransSignature(invoice, '200', grossStr, paymentGateway.serverKey);

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '200',
      gross_amount: grossStr,
      signature_key: signature,
      transaction_status: 'settlement',
      transaction_id: 'MID-TX-TEST-001'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200, 'Webhook valid harus menghasilkan HTTP 200');

  // Berikan jeda sejenak untuk worker async
  await new Promise(r => setTimeout(r, 200));

  const orderInDb = await dbAsync.get('SELECT status, sn, payment_ref FROM orders WHERE invoice_number = ?', [invoice]);
  assert.ok(['Diproses', 'Berhasil'].includes(orderInDb.status), 'Status pesanan harus berlanjut ke Diproses / Berhasil');
  assert.equal(orderInDb.payment_ref, 'MID-TX-TEST-001');
});

// =========================================================================
// SKENARIO 7: Webhook identik yang dikirim dua kali tidak menyebabkan top-up ganda
// =========================================================================
test('Skenario 7: Webhook identik yang dikirim berulang (replay) bersifat idempoten & tidak top-up ganda', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-IDEMP-REPLAY-${Date.now()}`;
  const totalHarga = 30000;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', totalHarga, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  let topupCallCount = 0;
  topupProvider.processTopup = async () => {
    topupCallCount++;
    return { success: true, sn: `SN-IDEMP-${Date.now()}` };
  };

  const grossStr = '30000.00';
  const signature = generateMidtransSignature(invoice, '200', grossStr, paymentGateway.serverKey);
  const payload = {
    order_id: invoice,
    status_code: '200',
    gross_amount: grossStr,
    signature_key: signature,
    transaction_status: 'settlement',
    transaction_id: 'MID-TX-IDEMP-01'
  };

  // Kirim Webhook 1
  const call1 = createMockReqRes({ body: payload });
  await webhookController.handlePaymentWebhook(call1.req, call1.res);
  assert.equal(call1.res.statusCode, 200);

  // Tunggu worker selesai
  await new Promise(r => setTimeout(r, 150));

  // Kirim Webhook 2 (duplikat persis)
  const call2 = createMockReqRes({ body: payload });
  await webhookController.handlePaymentWebhook(call2.req, call2.res);
  assert.equal(call2.res.statusCode, 200, 'Webhook duplikat harus dijawab 200 OK');

  await new Promise(r => setTimeout(r, 100));

  assert.equal(topupCallCount, 1, 'Provider top up hanya boleh dipanggil tepat 1 kali, bukan 2 kali');
});

// =========================================================================
// SKENARIO 8: Webhook bersamaan tidak menyebabkan top-up ganda (Race Condition)
// =========================================================================
test('Skenario 8: Webhook bersamaan (concurrent race condition) terlindungi secara atomik', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-RACE-COND-${Date.now()}`;
  const totalHarga = 30000;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', totalHarga, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  let providerHits = 0;
  topupProvider.processTopup = async () => {
    providerHits++;
    return { success: true, sn: `SN-RACE-${Date.now()}` };
  };

  const grossStr = '30000.00';
  const signature = generateMidtransSignature(invoice, '200', grossStr, paymentGateway.serverKey);
  const payload = {
    order_id: invoice,
    status_code: '200',
    gross_amount: grossStr,
    signature_key: signature,
    transaction_status: 'settlement',
    transaction_id: 'MID-TX-RACE-01'
  };

  const reqRes1 = createMockReqRes({ body: payload });
  const reqRes2 = createMockReqRes({ body: payload });

  // Tembakkan 2 webhook hampir pada milidetik yang sama persis
  await Promise.all([
    webhookController.handlePaymentWebhook(reqRes1.req, reqRes1.res),
    webhookController.handlePaymentWebhook(reqRes2.req, reqRes2.res)
  ]);

  await new Promise(r => setTimeout(r, 200));

  assert.equal(providerHits, 1, 'Hanya boleh ada 1 kali eksekusi top up meskipun 2 webhook tiba bersamaan');
});

// =========================================================================
// SKENARIO 9: Pembayaran pending tidak memicu pemenuhan
// =========================================================================
test('Skenario 9: Pembayaran pending tidak memicu pemenuhan produk', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-PENDING-WEBHOOK-${Date.now()}`;
  const totalHarga = 30000;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', totalHarga, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  let providerCalled = false;
  topupProvider.processTopup = async () => {
    providerCalled = true;
    return { success: true };
  };

  const grossStr = '30000.00';
  const signature = generateMidtransSignature(invoice, '201', grossStr, paymentGateway.serverKey);

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '201',
      gross_amount: grossStr,
      signature_key: signature,
      transaction_status: 'pending'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200);

  await new Promise(r => setTimeout(r, 100));

  assert.equal(providerCalled, false, 'Status pending tidak boleh memanggil provider game');
  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Menunggu Pembayaran');
});

// =========================================================================
// SKENARIO 10: Pembayaran kedaluwarsa ditangani dengan benar (status Gagal & refund poin)
// =========================================================================
test('Skenario 10: Pembayaran kedaluwarsa (expire) ditangani dengan benar (Gagal & refund poin)', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-EXPIRE-POINT-${Date.now()}`;
  const user = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  const initialPoints = user.points;
  const pointsUsed = 15;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, points_used, status, points_refunded, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [invoice, 999, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 28500, pointsUsed, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  const grossStr = '28500.00';
  const signature = generateMidtransSignature(invoice, '202', grossStr, paymentGateway.serverKey);

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '202',
      gross_amount: grossStr,
      signature_key: signature,
      transaction_status: 'expire'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200);

  const updatedOrder = await dbAsync.get('SELECT status, points_refunded FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(updatedOrder.status, 'Gagal');
  assert.equal(updatedOrder.points_refunded, 1);

  const updatedUser = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  assert.equal(updatedUser.points, initialPoints + pointsUsed, 'Poin customer harus dikembalikan');
});

// =========================================================================
// SKENARIO 11: Poin tidak diberikan dua kali
// =========================================================================
test('Skenario 11: Poin loyalitas tidak diberikan dua kali (idempotent loyalty awarding)', async () => {
  const invoice = `TEST-DOUBLE-POINTS-${Date.now()}`;
  const userBefore = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  const startPoints = userBefore.points;
  const orderTotal = 30000;
  const pointsExpected = Math.floor(orderTotal / 10000); // 3 Poin

  const insertRes = await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, status, points_awarded, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [invoice, 999, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', orderTotal, 'Diproses', 'Midtrans QRIS']
  );
  const orderId = insertRes.id;

  topupProvider.processTopup = async () => ({ success: true, sn: 'SN-POINTS-11' });

  // Pemicu 1 melalui orderQueue
  await orderQueue.enqueue({
    id: orderId,
    invoice_number: invoice,
    user_id: 999,
    nama_item: '100 Diamonds Test',
    total_harga: orderTotal,
    status: 'Diproses'
  });

  await new Promise(r => setTimeout(r, 150));

  const userAfter1 = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  assert.equal(userAfter1.points, startPoints + pointsExpected, 'Poin harus bertambah 3');

  // Pemicu 2 (simulasi webhook callback sukses datang lagi dari Digiflazz)
  const reqRes = createMockReqRes({
    body: {
      data: {
        ref_id: invoice,
        status: 'Sukses',
        sn: 'SN-POINTS-11-DUPE'
      }
    }
  });
  await webhookController.handleDigiflazzWebhook(reqRes.req, reqRes.res);

  const userAfter2 = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  assert.equal(userAfter2.points, startPoints + pointsExpected, 'Poin TIDAK boleh bertambah dua kali');
});

// =========================================================================
// SKENARIO 12: Pengembalian poin tidak dilakukan dua kali
// =========================================================================
test('Skenario 12: Pengembalian poin (refund) tidak dilakukan dua kali', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-DOUBLE-REFUND-${Date.now()}`;
  const user = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  const pointsStart = user.points;
  const pointsUsed = 20;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, points_used, status, points_refunded, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [invoice, 999, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 28000, pointsUsed, 'Menunggu Pembayaran', 'Midtrans QRIS']
  );

  const grossStr = '28000.00';
  const signature = generateMidtransSignature(invoice, '202', grossStr, paymentGateway.serverKey);
  const expirePayload = {
    order_id: invoice,
    status_code: '202',
    gross_amount: grossStr,
    signature_key: signature,
    transaction_status: 'expire'
  };

  // Expire 1
  const call1 = createMockReqRes({ body: expirePayload });
  await webhookController.handlePaymentWebhook(call1.req, call1.res);

  const userAfterRefund1 = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  assert.equal(userAfterRefund1.points, pointsStart + pointsUsed);

  // Expire 2 (misalnya callback kedua atau cancel datang lagi)
  const call2 = createMockReqRes({ body: expirePayload });
  await webhookController.handlePaymentWebhook(call2.req, call2.res);

  const userAfterRefund2 = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  assert.equal(userAfterRefund2.points, pointsStart + pointsUsed, 'Poin tidak boleh di-refund dua kali');
});

// =========================================================================
// SKENARIO 13: Timeout Digiflazz tidak menyebabkan retry berbahaya
// =========================================================================
test('Skenario 13: Timeout Digiflazz ditandai pending & tidak menyebabkan retry berbahaya', async () => {
  topupProvider.processTopup = originalProcessTopup;

  const origUsername = process.env.DIGIFLAZZ_USERNAME;
  const origDevKey = process.env.DIGIFLAZZ_DEV_KEY;
  const origKey = process.env.DIGIFLAZZ_KEY;
  const origApiKey = process.env.DIGIFLAZZ_API_KEY;

  process.env.DIGIFLAZZ_USERNAME = 'test_user_valid';
  process.env.DIGIFLAZZ_DEV_KEY = 'dev-test-key-valid';
  process.env.DIGIFLAZZ_KEY = 'dev-test-key-valid';
  process.env.DIGIFLAZZ_API_KEY = 'dev-test-key-valid';

  // Stub requestTransaction to simulate network timeout
  const originalRequest = topupProvider.requestTransaction;
  topupProvider.requestTransaction = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  };

  try {
    const res = await topupProvider.processTopup({
      invoice_number: `TIMEOUT-${Date.now()}`,
      product_id: 'xld10',
      game_user_id: '123456',
      server_id: '2114',
      game: 'mlbb'
    });

    assert.equal(res.pending, true, 'Saat Digiflazz timeout, status harus pending untuk verifikasi/rekonsiliasi');
    assert.equal(res.success, true, 'Operasi tidak langsung dianggap gagal final');
  } finally {
    topupProvider.requestTransaction = originalRequest;
    if (origUsername) process.env.DIGIFLAZZ_USERNAME = origUsername; else delete process.env.DIGIFLAZZ_USERNAME;
    if (origDevKey) process.env.DIGIFLAZZ_DEV_KEY = origDevKey; else delete process.env.DIGIFLAZZ_DEV_KEY;
    if (origKey) process.env.DIGIFLAZZ_KEY = origKey; else delete process.env.DIGIFLAZZ_KEY;
    if (origApiKey) process.env.DIGIFLAZZ_API_KEY = origApiKey; else delete process.env.DIGIFLAZZ_API_KEY;
  }
});

// =========================================================================
// SKENARIO 14: Fallback Midtrans dilakukan hanya untuk kondisi yang sesuai
// =========================================================================
test('Skenario 14: Fallback ke Snap hanya dijalankan jika QRIS belum aktif, bukan untuk semua error', async () => {
  const origProdEnv = process.env.MIDTRANS_IS_PRODUCTION;
  const origKey = process.env.MIDTRANS_SERVER_KEY;

  process.env.MIDTRANS_IS_PRODUCTION = 'true';
  process.env.MIDTRANS_SERVER_KEY = 'Mid-server-prod-key-12345';
  paymentGateway.reloadConfig(true);

  const originalCoreCharge = paymentGateway.coreApi.charge;
  const originalSnapCreate = paymentGateway.snap.createTransaction;

  try {
    // 14A. Kondisi yang diperbolehkan: 'Payment channel is not activated'
    paymentGateway.coreApi.charge = async () => {
      throw new Error('Midtrans API Error: Payment channel is not activated');
    };
    paymentGateway.snap.createTransaction = async () => ({
      token: 'snap-token-fallback-test',
      redirect_url: 'https://app.midtrans.com/snap/v2/vtweb/snap-token-fallback-test'
    });

    const resFallback = await paymentGateway.createQrisTransaction({
      invoice_number: `FB-TEST-${Date.now()}`,
      total_harga: 50000,
      nama_item: 'Fallback Test Item'
    });

    assert.equal(resFallback.is_fallback_snap, true, 'Harus beralih ke fallback Snap');
    assert.equal(resFallback.snap_token, 'snap-token-fallback-test');
    assert.equal(resFallback.qris_url, null, 'Tidak boleh menampilkan gambar QRIS palsu');

    // 14B. Kondisi yang TIDAK diperbolehkan: 401 Unauthorized (kredensial salah)
    paymentGateway.coreApi.charge = async () => {
      throw new Error('Midtrans API Error 401: Access denied due to unauthorized key');
    };

    let caughtError = null;
    try {
      await paymentGateway.createQrisTransaction({
        invoice_number: `ERR-TEST-${Date.now()}`,
        total_harga: 50000,
        nama_item: 'Error Test Item'
      });
    } catch (e) {
      caughtError = e;
    }

    assert.ok(caughtError, 'Error 401 harus dilempar sebagai error, BUKAN dialihkan ke Snap fallback');
    assert.ok(caughtError.message.includes('401') || caughtError.message.includes('Midtrans Production'));
  } finally {
    paymentGateway.coreApi.charge = originalCoreCharge;
    paymentGateway.snap.createTransaction = originalSnapCreate;
    process.env.MIDTRANS_IS_PRODUCTION = origProdEnv || 'false';
    process.env.MIDTRANS_SERVER_KEY = origKey || 'SB-Mid-server-test-key';
    paymentGateway.reloadConfig(true);
  }
});

// =========================================================================
// SKENARIO 15: Sistem tidak menggunakan sandbox secara diam-diam ketika production aktif
// =========================================================================
test('Skenario 15: Sistem tidak menggunakan sandbox secara diam-diam ketika production aktif', async () => {
  const origProdEnv = process.env.MIDTRANS_IS_PRODUCTION;
  const origKey = process.env.MIDTRANS_SERVER_KEY;

  process.env.MIDTRANS_IS_PRODUCTION = 'true';
  process.env.MIDTRANS_SERVER_KEY = 'Mid-server-prod-key-99999';
  paymentGateway.reloadConfig(true);

  const originalCoreCharge = paymentGateway.coreApi.charge;
  paymentGateway.coreApi.charge = async () => {
    throw new Error('Midtrans 500: Internal server error on live gateway');
  };

  try {
    let errOccurred = false;
    try {
      await paymentGateway.createQrisTransaction({
        invoice_number: `PROD-NO-SANDBOX-${Date.now()}`,
        total_harga: 50000,
        nama_item: 'Prod Item'
      });
    } catch (err) {
      errOccurred = true;
      assert.ok(err.message.includes('Midtrans Production'), 'Harus melempar error production resmi');
    }
    assert.equal(errOccurred, true, 'Production yang gagal tidak boleh diam-diam mengembalikan mock sandbox');
  } finally {
    paymentGateway.coreApi.charge = originalCoreCharge;
    process.env.MIDTRANS_IS_PRODUCTION = origProdEnv || 'false';
    process.env.MIDTRANS_SERVER_KEY = origKey || 'SB-Mid-server-test-key';
    paymentGateway.reloadConfig(true);
  }
});

// =========================================================================
// SKENARIO 16: Webhook settlement datang setelah expire (status Gagal tidak tertimpa)
// =========================================================================
test('Skenario 16: Webhook settlement datang setelah expire ditolak & status Gagal tidak tertimpa', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-SETTLE-AFTER-EXP-${Date.now()}`;
  const totalHarga = 30000;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, failure_reason, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 'Gagal', 'Midtrans: Pembayaran expire', 'Midtrans QRIS')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', totalHarga]
  );

  let providerCalled = false;
  topupProvider.processTopup = async () => {
    providerCalled = true;
    return { success: true, sn: 'SN-ILLEGAL' };
  };

  const grossStr = '30000.00';
  const signature = generateMidtransSignature(invoice, '200', grossStr, paymentGateway.serverKey);
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '200',
      gross_amount: grossStr,
      signature_key: signature,
      transaction_status: 'settlement'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200);

  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Gagal', 'Status Gagal tidak boleh ditimpa menjadi Diproses/Berhasil oleh settlement terlambat');
  assert.equal(providerCalled, false, 'Top up provider tidak boleh dipanggil untuk pesanan yang sudah gagal/expired');
});

// =========================================================================
// SKENARIO 17: Webhook expire datang setelah pesanan Berhasil (tidak ada refund keliru)
// =========================================================================
test('Skenario 17: Webhook expire datang setelah pesanan Berhasil diabaikan & poin tidak di-refund', async () => {
  paymentGateway.serverKey = 'SB-Mid-server-test-key';
  const invoice = `TEST-EXP-AFTER-SUCC-${Date.now()}`;
  const user = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  const pointsBefore = user.points;
  const pointsUsed = 20;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, points_used, status, points_awarded, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 28000, ?, 'Berhasil', 1, 'Midtrans QRIS')`,
    [invoice, 999, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', pointsUsed]
  );

  const grossStr = '28000.00';
  const signature = generateMidtransSignature(invoice, '202', grossStr, paymentGateway.serverKey);
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '202',
      gross_amount: grossStr,
      signature_key: signature,
      transaction_status: 'expire'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200);

  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Berhasil', 'Status Berhasil tidak boleh ditimpa menjadi Gagal');

  const userAfter = await dbAsync.get('SELECT points FROM users WHERE id = 999');
  assert.equal(userAfter.points, pointsBefore, 'Poin tidak boleh di-refund untuk pesanan yang sudah berhasil');
});

// =========================================================================
// SKENARIO 18: Dua worker mencoba memproses invoice yang sama di antrean
// =========================================================================
test('Skenario 18: Dua worker mencoba memproses invoice yang sama di queue (hanya 1 eksekusi provider)', async () => {
  const invoice = `TEST-DUAL-WORKER-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 'Diproses', 'Midtrans QRIS')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 30000]
  );
  const order = await dbAsync.get('SELECT * FROM orders WHERE invoice_number = ?', [invoice]);

  let executionCount = 0;
  topupProvider.processTopup = async () => {
    executionCount++;
    return { success: true, sn: `SN-WORKER-${Date.now()}` };
  };

  // Worker 1 memproses dan menyelesaikan order
  await orderQueue.enqueue(order);

  // Worker 2 mencoba memproses order yang sama
  await orderQueue.enqueue(order);

  assert.equal(executionCount, 1, 'Provider top up hanya boleh dieksekusi 1 kali meskipun ada 2 worker');
});

// =========================================================================
// SKENARIO 19: Server crash saat status Diproses dapat dipulihkan via admin retry
// =========================================================================
test('Skenario 19: Pesanan terhenti saat status Diproses dapat dipulihkan via retryOrder admin', async () => {
  const adminController = require('../src/controllers/admin.controller');
  const invoice = `TEST-STUCK-RETRY-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 'Diproses', 'Midtrans QRIS')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 30000]
  );
  const order = await dbAsync.get('SELECT * FROM orders WHERE invoice_number = ?', [invoice]);

  let retried = false;
  topupProvider.processTopup = async () => {
    retried = true;
    return { success: true, sn: 'SN-RECOVERED' };
  };

  const { req, res } = createMockReqRes({
    params: { id: order.id },
    user: { id: 1, role: 'admin' }
  });

  await adminController.retryOrder(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.success, true);
  await new Promise(r => setTimeout(r, 100));
  assert.equal(retried, true, 'retryOrder harus berhasil memicu antrean pemrosesan kembali');
});

// =========================================================================
// SKENARIO 20: Penggunaan poin bersamaan pada dua checkout tidak menyebabkan saldo minus
// =========================================================================
test('Skenario 20: Penggunaan poin bersamaan pada dua checkout tidak menyebabkan saldo minus', async () => {
  // Buat user dengan tepat 10 poin
  const testUserId = 8888;
  await dbAsync.run(
    `INSERT OR REPLACE INTO users (id, nama, email, password_hash, points, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testUserId, 'User Concurrent Point', 'concurrent@point.com', 'hash', 10, 'user']
  );

  const payloadOrder = {
    product_id: 'test_item_1',
    game: 'mlbb',
    game_user_id: '123456',
    server_id: '2001',
    wa_email_guest: 'concurrent@point.com',
    payment_method: 'Virtual Account',
    payment_channel: 'bni_va',
    use_points: true,
    points_to_use: 10
  };

  // Simulasikan 2 request checkout simultan dari user yang sama dengan saldo 10 poin
  const reqRes1 = createMockReqRes({ body: payloadOrder, user: { id: testUserId } });
  const reqRes2 = createMockReqRes({ body: payloadOrder, user: { id: testUserId } });

  await Promise.all([
    orderController.createOrder(reqRes1.req, reqRes1.res),
    orderController.createOrder(reqRes2.req, reqRes2.res)
  ]);

  const userAfter = await dbAsync.get('SELECT points FROM users WHERE id = ?', [testUserId]);
  assert.ok(userAfter.points >= 0, `Saldo poin pengguna tidak boleh menjadi negatif! Saldo aktual: ${userAfter.points}`);
  assert.equal(userAfter.points, 0, 'Dari 10 poin, hanya tepat 10 poin yang boleh terpotong');
});

// =========================================================================
// SKENARIO 21: Guest token tidak valid ditolak saat meminta payment-link
// =========================================================================
test('Skenario 21: Guest token tidak valid ditolak saat meminta payment-link (403 Forbidden)', async () => {
  const invoice = `TEST-GUEST-TOKEN-${Date.now()}`;
  const validToken = 'secret-token-abc-123';

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 'Menunggu Pembayaran', ?, 'Midtrans QRIS')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', '081299998888', 30000, validToken]
  );

  const paymentRoutes = require('../src/routes/payment.routes');
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      access_token: 'fake-invalid-token'
    }
  });

  // Panggil route POST /payment-link
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  await handler(req, res);

  assert.equal(res.statusCode, 403, 'Guest token tidak valid harus ditolak 403');
  assert.equal(res._json.success, false);
});

// =========================================================================
// SKENARIO 22: Guest token milik invoice lain ditolak (isolasi antar invoice)
// =========================================================================
test('Skenario 22: Guest token milik invoice lain ditolak (isolasi antar invoice tamu)', async () => {
  const invoiceA = `TEST-ORDER-A-${Date.now()}`;
  const tokenA = 'token-for-order-a-111';
  const invoiceB = `TEST-ORDER-B-${Date.now()}`;
  const tokenB = 'token-for-order-b-222';

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', ?, 'Midtrans QRIS')`,
    [invoiceA, 'test_item_1', 'mlbb', 'Item A', '081299998888', tokenA]
  );

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', ?, 'Midtrans QRIS')`,
    [invoiceB, 'test_item_1', 'mlbb', 'Item B', '081299998888', tokenB]
  );

  const paymentRoutes = require('../src/routes/payment.routes');
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  // Mencoba akses Order A menggunakan Token milik Order B
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoiceA,
      access_token: tokenB
    }
  });

  await handler(req, res);
  assert.equal(res.statusCode, 403, 'Akses invoice A menggunakan token invoice B harus ditolak 403');
});

// =========================================================================
// SKENARIO 23: Invoice lama tanpa token (legacy order) ditolak tanpa otorisasi (DENY BY DEFAULT)
// =========================================================================
test('Skenario 23: Invoice lama tanpa token (legacy order) ditolak tanpa otorisasi (DENY BY DEFAULT 403)', async () => {
  const invoiceLegacy = `TEST-LEGACY-NO-TOKEN-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', NULL, 'Virtual Account')`,
    [invoiceLegacy, 'test_item_1', 'mlbb', 'Legacy Item', '081299998888']
  );

  let paymentLinkGenerated = false;
  paymentGateway.createPaymentLink = async (payload) => {
    paymentLinkGenerated = true;
    return {
      order_id: payload.invoice_number,
      payment_url: 'https://app.midtrans.com/snap/v2/vtweb/legacy',
      redirect_url: 'https://app.midtrans.com/snap/v2/vtweb/legacy',
      token: 'legacy-token'
    };
  };

  const paymentRoutes = require('../src/routes/payment.routes');
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const { req, res } = createMockReqRes({
    body: { order_id: invoiceLegacy }
  });

  await handler(req, res);
  assert.equal(res.statusCode, 403, 'Legacy order tanpa access_token harus ditolak 403');
  assert.equal(res._json.success, false);
  assert.ok(
    res._json.message.includes('Transaksi ini dibuat menggunakan sistem sebelumnya'),
    'Pesan harus mengarahkan ke verifikasi customer service'
  );
  assert.equal(paymentLinkGenerated, false, 'Payment link tidak boleh dibuat untuk order legacy tanpa otorisasi');

  // Pastikan record di database tetap utuh dan tidak bermutasi
  const legacyInDb = await dbAsync.get('SELECT * FROM orders WHERE invoice_number = ?', [invoiceLegacy]);
  assert.equal(legacyInDb.status, 'Menunggu Pembayaran', 'Status pesanan legacy tidak boleh berubah');
  assert.equal(legacyInDb.access_token, null, 'access_token pesanan legacy tidak boleh dibuat otomatis');
});

// =========================================================================
// SKENARIO 24: Migrasi / initDatabase dijalankan berulang kali bersifat idempoten & aman
// =========================================================================
test('Skenario 24: Migrasi / initDatabase dijalankan berulang kali bersifat idempoten & aman', async () => {
  // Eksekusi initDatabase dua kali secara berturut-turut
  await assert.doesNotReject(async () => {
    await initDatabase();
    await initDatabase();
  }, 'initDatabase harus idempoten dan tidak boleh melempar error saat dijalankan ulang');
});

// =========================================================================
// SKENARIO 25: Proteksi kebocoran token akses tamu pada endpoint pelacakan publik
// =========================================================================
test('Skenario 25: Proteksi kebocoran token akses tamu pada endpoint pelacakan publik (getOrder)', async () => {
  const invoice = `TEST-PUBLIC-TRACK-${Date.now()}`;
  const secretToken = 'super-secret-token-xyz';

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', ?, 'Midtrans QRIS')`,
    [invoice, 'test_item_1', 'mlbb', 'Public Track Item', '081299998888', secretToken]
  );

  // Panggil getOrder tanpa menyertakan token (pengguna publik umum yang hanya mencari nomor invoice)
  const { req, res } = createMockReqRes({
    query: { invoice },
    method: 'GET'
  });

  await orderController.getOrder(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.success, true);

  // Pastikan access_token TIDAK bocor ke publik
  assert.equal(res._json.order.access_token, undefined, 'access_token harus disembunyikan/dihapus dari respon pelacakan publik');
});

// =========================================================================
// SUITE PENGUJIAN OTOMATIS: MIDTRANS PRODUCTION VA + QRIS DEMO (SKENARIO 26-40)
// =========================================================================

// SKENARIO 26: Tampil dialog QRIS demo ketika opsi diklik (Frontend contract / modal)
test('Skenario 26: Tampil dialog QRIS demo ketika opsi diklik (UI Contract & Modal Check)', async () => {
  const fs = require('fs');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../../frontend/index.html'), 'utf8');
  const paymentsJs = fs.readFileSync(path.join(__dirname, '../../frontend/src/data/payments.js'), 'utf8');
  const accordionJs = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/paymentAccordion.js'), 'utf8');

  // 1. Pastikan modal demo terdefinisi di HTML
  assert.ok(indexHtml.includes('id="qris-demo-modal"'), 'index.html harus memuat #qris-demo-modal');
  assert.ok(indexHtml.includes('DEMO — TIDAK UNTUK PEMBAYARAN'), 'index.html modal harus mencantumkan teks DEMO');

  // 2. Pastikan payments.js mendefinisikan QRIS sebagai demo
  assert.ok(paymentsJs.includes("id: 'qris_demo'"), 'payments.js harus mengelompokkan QRIS dalam kategori qris_demo');
  assert.ok(paymentsJs.includes("isDemo: true"), 'metode QRIS harus memiliki atribut isDemo: true');
  assert.ok(paymentsJs.includes("status: 'Belum Aktif'"), 'status QRIS harus Belum Aktif');

  // 3. Pastikan interaksi klik pada demo membuka modal dialog dan memblokir checkout
  assert.ok(accordionJs.includes('openQrisDemoModal'), 'paymentAccordion harus memanggil openQrisDemoModal saat opsi demo diklik');
});

// SKENARIO 27: Watermark / label demo terverifikasi pada asset dan modal
test('Skenario 27: Watermark / label demo terverifikasi pada asset SVG dan modal dialog', async () => {
  const fs = require('fs');
  const svgPath = path.join(__dirname, '../../frontend/public/assets/payments/qris_demo_watermark.svg');
  assert.ok(fs.existsSync(svgPath), 'File qris_demo_watermark.svg harus ada di direktori assets');

  const svgContent = fs.readFileSync(svgPath, 'utf8');
  assert.ok(svgContent.includes('DEMO — TIDAK UNTUK PEMBAYARAN'), 'SVG harus memiliki watermark DEMO — TIDAK UNTUK PEMBAYARAN');
  assert.ok(svgContent.includes('HANYA UNTUK KEPERLUAN DEMONSTRASI'), 'SVG harus memiliki catatan demonstrasi');
});

// SKENARIO 28: QRIS demo tidak memanggil Midtrans API
test('Skenario 28: QRIS demo tidak memanggil Midtrans API (Spy verifikasi)', async () => {
  let midtransChargeCalled = 0;
  let midtransSnapCalled = 0;

  const originalCharge = paymentGateway.chargeCoreApi;
  const originalSnap = paymentGateway.createPaymentLink;

  paymentGateway.chargeCoreApi = async () => {
    midtransChargeCalled++;
    return {};
  };
  paymentGateway.createPaymentLink = async () => {
    midtransSnapCalled++;
    return {};
  };

  try {
    // Upaya membuat order dengan QRIS Demo melalui controller
    const { req, res } = createMockReqRes({
      body: {
        product_id: 'test_item_1',
        game: 'mlbb',
        game_user_id: '123456',
        server_id: '2001',
        wa_email_guest: '081299998888',
        payment_method: 'qris_demo',
        payment_channel: 'qris_demo_method'
      }
    });

    await orderController.createOrder(req, res);

    assert.equal(res.statusCode, 400, 'Endpoint harus menolak order dengan metode demo (400)');
    assert.equal(midtransChargeCalled, 0, 'Midtrans Core API tidak boleh dipanggil untuk QRIS demo');
    assert.equal(midtransSnapCalled, 0, 'Midtrans Snap API tidak boleh dipanggil untuk QRIS demo');
  } finally {
    paymentGateway.chargeCoreApi = originalCharge;
    paymentGateway.createPaymentLink = originalSnap;
  }
});

// SKENARIO 29: QRIS demo tidak membuat invoice di database backend
test('Skenario 29: QRIS demo tidak membuat invoice di database backend', async () => {
  const initialCount = (await dbAsync.get('SELECT COUNT(*) as count FROM orders')).count;

  const { req, res } = createMockReqRes({
    body: {
      product_id: 'test_item_1',
      game: 'mlbb',
      game_user_id: '123456',
      server_id: '2001',
      wa_email_guest: '081299998888',
      payment_method: 'Midtrans QRIS',
      payment_channel: 'qris'
    }
  });

  await orderController.createOrder(req, res);

  assert.equal(res.statusCode, 400);
  assert.ok(res._json.message.includes('Metode pembayaran QRIS sedang dalam tahap aktivasi'));

  const finalCount = (await dbAsync.get('SELECT COUNT(*) as count FROM orders')).count;
  assert.equal(finalCount, initialCount, 'Tabel orders tidak boleh bertambah satupun record saat metode QRIS demo diajukan');
});

// SKENARIO 30: QRIS demo tidak mengubah saldo atau tabel database pengguna
test('Skenario 30: QRIS demo tidak mengubah saldo poin pengguna atau memutasi tabel lain', async () => {
  const testUserId = 7777;
  await dbAsync.run(
    `INSERT OR REPLACE INTO users (id, nama, email, password_hash, points, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testUserId, 'User Point Immutable', 'point_immutable@test.com', 'hash', 50, 'user']
  );

  const { req, res } = createMockReqRes({
    body: {
      product_id: 'test_item_1',
      game: 'mlbb',
      game_user_id: '123456',
      server_id: '2001',
      wa_email_guest: 'point_immutable@test.com',
      payment_method: 'qris_demo',
      use_points: true,
      points_to_use: 20
    },
    user: { id: testUserId }
  });

  await orderController.createOrder(req, res);
  assert.equal(res.statusCode, 400);

  const userAfter = await dbAsync.get('SELECT points FROM users WHERE id = ?', [testUserId]);
  assert.equal(userAfter.points, 50, 'Saldo poin pengguna tidak boleh terpotong saat pesanan ditolak');
});

// SKENARIO 31: QRIS demo tidak memicu antrian Digiflazz
test('Skenario 31: QRIS demo tidak memicu antrian pemenuhan produk / Digiflazz queue', async () => {
  let digiflazzCalls = 0;
  let queueCalls = 0;

  const originalProcess = topupProvider.processTopup;
  const originalEnqueue = orderQueue.enqueueOrder;

  topupProvider.processTopup = async () => { digiflazzCalls++; return {}; };
  orderQueue.enqueueOrder = async () => { queueCalls++; };

  try {
    const { req, res } = createMockReqRes({
      body: {
        product_id: 'test_item_1',
        game: 'mlbb',
        game_user_id: '123456',
        server_id: '2001',
        wa_email_guest: '081299998888',
        payment_method: 'qris_demo',
        payment_channel: 'qris_demo_method'
      }
    });

    await orderController.createOrder(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(digiflazzCalls, 0, 'Topup provider tidak boleh dipanggil');
    assert.equal(queueCalls, 0, 'Antrian order tidak boleh dipanggil');
  } finally {
    topupProvider.processTopup = originalProcess;
    orderQueue.enqueueOrder = originalEnqueue;
  }
});

// SKENARIO 32: Tombol 'Gunakan Virtual Account' berfungsi mengarahkan ke opsi VA aktif
test('Skenario 32: Tombol Gunakan Virtual Account berfungsi (Frontend contract check)', async () => {
  const fs = require('fs');
  const mainJs = fs.readFileSync(path.join(__dirname, '../../frontend/src/main.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../../frontend/index.html'), 'utf8');

  assert.ok(indexHtml.includes('id="btn-use-va-from-demo"'), 'HTML harus menyediakan tombol #btn-use-va-from-demo');
  assert.ok(mainJs.includes('btn-use-va-from-demo'), 'main.js harus memiliki event listener untuk #btn-use-va-from-demo');
  assert.ok(mainJs.includes('.payment-method-card[data-is-demo="false"]'), 'Tombol harus mencari kartu metode pembayaran yang bukan demo');
});

// SKENARIO 33: Pembuatan pesanan VA valid menghitung nominal murni dari server backend & mengembalikan VA
test('Skenario 33: Pembuatan pesanan VA valid menghitung nominal dari database & mengembalikan detail VA', async () => {
  const { req, res } = createMockReqRes({
    body: {
      product_id: 'test_item_1',
      game: 'mlbb',
      game_user_id: '123456',
      server_id: '2001',
      wa_email_guest: 'va_customer@test.com',
      payment_method: 'Virtual Account',
      payment_channel: 'bni_va',
      total_harga: 100 // Client mencoba manipulasi harga jadi Rp 100
    }
  });

  await orderController.createOrder(req, res);
  assert.equal(res.statusCode, 201, 'Pesanan VA valid harus berhasil dibuat dengan kode 201');
  assert.equal(res._json.success, true);
  assert.ok(res._json.order, 'Respon harus memuat objek order');
  assert.equal(res._json.order.total_harga, 31000, 'Server harus menghitung harga murni Rp 30.000 + biaya VA Rp 1.000 dari database');
  assert.ok(res._json.payment_data, 'Respon harus menyertakan payment_data');
  assert.equal(res._json.payment_data.bank.toLowerCase(), 'bni');
  assert.ok(res._json.payment_data.va_number.startsWith('8808'), 'Nomor VA BNI harus berawalan prefix resmi 8808');
});

// SKENARIO 34: Pesanan VA berstatus pending tidak memicu topup Digiflazz
test('Skenario 34: Pesanan VA berstatus pending tidak memicu top-up Digiflazz', async () => {
  const invoice = `TEST-VA-PENDING-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', 'Virtual Account')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', 'va_customer@test.com']
  );

  let providerCalled = false;
  topupProvider.processTopup = async () => { providerCalled = true; return {}; };

  const signature = generateMidtransSignature(invoice, '201', '30000', process.env.MIDTRANS_SERVER_KEY);
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '201',
      gross_amount: '30000',
      signature_key: signature,
      transaction_status: 'pending',
      payment_type: 'bank_transfer',
      va_numbers: [{ bank: 'bni', va_number: '88081234567890' }]
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200);

  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Menunggu Pembayaran', 'Status tetap Menunggu Pembayaran untuk notifikasi pending');
  assert.equal(providerCalled, false, 'Topup provider tidak boleh dipanggil saat pembayaran masih pending');

  topupProvider.processTopup = originalProcessTopup;
});

// SKENARIO 35: Webhook settlement VA valid berhasil memicu fulfillment (mock)
test('Skenario 35: Webhook settlement VA valid berhasil memicu fulfillment', async () => {
  const invoice = `TEST-VA-SETTLE-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', 'Virtual Account')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', 'va_customer@test.com']
  );

  let fulfilled = false;
  topupProvider.processTopup = async () => {
    fulfilled = true;
    return { success: true, sn: `SN-VA-${Date.now()}`, message: 'Topup Berhasil' };
  };

  const signature = generateMidtransSignature(invoice, '200', '30000', process.env.MIDTRANS_SERVER_KEY);
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '200',
      gross_amount: '30000',
      signature_key: signature,
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
      va_numbers: [{ bank: 'bni', va_number: '88081234567890' }]
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200);

  // Tunggu sejenak antrian memproses
  await new Promise(r => setTimeout(r, 150));

  const orderInDb = await dbAsync.get('SELECT status, sn FROM orders WHERE invoice_number = ?', [invoice]);
  assert.ok(['Diproses', 'Berhasil'].includes(orderInDb.status), 'Status harus berubah ke Diproses atau Berhasil');
  assert.equal(fulfilled, true, 'Topup provider harus terpanggil untuk settlement valid');

  topupProvider.processTopup = originalProcessTopup;
});

// SKENARIO 36: Webhook settlement VA dengan signature salah ditolak (HTTP 403)
test('Skenario 36: Webhook settlement VA dengan signature salah ditolak (HTTP 403)', async () => {
  const invoice = `TEST-VA-BAD-SIGN-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', 'Virtual Account')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', 'va_customer@test.com']
  );

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      status_code: '200',
      gross_amount: '30000',
      signature_key: 'invalid_forged_sha512_hash',
      transaction_status: 'settlement',
      payment_type: 'bank_transfer'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 403, 'Webhook dengan signature palsu harus ditolak HTTP 403');

  const orderInDb = await dbAsync.get('SELECT status FROM orders WHERE invoice_number = ?', [invoice]);
  assert.equal(orderInDb.status, 'Menunggu Pembayaran', 'Status pesanan tidak boleh terpengaruh');
});

// SKENARIO 37: Webhook settlement VA duplikat (replay) bersifat idempoten
test('Skenario 37: Webhook settlement VA duplikat (replay) bersifat idempoten', async () => {
  const invoice = `TEST-VA-REPLAY-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', 'Virtual Account')`,
    [invoice, 'test_item_1', 'mlbb', '100 Diamonds Test', 'va_customer@test.com']
  );

  let fulfillCount = 0;
  topupProvider.processTopup = async () => {
    fulfillCount++;
    return { success: true, sn: `SN-REPLAY-${Date.now()}` };
  };

  const signature = generateMidtransSignature(invoice, '200', '30000', process.env.MIDTRANS_SERVER_KEY);
  const webhookBody = {
    order_id: invoice,
    status_code: '200',
    gross_amount: '30000',
    signature_key: signature,
    transaction_status: 'settlement',
    payment_type: 'bank_transfer'
  };

  const reqRes1 = createMockReqRes({ body: webhookBody });
  await webhookController.handlePaymentWebhook(reqRes1.req, reqRes1.res);
  assert.equal(reqRes1.res.statusCode, 200);

  await new Promise(r => setTimeout(r, 150));

  const reqRes2 = createMockReqRes({ body: webhookBody });
  await webhookController.handlePaymentWebhook(reqRes2.req, reqRes2.res);
  assert.equal(reqRes2.res.statusCode, 200);

  await new Promise(r => setTimeout(r, 100));
  assert.equal(fulfillCount, 1, 'Topup provider hanya boleh dieksekusi tepat 1 kali untuk webhook duplikat');

  topupProvider.processTopup = originalProcessTopup;
});

// SKENARIO 38: Nomor VA berasal dari respon gateway backend, bukan input client
test('Skenario 38: Nomor VA berasal dari respon gateway backend, bukan manipulasi payload client', async () => {
  const attackerInjectedVa = '9999999999999999';

  const { req, res } = createMockReqRes({
    body: {
      product_id: 'test_item_1',
      game: 'mlbb',
      game_user_id: '123456',
      server_id: '2001',
      wa_email_guest: 'va_attacker@test.com',
      payment_method: 'Virtual Account',
      payment_channel: 'bri_va',
      va_number: attackerInjectedVa,
      custom_va: attackerInjectedVa
    }
  });

  await orderController.createOrder(req, res);
  assert.equal(res.statusCode, 201);
  assert.notEqual(res._json.payment_data.va_number, attackerInjectedVa, 'Nomor VA tidak boleh mengambil nilai dari client payload');
  assert.ok(res._json.payment_data.va_number.startsWith('12800'), 'Nomor VA BRI harus menggunakan prefix gateway resmi (12800)');
});

// SKENARIO 39: Metode pembayaran VA tercatat dengan benar di basis data
test('Skenario 39: Metode pembayaran VA tercatat dengan benar di tabel orders', async () => {
  const { req, res } = createMockReqRes({
    body: {
      product_id: 'test_item_1',
      game: 'mlbb',
      game_user_id: '123456',
      server_id: '2001',
      wa_email_guest: 'va_record@test.com',
      payment_method: 'Virtual Account',
      payment_channel: 'echannel'
    }
  });

  await orderController.createOrder(req, res);
  assert.equal(res.statusCode, 201);
  const createdInvoice = res._json.order.invoice_number;

  const orderInDb = await dbAsync.get('SELECT payment_method, status FROM orders WHERE invoice_number = ?', [createdInvoice]);
  assert.equal(orderInDb.payment_method, 'Virtual Account', 'Metode pembayaran harus tercatat sebagai Virtual Account');
  assert.equal(orderInDb.status, 'Menunggu Pembayaran');
});

// SKENARIO 40: Tidak ada status order QRIS Demo yang dapat menjadi 'paid' / 'success'
test('Skenario 40: Integritas sistem: tidak ada jalan bagi order QRIS Demo untuk berstatus paid/success', async () => {
  // 1. Cek bahwa di database tidak ada order QRIS demo
  const demoOrders = await dbAsync.all(
    "SELECT * FROM orders WHERE payment_method LIKE '%demo%' OR payment_method LIKE '%Demo%'"
  );
  assert.equal(demoOrders.length, 0, 'Tidak boleh ada order demo di database orders');

  // 2. Jika ada serangan simulasi webhook mengatasnamakan invoice berawalan DEMO atau dummy
  const forgedDemoInvoice = `DEMO-ORDER-${Date.now()}`;
  const signature = generateMidtransSignature(forgedDemoInvoice, '200', '30000', process.env.MIDTRANS_SERVER_KEY);

  const { req, res } = createMockReqRes({
    body: {
      order_id: forgedDemoInvoice,
      status_code: '200',
      gross_amount: '30000',
      signature_key: signature,
      transaction_status: 'settlement',
      payment_type: 'qris'
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  // Harus 404 karena invoice demo tidak pernah ada di database
  assert.equal(res.statusCode, 404, 'Webhook untuk invoice demo yang tidak tercatat harus ditolak 404');
});

// =========================================================================
// SUITE PENGUJIAN OTOMATIS: OTORISASI LEGACY & ACCESS CONTROL (SKENARIO 41-48)
// =========================================================================

// SKENARIO 41: Pengguna terdaftar dapat meminta payment-link untuk pesanan miliknya sendiri
test('Skenario 41: Pengguna terdaftar dapat mengakses pesanan miliknya sendiri (JWT Owner Valid)', async () => {
  const invoice = `TEST-OWNER-ACCESS-${Date.now()}`;
  const ownerUserId = 999;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', 'Virtual Account')`,
    [invoice, ownerUserId, 'test_item_1', 'mlbb', 'Owner Item', 'tester@darstore.com']
  );

  paymentGateway.createPaymentLink = async (payload) => ({
    order_id: payload.invoice_number,
    payment_url: 'https://app.midtrans.com/snap/v2/vtweb/owner',
    redirect_url: 'https://app.midtrans.com/snap/v2/vtweb/owner',
    token: 'owner-token'
  });

  const paymentRoutes = require('../src/routes/payment.routes');
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const { req, res } = createMockReqRes({
    body: { order_id: invoice },
    user: { id: ownerUserId, role: 'user' }
  });

  await handler(req, res);
  assert.equal(res.statusCode, 200, 'Pemilik pesanan yang sah harus diizinkan meminta payment link');
  assert.equal(res._json.success, true);
  assert.equal(res._json.payment_url, 'https://app.midtrans.com/snap/v2/vtweb/owner');
});

// SKENARIO 42: Pengguna terdaftar lain ditolak saat mencoba meminta payment-link pesanan orang lain (403)
test('Skenario 42: Pengguna terdaftar lain ditolak saat mengakses pesanan orang lain (Cross-User Isolation 403)', async () => {
  const invoice = `TEST-CROSS-USER-${Date.now()}`;
  const ownerUserId = 999;
  const intruderUserId = 888;

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, status, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', 'Virtual Account')`,
    [invoice, ownerUserId, 'test_item_1', 'mlbb', 'Owner Item', 'tester@darstore.com']
  );

  const paymentRoutes = require('../src/routes/payment.routes');
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const { req, res } = createMockReqRes({
    body: { order_id: invoice },
    user: { id: intruderUserId, role: 'user' }
  });

  await handler(req, res);
  assert.equal(res.statusCode, 403, 'Pengguna lain harus ditolak 403 Forbidden');
  assert.equal(res._json.success, false);
  assert.ok(res._json.message.includes('Akses ditolak'));
});

// SKENARIO 43: Tamu baru dengan token valid dapat meminta informasi pembayaran (payment-link)
test('Skenario 43: Tamu baru dengan token valid dapat meminta informasi pembayaran (payment-link)', async () => {
  const invoice = `TEST-NEW-GUEST-${Date.now()}`;
  const guestToken = 'secure-valid-guest-token-12345';

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, user_id, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, NULL, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', ?, 'Virtual Account')`,
    [invoice, 'test_item_1', 'mlbb', 'Guest Item', 'guest@darstore.com', guestToken]
  );

  paymentGateway.createPaymentLink = async (payload) => ({
    order_id: payload.invoice_number,
    payment_url: 'https://app.midtrans.com/snap/v2/vtweb/guest',
    redirect_url: 'https://app.midtrans.com/snap/v2/vtweb/guest',
    token: 'guest-link-token'
  });

  const paymentRoutes = require('../src/routes/payment.routes');
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const { req, res } = createMockReqRes({
    body: {
      order_id: invoice,
      access_token: guestToken
    }
  });

  await handler(req, res);
  assert.equal(res.statusCode, 200, 'Tamu dengan token valid harus diizinkan meminta payment link');
  assert.equal(res._json.success, true);
});

// SKENARIO 44: Nomor invoice saja tidak cukup: endpoint pelacakan publik menyamarkan kontak dan menghapus redirect_url & token
test('Skenario 44: Nomor invoice saja tidak cukup: pelacakan publik menyamarkan kontak dan menghapus rahasia', async () => {
  const invoice = `TEST-MASK-PUBLIC-${Date.now()}`;
  const fullPhone = '081298765432';
  const secretGuestToken = 'secret-token-do-not-leak';
  const sensitiveRedirectUrl = 'https://app.midtrans.com/snap/v2/vtweb/secret-session-abc';

  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, redirect_url, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', ?, ?, 'Virtual Account')`,
    [invoice, 'test_item_1', 'mlbb', 'Public Order', fullPhone, secretGuestToken, sensitiveRedirectUrl]
  );

  const { req, res } = createMockReqRes({
    query: { invoice },
    method: 'GET'
  });

  await orderController.getOrder(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res._json.success, true);

  const returnedOrder = res._json.order;
  // 1. Token akses tidak boleh tampil
  assert.equal(returnedOrder.access_token, undefined, 'access_token harus disembunyikan');
  // 2. URL pembayaran sensitif tidak boleh tampil untuk pihak publik tanpa token
  assert.equal(returnedOrder.redirect_url, undefined, 'redirect_url sensitif harus disembunyikan dari publik');
  // 3. Kontak nomor telepon harus disamarkan
  assert.ok(returnedOrder.wa_email_guest.includes('****'), 'Kontak nomor telepon harus disamarkan (masked)');
  assert.notEqual(returnedOrder.wa_email_guest, fullPhone, 'Kontak lengkap tidak boleh bocor ke publik');
});

// SKENARIO 45: Administrator yang sah dapat melihat detail pesanan (termasuk legacy order) melalui admin endpoint
test('Skenario 45: Administrator yang sah dapat mengakses pesanan legacy melalui endpoint admin', async () => {
  const invoiceLegacy = `TEST-ADMIN-LEGACY-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', NULL, 'Virtual Account')`,
    [invoiceLegacy, 'test_item_1', 'mlbb', 'Legacy Order Admin', 'legacy@darstore.com']
  );

  const legacyOrderRow = await dbAsync.get('SELECT id FROM orders WHERE invoice_number = ?', [invoiceLegacy]);

  const adminController = require('../src/controllers/admin.controller');
  const { req, res } = createMockReqRes({
    params: { id: legacyOrderRow.id },
    user: { id: 1, role: 'admin' },
    method: 'GET'
  });

  await adminController.getOrderDetail(req, res);
  assert.equal(res.statusCode, 200, 'Admin harus dapat mengakses detail pesanan legacy');
  assert.equal(res._json.success, true);
  assert.equal(res._json.order.invoice_number, invoiceLegacy);
});

// SKENARIO 46: Pengguna non-admin ditolak saat mengakses endpoint admin (requireAdmin 403)
test('Skenario 46: Pengguna biasa ditolak saat mengakses fungsi admin (requireAdmin 403)', async () => {
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../src/middlewares/auth.middleware');
  const requireAdmin = require('../src/middlewares/isAdmin.middleware');

  // Token pengguna biasa (role: 'user')
  const userToken = jwt.sign({ id: 999, role: 'user' }, JWT_SECRET);

  const { req, res } = createMockReqRes({
    headers: { authorization: `Bearer ${userToken}` }
  });

  let nextCalled = false;
  await requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 403, 'Pengguna biasa harus ditolak 403');
  assert.equal(nextCalled, false, 'Middleware tidak boleh memanggil next()');
  assert.ok(res._json.message.includes('Fitur ini khusus untuk Administrator'));
});

// SKENARIO 47: Upaya pembuatan tagihan baru pada legacy order ditolak dan tidak mengubah status di DB
test('Skenario 47: Upaya pembuatan tagihan baru pada legacy order ditolak dan tidak mengubah status di DB', async () => {
  const invoiceLegacy = `TEST-LEGACY-IMMUTABLE-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', NULL, 'Virtual Account')`,
    [invoiceLegacy, 'test_item_1', 'mlbb', 'Legacy Immutable Item', '081299998888']
  );

  const paymentRoutes = require('../src/routes/payment.routes');
  const layer = paymentRoutes.stack.find(s => s.route && s.route.path === '/payment-link' && s.route.methods.post);
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const { req, res } = createMockReqRes({
    body: { order_id: invoiceLegacy }
  });

  await handler(req, res);
  assert.equal(res.statusCode, 403);

  const orderAfter = await dbAsync.get('SELECT * FROM orders WHERE invoice_number = ?', [invoiceLegacy]);
  assert.equal(orderAfter.status, 'Menunggu Pembayaran', 'Status pesanan legacy tidak boleh berubah');
  assert.equal(orderAfter.access_token, null, 'Tidak boleh ada pembuatan access_token liar');
});

// SKENARIO 48: Webhook Midtrans tetap dapat memproses settlement pesanan legacy secara sah
test('Skenario 48: Webhook settlement Midtrans tetap dapat memproses pesanan legacy secara sah', async () => {
  const invoiceLegacy = `TEST-LEGACY-SETTLE-${Date.now()}`;
  await dbAsync.run(
    `INSERT INTO orders (invoice_number, product_id, game, nama_item, wa_email_guest, total_harga, status, access_token, payment_method)
     VALUES (?, ?, ?, ?, ?, 30000, 'Menunggu Pembayaran', NULL, 'Virtual Account')`,
    [invoiceLegacy, 'test_item_1', 'mlbb', 'Legacy Settle Item', '081299998888']
  );

  let fulfilled = false;
  topupProvider.processTopup = async () => {
    fulfilled = true;
    return { success: true, sn: `SN-LEGACY-${Date.now()}`, message: 'Topup Berhasil' };
  };

  const signature = generateMidtransSignature(invoiceLegacy, '200', '30000', process.env.MIDTRANS_SERVER_KEY);
  const { req, res } = createMockReqRes({
    body: {
      order_id: invoiceLegacy,
      status_code: '200',
      gross_amount: '30000',
      signature_key: signature,
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
      va_numbers: [{ bank: 'bni', va_number: '88081234567890' }]
    }
  });

  await webhookController.handlePaymentWebhook(req, res);
  assert.equal(res.statusCode, 200, 'Webhook sah harus tetap dapat memproses pesanan legacy');

  await new Promise(r => setTimeout(r, 150));

  const orderInDb = await dbAsync.get('SELECT status, sn FROM orders WHERE invoice_number = ?', [invoiceLegacy]);
  assert.ok(['Diproses', 'Berhasil'].includes(orderInDb.status), 'Status pesanan legacy harus terupdate menjadi Diproses/Berhasil');
  assert.equal(fulfilled, true, 'Topup provider harus terpanggil untuk pemenuhan pesanan');

  topupProvider.processTopup = originalProcessTopup;
});

// SKENARIO 49: Endpoint check-ml-account mengembalikan nickname pemain saat ID dan Server valid
test('Skenario 49: Endpoint check-ml-account mengembalikan nickname pemain saat ID dan Server valid', async () => {
  const { _accountCache } = require('../src/services/gameAccountChecker');
  _accountCache.set('mlbb:104395251:2531', {
    data: { success: true, valid: true, nickname: 'idarr ur 444', user_id: '104395251', server_id: '2531', source: 'gopay' },
    expiresAt: Date.now() + 60000
  });

  const { req, res } = createMockReqRes({
    query: { user_id: '104395251', server_id: '2531' },
    method: 'GET'
  });

  await orderController.checkMLAccount(req, res);
  assert.equal(res.statusCode, 200, 'Harus merespons HTTP 200 untuk akun valid');
  assert.equal(res._json.success, true);
  assert.equal(res._json.valid, true);
  assert.equal(res._json.nickname, 'idarr ur 444');
  assert.equal(res._json.user_id, '104395251');
  assert.equal(res._json.server_id, '2531');
});

// SKENARIO 50: Endpoint check-ml-account menolak akun yang tidak terdaftar dengan status not_found
test('Skenario 50: Endpoint check-ml-account menolak akun yang tidak terdaftar dengan status not_found', async () => {
  const { _accountCache } = require('../src/services/gameAccountChecker');
  _accountCache.set('mlbb:88888888:9999', {
    data: { success: true, valid: false, status: 'not_found', message: 'Akun Mobile Legends dengan User ID dan Server tersebut tidak terdaftar / tidak ditemukan.' },
    expiresAt: Date.now() + 60000
  });

  const { req, res } = createMockReqRes({
    query: { user_id: '88888888', server_id: '9999' },
    method: 'GET'
  });

  await orderController.checkMLAccount(req, res);
  assert.equal(res.statusCode, 404, 'Harus merespons HTTP 404 untuk akun tidak terdaftar');
  assert.equal(res._json.success, false);
  assert.equal(res._json.valid, false);
  assert.equal(res._json.status, 'not_found');
  assert.ok(res._json.message.includes('tidak terdaftar'));
});

// SKENARIO 51: Pembuatan pesanan MLBB otomatis memblokir akun yang tidak terdaftar
test('Skenario 51: createOrder menolak pesanan jika akun Mobile Legends tidak terdaftar', async () => {
  const { _accountCache } = require('../src/services/gameAccountChecker');
  _accountCache.set('mlbb:77777777:8888', {
    data: { success: true, valid: false, status: 'not_found', message: 'Akun Mobile Legends dengan User ID dan Server tersebut tidak terdaftar / tidak ditemukan.' },
    expiresAt: Date.now() + 60000
  });

  const { req, res } = createMockReqRes({
    body: {
      product_id: 'test_item_1',
      game: 'mlbb',
      game_user_id: '77777777',
      server_id: '8888',
      wa_email_guest: 'customer@test.com',
      payment_method: 'Bank BRI (BRIVA)',
      force_ml_check: true
    },
    method: 'POST'
  });

  await orderController.createOrder(req, res);
  assert.equal(res.statusCode, 400, 'Harus ditolak HTTP 400 karena ID ML tidak valid/terdaftar');
  assert.equal(res._json.success, false);
  assert.ok(res._json.message.includes('tidak terdaftar'));
});





