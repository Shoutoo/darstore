const { dbAsync } = require('../config/db');
const { dbService } = require('../config/prisma');
const paymentGateway = require('../services/paymentGateway');
const { checkMLAccount } = require('../services/gameAccountChecker');

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
      qty = 1,
      points_to_use,
      use_points
    } = req.body;

    if (!product_id || !game || !wa_email_guest || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Data pesanan belum lengkap. Harap isi semua field yang diperlukan.'
      });
    }

    // Guard: QRIS Demo hanya merupakan pratinjau antarmuka dan dilarang untuk transaksi nyata
    const methodLower = String(payment_method || '').toLowerCase();
    const channelLower = String(req.body.payment_channel || '').toLowerCase();
    if (methodLower.includes('demo') || channelLower.includes('demo') || (methodLower.includes('qris') && !channelLower.includes('va'))) {
      return res.status(400).json({
        success: false,
        message: 'Metode pembayaran QRIS sedang dalam tahap aktivasi dan hanya tersedia sebagai demonstrasi antarmuka. Silakan gunakan Virtual Account untuk menyelesaikan transaksi.'
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

      // Verifikasi akun Mobile Legends agar tidak terjadi salah top up ke akun yang tidak ada
      if (process.env.NODE_ENV !== 'test' || req.body.force_ml_check) {
        const mlCheck = await checkMLAccount(uid, srv);
        if (mlCheck && mlCheck.valid === false) {
          return res.status(400).json({
            success: false,
            message: mlCheck.message || 'Akun Mobile Legends dengan User ID dan Server tersebut tidak terdaftar / tidak ditemukan.'
          });
        }
      }
    }

    let normalizedRiotId = riot_id || null;
    if (game === 'valorant') {
      const rid = String(riot_id || '').trim();
      if (!rid || !rid.includes('#')) {
        return res.status(400).json({
          success: false,
          message: 'Riot ID Valorant wajib menyertakan tagline dengan tanda # (Contoh: Player#1234 atau Player#IDN).'
        });
      }
      const parts = rid.split('#');
      if (parts.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Format Riot ID tidak valid. Pastikan hanya ada 1 tanda # (Contoh: Player#1234 atau Player#IDN).'
        });
      }
      const [namaPart, tagPart] = parts;
      if (!/^.{3,16}$/.test(namaPart.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Nama pada Riot ID harus 3-16 karakter. Contoh: Player#1234'
        });
      }
      if (!/^[a-zA-Z0-9]{3,5}$/.test(tagPart.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Tagline Riot ID harus berupa 3-5 karakter huruf/angka. Contoh: Player#1234 atau Player#IDN'
        });
      }
      normalizedRiotId = `${namaPart.trim()}#${tagPart.trim()}`;
    }

    // Look up product in database (strict ID first, then fallback to name)
    const trimmedProductId = String(product_id || '').trim();
    let product = await dbAsync.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [trimmedProductId]);
    if (!product) {
      product = await dbAsync.get(
        'SELECT * FROM products WHERE (nama_item = ? OR nama_item LIKE ?) AND is_active = 1 ORDER BY id ASC LIMIT 1',
        [trimmedProductId, `%${trimmedProductId}%`]
      );
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan atau sedang tidak aktif.'
      });
    }

    // Calculate total price based on product unit price + admin fee
    const quantity = game === 'valorant' ? 1 : Math.max(1, parseInt(qty, 10) || 1);
    const baseProductPrice = product.harga * quantity;

    // Biaya Admin:
    // Seluruh margin keuntungan (Rp 200 - Rp 2.500) sudah diintegrasikan ke dalam harga produk Digiflazz.
    // Metode pembayaran Virtual Account bebas biaya admin (Gratis Admin = 0).
    // Jika ada biaya admin eksplisit dari request body yang valid, gunakan nilai tersebut.
    let fee = 0;
    if (req.body.fee !== undefined && req.body.fee !== null) {
      const parsedFee = Number(req.body.fee);
      if (!isNaN(parsedFee) && parsedFee >= 0) {
        fee = parsedFee;
      }
    }

    let pointsUsed = 0;
    let discountAmount = 0;

    // Anti-Loss Loyalty Point Protection:
    // 1 Poin = Rp 100 potongan harga
    // Maksimal potongan: 20% dari harga produk murni (agar bisnis tidak pernah nombok modal pokok)
    const POINT_VALUE_RUPIAH = 100;
    const MAX_DISCOUNT_PERCENT = 0.20;
    const maxAllowedDiscountRupiah = Math.floor(baseProductPrice * MAX_DISCOUNT_PERCENT);
    const maxAllowedPoints = Math.floor(maxAllowedDiscountRupiah / POINT_VALUE_RUPIAH);

    const user_id = req.user ? req.user.id : null;
    const invoice_number = generateInvoiceNumber();
    const crypto = require('crypto');
    const accessToken = crypto.randomBytes(24).toString('hex');

    if (user_id && (use_points || points_to_use > 0)) {
      const userRow = await dbAsync.get('SELECT points FROM users WHERE id = ?', [user_id]);
      const userPoints = userRow ? (userRow.points || 0) : 0;

      let wantedPoints = parseInt(points_to_use, 10);
      if (isNaN(wantedPoints) || wantedPoints <= 0) {
        if (use_points) wantedPoints = userPoints;
        else wantedPoints = 0;
      }

      // Potongan maksimal 20% dari modal pokok dan tidak boleh melebihi saldo poin
      const intendedPoints = Math.max(0, Math.min(wantedPoints, userPoints, maxAllowedPoints));
      if (intendedPoints > 0) {
        // Atomic deduction: hanya potong jika saldo poin di database masih mencukupi
        const deductRes = await dbAsync.run(
          'UPDATE users SET points = points - ? WHERE id = ? AND points >= ?',
          [intendedPoints, user_id, intendedPoints]
        );
        if (deductRes.changes > 0) {
          pointsUsed = intendedPoints;
          discountAmount = pointsUsed * POINT_VALUE_RUPIAH;
          await dbAsync.run(
            `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
            [
              user_id,
              null,
              -pointsUsed,
              `Potongan diskon Rp ${discountAmount.toLocaleString('id-ID')} untuk invoice ${invoice_number}`
            ]
          );
        } else {
          console.warn(`[LOYALTY CONCURRENCY] Saldo poin user ${user_id} tidak mencukupi untuk pemotongan ${intendedPoints} poin.`);
        }
      }
    }

    const total_harga = Math.max(fee, (baseProductPrice + fee) - discountAmount);

    // Create temporary order object for payment gateway
    const tempOrder = {
      invoice_number,
      total_harga,
      product_id: product.id,
      nama_item: `${product.nama_item} (x${quantity})`,
      base_price: baseProductPrice,
      unit_price: product.harga,
      quantity,
      fee,
      discount_amount: discountAmount,
      points_used: pointsUsed,
      wa_email_guest,
      payment_method,
      payment_channel: req.body.payment_channel || null
    };

    // 1. Simpan order ke database dengan status awal Menunggu Pembayaran
    let createdOrder = null;
    try {
      createdOrder = await dbService.createOrder({
        invoice_number,
        user_id,
        product_id: product.id,
        game,
        nama_item: tempOrder.nama_item,
        game_user_id: game_user_id || null,
        server_id: server_id || null,
        riot_id: normalizedRiotId,
        wa_email_guest,
        status: 'Menunggu Pembayaran',
        payment_method,
        payment_ref: null,
        qris_string: null,
        qris_url: null,
        total_harga,
        points_used: pointsUsed,
        discount_amount: discountAmount,
        access_token: accessToken
      });

      if (pointsUsed > 0 && user_id) {
        await dbAsync.run(
          'UPDATE point_history SET order_id = ? WHERE user_id = ? AND description LIKE ? AND order_id IS NULL',
          [createdOrder.id, user_id, `%${invoice_number}%`]
        );
      }
    } catch (orderErr) {
      // Rollback points if order creation in DB failed
      if (pointsUsed > 0 && user_id) {
        await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [pointsUsed, user_id]);
      }
      throw orderErr;
    }

    // 2. Charge ke Midtrans Virtual Account (Bank Transfer)
    try {
      const vaData = await paymentGateway.createVaTransaction(tempOrder, {
        name: wa_email_guest,
        email: wa_email_guest && wa_email_guest.includes('@') ? wa_email_guest : 'customer@darstore.com'
      });

      // 3. Update data order dengan payment_ref, redirect_url Midtrans dan expired_at (24 jam)
      await dbAsync.run(
        `UPDATE orders SET payment_ref = ?, redirect_url = ?, expired_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [vaData.payment_ref, vaData.redirect_url || null, vaData.expired_at, createdOrder.id]
      );

      // 4. Catat payment log transaksi Midtrans
      try {
        await dbAsync.run(
          `INSERT INTO payment_logs (order_id, gateway_ref, status, raw_response) VALUES (?, ?, ?, ?)`,
          [
            createdOrder.id,
            vaData.payment_ref,
            'pending',
            JSON.stringify(vaData.raw_response || { initiated: true })
          ]
        );
      } catch (logErr) {
        console.warn('Payment log write error:', logErr.message);
      }

      const updatedOrder = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [createdOrder.id]);

      // 5. Kirim email tagihan & instruksi pembayaran Virtual Account secara otomatis
      try {
        const emailService = require('../services/emailService');
        const pendingMailRes = await emailService.sendPendingPaymentEmail(
          { ...(updatedOrder || createdOrder), access_token: accessToken },
          vaData
        );
        if (pendingMailRes && pendingMailRes.delivered) {
          await dbAsync.run('UPDATE orders SET pending_email_sent = 1 WHERE id = ?', [createdOrder.id]);
        }
      } catch (mailErr) {
        console.warn('[ORDER EMAIL] Peringatan pengiriman email tagihan:', mailErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran ke Virtual Account.',
        invoiceNumber: invoice_number,
        accessToken,
        paymentMethod: createdOrder.payment_method,
        paymentChannel: req.body.payment_channel || 'bni_va',
        bank: vaData.bank || 'BNI',
        vaNumber: vaData.va_number || null,
        billKey: vaData.bill_key || null,
        billerCode: vaData.biller_code || null,
        redirectUrl: vaData.redirect_url || null,
        snapToken: vaData.snap_token || null,
        expiredAt: vaData.expired_at,
        basePrice: baseProductPrice,
        unitPrice: product.harga,
        quantity,
        fee,
        totalHarga: total_harga,
        pointsUsed,
        discountAmount,
        payment_data: vaData,
        order: {
          ...updatedOrder,
          access_token: accessToken,
          va_number: vaData.va_number || null,
          bill_key: vaData.bill_key || null,
          biller_code: vaData.biller_code || null,
          bank: vaData.bank || 'BNI',
          redirectUrl: vaData.redirect_url || null,
          snapToken: vaData.snap_token || null,
          expiredAt: vaData.expired_at,
          base_price: baseProductPrice,
          unit_price: product.harga,
          quantity,
          fee,
          points_used: pointsUsed,
          discount_amount: discountAmount
        }
      });
    } catch (chargeErr) {
      console.error('Midtrans VA charge error:', chargeErr);
      // Jika charge Midtrans gagal, rollback poin & tandai status order jadi Gagal
      if (pointsUsed > 0 && user_id) {
        await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [pointsUsed, user_id]);
        await dbAsync.run(
          `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
          [
            user_id,
            createdOrder.id,
            pointsUsed,
            `[REFUND] Pengembalian ${pointsUsed} poin karena gagal generate tagihan Midtrans`
          ]
        );
      }

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
      message: 'Terjadi kesalahan saat memproses pesanan Anda.',
      detail: err.message
    });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { invoice } = req.query;
    if (!invoice) {
      return res.status(400).json({ success: false, message: 'Nomor invoice diperlukan.' });
    }

    let order = await dbService.getOrderByInvoice(invoice);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Nomor Invoice tidak ditemukan.' });
    }

    // Auto-Sync with Midtrans if status is still pending / Menunggu Pembayaran
    const isPending = order.status === 'Menunggu Pembayaran' || order.status === 'pending';
    if (isPending) {
      try {
        const midtransRes = await paymentGateway.checkTransactionStatus(order.invoice_number);
        if (midtransRes && (midtransRes.transaction_status === 'settlement' || (midtransRes.transaction_status === 'capture' && midtransRes.fraud_status === 'accept'))) {
          // Validasi nominal pembayaran cocok sebelum mengkonfirmasi status lunas
          const syncGross = Math.round(Number(midtransRes.gross_amount));
          const expectedGross = Math.round(Number(order.total_harga));

          if (!isNaN(syncGross) && syncGross === expectedGross) {
            console.log(`[AUTO-SYNC] Midtrans payment confirmed (${midtransRes.transaction_status}) for invoice ${order.invoice_number}`);
            
            const updateRes = await dbAsync.run(
              `UPDATE orders SET status = 'Diproses', payment_ref = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending')`,
              [midtransRes.transaction_id || order.payment_ref, order.id]
            );

            if (updateRes.changes > 0) {
              try {
                const orderQueue = require('../jobs/processOrderQueue');
                await orderQueue.enqueue({ ...order, status: 'Diproses', payment_ref: midtransRes.transaction_id || order.payment_ref });
              } catch (qErr) {
                console.warn('[AUTO-SYNC] Queue enqueue error:', qErr.message);
              }
            }

            const refreshedOrder = await dbService.getOrderByInvoice(invoice);
            if (refreshedOrder) {
              order = refreshedOrder;
            } else {
              order.status = 'Diproses';
              if (midtransRes.transaction_id) {
                order.payment_ref = midtransRes.transaction_id;
              }
            }
          } else {
            console.warn(`[AUTO-SYNC SECURITY ALERT] Nominal mismatch pada auto-sync untuk ${order.invoice_number}: Midtrans=${syncGross}, DB=${expectedGross}`);
          }
        } else if (midtransRes && ['expire', 'deny', 'cancel'].includes(midtransRes.transaction_status)) {
          console.log(`[AUTO-SYNC] Midtrans payment failed (${midtransRes.transaction_status}) for invoice ${order.invoice_number}`);
          const failRes = await dbAsync.run(
            `UPDATE orders SET status = 'Gagal', failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending')`,
            [`Midtrans: Pembayaran ${midtransRes.transaction_status}`, order.id]
          );

          if (failRes.changes > 0 && order.user_id && order.points_used > 0) {
            const refundClaim = await dbAsync.run(
              `UPDATE orders SET points_refunded = 1 WHERE id = ? AND (points_refunded = 0 OR points_refunded IS NULL)`,
              [order.id]
            );
            if (refundClaim.changes > 0) {
              await dbAsync.run('UPDATE users SET points = points + ? WHERE id = ?', [order.points_used, order.user_id]);
              await dbAsync.run(
                `INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)`,
                [
                  order.user_id,
                  order.id,
                  order.points_used,
                  `[REFUND] Pengembalian ${order.points_used} poin karena pesanan ${order.invoice_number} ${midtransRes.transaction_status}`
                ]
              );
            }
          }
          order.status = 'Gagal';
        }
      } catch (syncErr) {
        console.warn(`[AUTO-SYNC] Midtrans check notice for ${order.invoice_number}:`, syncErr.message);
      }
    }

    if (order && !order.redirect_url && order.qris_string && order.qris_string.startsWith('http')) {
      order.redirect_url = order.qris_string;
    }

    const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
    const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase().trim();
    const isProd = nodeEnv === 'production' || vercelEnv === 'production' || paymentGateway.isProduction;

    if (order) {
      order.simulator_url = isProd ? null : 'https://simulator.sandbox.midtrans.com/qris/index';

      const { evaluateOrderAuthorization, sanitizeOrderForPublic } = require('../utils/orderAuth');
      const authResult = evaluateOrderAuthorization(order, req);
      if (!authResult.authorized) {
        // Pelacakan publik tanpa otorisasi sah: lindungi data pribadi & informasi pembayaran
        order = sanitizeOrderForPublic(order, authResult.isLegacy);
      }
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

exports.checkMLAccount = async (req, res) => {
  try {
    const userId = req.query.user_id || req.query.userId || req.body?.user_id || req.body?.userId;
    const serverId = req.query.server_id || req.query.serverId || req.query.zone_id || req.query.zoneId || req.body?.server_id || req.body?.serverId || req.body?.zone_id;

    if (!userId || !serverId) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Parameter User ID dan Server ID Mobile Legends wajib diisi.'
      });
    }

    const result = await checkMLAccount(userId, serverId);

    if (result.valid === true) {
      return res.json({
        success: true,
        valid: true,
        nickname: result.nickname,
        user_id: result.user_id,
        server_id: result.server_id,
        source: result.source || 'verified'
      });
    }

    if (result.valid === false) {
      return res.status(404).json({
        success: false,
        valid: false,
        status: result.status || 'not_found',
        message: result.message || 'Akun Mobile Legends dengan User ID dan Server tersebut tidak terdaftar / tidak ditemukan.'
      });
    }

    return res.status(503).json({
      success: false,
      valid: null,
      status: result.status || 'service_unavailable',
      message: result.message || 'Layanan verifikasi nickname sedang sibuk. Mohon periksa User ID & Server Anda secara manual.'
    });
  } catch (err) {
    console.error('checkMLAccount error:', err);
    return res.status(500).json({
      success: false,
      valid: null,
      message: 'Terjadi kesalahan sistem saat mengecek akun Mobile Legends.'
    });
  }
};

