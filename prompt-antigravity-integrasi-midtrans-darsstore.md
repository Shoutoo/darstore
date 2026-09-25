# PROMPT LANJUTAN UNTUK ANTIGRAVITY — Integrasi Midtrans (QRIS) ke Dar'sstore

## KONTEKS

Payment gateway yang dipakai sudah final: **Midtrans**, mode **Sandbox**
dulu untuk development (akun Production masih menunggu Business Review
selesai). Sesuai instruksi awal, metode pembayaran yang dipakai HANYA
**QRIS**. Integrasikan Midtrans ke backend (format Vercel Serverless
Functions sesuai prompt deploy sebelumnya), menggantikan QR dummy yang
sekarang masih dari `api.qrserver.com`.

---

## 1. Install SDK Midtrans

Di root project (folder yang berisi `/api`), install SDK resmi:

```bash
npm install midtrans-client
```

---

## 2. Environment Variables

Tambahkan di `.env` lokal DAN di dashboard Vercel (Environment Variables):

```
MIDTRANS_SERVER_KEY=SB-Mid-server-ji-E3p5XvwgclN3KR8HnAuQO
MIDTRANS_CLIENT_KEY=SB-Mid-client-BB-HmVEYrvOj1HLc
MIDTRANS_IS_PRODUCTION=false
```

Ambil `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` dari dashboard
Midtrans → Settings → Access Keys → **General Credentials** (bukan BI Snap
Credentials), pastikan Environment dashboard dalam mode **Sandbox** saat
mengambilnya. `MIDTRANS_IS_PRODUCTION` tetap `false` sampai Business Review
selesai dan API key diganti ke key Production — baru ganti jadi `true`.

---

## 3. Buat Helper Client Midtrans (`lib/midtrans.js`)

```js
import midtransClient from 'midtrans-client';

export const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});
```

> Dipakai `CoreApi`, bukan `Snap` — karena kita cuma butuh QRIS langsung
> tanpa halaman pembayaran Midtrans (Snap Page) yang menampilkan banyak
> pilihan metode. Dengan Core API, response charge langsung berisi data QR
> code yang bisa ditampilkan sendiri di halaman checkout kita.

---

## 4. Endpoint Buat Transaksi QRIS (`api/orders/index.js`)

Update endpoint `POST /api/orders` (dari prompt deploy sebelumnya) supaya
setelah order dibuat di database, langsung memanggil Midtrans untuk generate
QRIS:

```js
import { prisma } from '../../lib/prisma.js';
import { coreApi } from '../../lib/midtrans.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productId, gameUserId, serverId, riotId, contactWa, contactEmail, userId } = req.body;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) {
    return res.status(400).json({ error: 'Produk tidak ditemukan atau tidak aktif' });
  }

  const invoiceNumber = generateInvoiceNumber(); // "DS" + tanggal + random, sesuai pola lama

  // 1. Simpan order dulu dengan status pending
  const order = await prisma.order.create({
    data: {
      invoiceNumber,
      userId: userId ?? null,
      productId,
      gameUserId,
      serverId,
      riotId,
      contactWa,
      contactEmail,
      status: 'pending',
      paymentMethod: 'qris',
      totalHarga: product.harga,
    },
  });

  // 2. Charge ke Midtrans Core API dengan payment_type QRIS
  try {
    const chargeResponse = await coreApi.charge({
      payment_type: 'qris',
      transaction_details: {
        order_id: invoiceNumber, // pakai invoice number sebagai order_id Midtrans
        gross_amount: product.harga,
      },
      qris: {
        acquirer: 'gopay', // acquirer default, bisa disesuaikan
      },
      custom_expiry: {
        expiry_duration: 15,
        unit: 'minute',
      },
    });

    // 3. Ambil URL QR code dari response actions
    const qrAction = chargeResponse.actions.find((a) => a.name === 'generate-qr-code');
    const qrCodeUrl = qrAction ? qrAction.url : null;

    // 4. Simpan referensi transaksi Midtrans ke order
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: chargeResponse.transaction_id },
    });

    await prisma.paymentLog.create({
      data: {
        orderId: order.id,
        gatewayRef: chargeResponse.transaction_id,
        status: chargeResponse.transaction_status,
        rawResponse: chargeResponse,
      },
    });

    return res.status(200).json({
      invoiceNumber,
      qrCodeUrl,           // ini yang dipakai frontend untuk render QR asli
      expiredAt: chargeResponse.expiry_time,
      totalHarga: product.harga,
    });
  } catch (err) {
    // Kalau charge ke Midtrans gagal, tandai order failed supaya tidak menggantung
    await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } });
    return res.status(500).json({ error: 'Gagal membuat transaksi pembayaran', detail: err.message });
  }
}
```

---

## 5. Ganti QR Dummy di Frontend (`main.js`)

Cari bagian di `handleCheckout()` yang sekarang men-generate QR lewat
`api.qrserver.com` (encode teks invoice number). Ganti supaya:

1. Panggil `POST /api/orders` dengan data checkout
2. Ambil `qrCodeUrl` dari response
3. Tampilkan `qrCodeUrl` itu langsung sebagai `src` gambar QR di modal
   pembayaran (Midtrans sudah mengembalikan URL gambar QR asli, tidak perlu
   generate manual lagi)
4. Tampilkan hitung mundur berdasarkan `expiredAt` yang dikembalikan
   (menggantikan timer dummy kalau ada)

Struktur tampilan modal **tidak berubah**, cuma sumber gambar QR-nya yang
sekarang asli dari Midtrans, bukan hasil encode teks lokal.

---

## 6. Webhook Handler (`api/webhook/payment.js`)

Endpoint ini dipanggil Midtrans otomatis setiap ada perubahan status
pembayaran. **Wajib verifikasi signature** supaya tidak ada pihak lain yang
bisa memalsukan notifikasi pembayaran sukses:

```js
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { processTopUp } from '../../lib/topupProvider.js'; // dari integrasi Digiflazz

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = req.body;

  // 1. Verifikasi signature (WAJIB, jangan skip)
  const expectedSignature = crypto
    .createHash('sha512')
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');

  if (signature_key !== expectedSignature) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const order = await prisma.order.findUnique({ where: { invoiceNumber: order_id } });
  if (!order) {
    return res.status(404).json({ error: 'Order tidak ditemukan' });
  }

  // 2. Idempotency — kalau order sudah diproses sebelumnya (bukan pending),
  //    jangan proses ulang, cukup balas OK supaya Midtrans berhenti retry
  if (order.status !== 'pending') {
    return res.status(200).json({ message: 'Sudah diproses sebelumnya' });
  }

  // 3. Catat log mentah untuk audit
  await prisma.paymentLog.create({
    data: {
      orderId: order.id,
      gatewayRef: req.body.transaction_id,
      status: transaction_status,
      rawResponse: req.body,
    },
  });

  // 4. Mapping status Midtrans → status order kita
  if (transaction_status === 'settlement' || transaction_status === 'capture') {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'paid' } });

    // Proses top up langsung di sini (Opsi A dari prompt deploy — sinkron,
    // cocok untuk tahap awal karena tidak ada worker antrian di serverless)
    await processTopUp(order); // fungsi ini yang update status jadi success/failed
                                 // dan menambahkan poin kalau order.userId ada
  } else if (['expire', 'deny', 'cancel'].includes(transaction_status)) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } });
  }
  // status 'pending' dari Midtrans tidak perlu diubah, biarkan tetap pending

  res.status(200).json({ message: 'OK' });
}
```

---

## 7. Update URL Webhook di Dashboard Midtrans

Setelah deploy ke Vercel, masuk ke dashboard Midtrans → Settings → General
Settings (di mode Sandbox untuk testing, nanti ulangi juga di mode
Production setelah aktif) → isi **Payment Notification URL**:

```
https://darsstore.vercel.app/api/webhook/payment
```

Tanpa ini, Midtrans tidak tahu ke mana harus mengirim notifikasi setelah
pembayaran, dan status order tidak akan pernah otomatis ter-update.

---

## 8. Cara Uji Coba di Sandbox (Simulasi Pembayaran QRIS Berhasil)

Karena QRIS sandbox tidak bisa benar-benar di-scan lewat e-wallet asli,
Midtrans menyediakan cara simulasi:
1. Setelah charge QRIS berhasil dan dapat `transaction_id`, buka **Midtrans
   Simulator** (biasanya di `https://simulator.sandbox.midtrans.com/qris/index`)
2. Masukkan `transaction_id` dari response charge tadi untuk mensimulasikan
   pembayaran QRIS berhasil
3. Setelah itu, webhook otomatis terpanggil ke endpoint kita, dan status
   order harusnya berubah dari `pending` → `paid` → `success`

Gunakan cara ini untuk memastikan seluruh alur (charge → webhook → top up →
poin) berjalan benar sebelum nanti pindah ke Production sungguhan.

---

## Hasil Akhir yang Diharapkan

Checkout menghasilkan QR code QRIS asli dari Midtrans (bukan dummy lagi),
status order ter-update otomatis lewat webhook yang tervalidasi
signature-nya, dan proses top up ke Digiflazz terpicu otomatis begitu
pembayaran `settlement`/`capture` — semua bisa diuji penuh di Sandbox
sebelum nanti tinggal ganti API key ke Production setelah Business Review
Midtrans selesai.
