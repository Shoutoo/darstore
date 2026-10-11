# Panduan Integrasi Midtrans (Mode SANDBOX)

> Dokumen ini adalah instruksi untuk AI agent (Antigravity) agar menyempurnakan integrasi Midtrans pada project ini **hanya dalam mode Sandbox**. Belum ada akun production, jadi jangan pernah memakai key atau URL production.

## 1. Konteks

- Project sudah memiliki integrasi Midtrans dasar dan perlu disempurnakan.
- Tujuan saat ini: alur pembayaran bisa diuji end-to-end memakai **Midtrans Sandbox** (tanpa uang asli).
- Stack default pada contoh: **Node.js + Express** dan **Midtrans Snap**. Jika stack project berbeda, sesuaikan contoh dengan stack yang ada di codebase, jangan menimpa struktur project.

## 2. Aturan Wajib (Guardrails)

1. Selalu pakai mode sandbox: `isProduction: false`.
2. Server Key **tidak boleh** muncul di frontend, di repo, atau di log. Hanya Client Key yang boleh dikirim ke frontend.
3. Semua key dibaca dari environment variable (`.env`), dan `.env` harus masuk `.gitignore`.
4. Harga/jumlah pembayaran **dihitung di backend**, jangan percaya nominal dari frontend.
5. Status pembayaran final ditentukan oleh **webhook (notifikasi) Midtrans**, bukan oleh callback frontend.
6. Jangan mengubah file atau fitur lain yang tidak berhubungan dengan pembayaran.
7. Sebelum mengubah kode, periksa dulu kode Midtrans yang sudah ada, lalu perbaiki/lengkapi, bukan menulis ulang dari nol.

## 3. Environment Variable

Buat `.env` (dan `.env.example` tanpa nilai asli):

```env
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxx
APP_BASE_URL=http://localhost:3000
```

Key sandbox didapat dari `https://dashboard.sandbox.midtrans.com` lewat **Settings > Access Keys**. Key sandbox berawalan `SB-Mid-...`. Jika key tidak berawalan `SB-`, hentikan dan beri peringatan.

## 4. Dependensi

```bash
npm install midtrans-client dotenv
```

## 5. Konfigurasi Backend

```js
// config/midtrans.js
require('dotenv').config();
const midtransClient = require('midtrans-client');

if (process.env.MIDTRANS_IS_PRODUCTION === 'true') {
  throw new Error('Mode production diblokir. Project ini hanya untuk Sandbox.');
}

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

module.exports = snap;
```

## 6. Endpoint Membuat Transaksi

```js
// POST /api/payment/create
const snap = require('../config/midtrans');

router.post('/create', async (req, res) => {
  try {
    const { productId, customer } = req.body;

    // Ambil harga dari database/server, BUKAN dari req.body
    const product = await getProductById(productId);
    if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    const orderId = `ORDER-${Date.now()}`;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: product.price, // integer, tanpa desimal
      },
      item_details: [
        { id: product.id, price: product.price, quantity: 1, name: product.name },
      ],
      customer_details: {
        first_name: customer?.name,
        email: customer?.email,
        phone: customer?.phone,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    // TODO: simpan order dengan status "pending" ke database
    res.json({ token: transaction.token, redirect_url: transaction.redirect_url, orderId });
  } catch (err) {
    console.error('Midtrans create error:', err.message);
    res.status(500).json({ message: 'Gagal membuat transaksi' });
  }
});
```

## 7. Webhook / Notifikasi

Endpoint harus publik, menerima `POST`, dan **selalu membalas HTTP 200** setelah diproses.

```js
// POST /api/payment/notification
const crypto = require('crypto');

router.post('/notification', async (req, res) => {
  try {
    const n = req.body;

    // 1) Verifikasi signature: SHA512(order_id + status_code + gross_amount + ServerKey)
    const expected = crypto
      .createHash('sha512')
      .update(n.order_id + n.status_code + n.gross_amount + process.env.MIDTRANS_SERVER_KEY)
      .digest('hex');

    if (expected !== n.signature_key) {
      return res.status(403).json({ message: 'Signature tidak valid' });
    }

    // 2) Tentukan status
    const { transaction_status: status, fraud_status: fraud, order_id } = n;
    let finalStatus = 'pending';

    if (status === 'capture') {
      finalStatus = fraud === 'accept' ? 'paid' : 'challenge';
    } else if (status === 'settlement') {
      finalStatus = 'paid';
    } else if (['cancel', 'deny', 'expire'].includes(status)) {
      finalStatus = 'failed';
    } else if (status === 'pending') {
      finalStatus = 'pending';
    }

    // 3) TODO: update order di database berdasarkan order_id (buat idempotent)
    // await updateOrderStatus(order_id, finalStatus);

    res.status(200).json({ message: 'OK' });
  } catch (err) {
    console.error('Midtrans notification error:', err.message);
    res.status(500).json({ message: 'Error' });
  }
});
```

Catatan: pastikan pemrosesan **idempotent** (notifikasi yang sama bisa dikirim lebih dari sekali).

## 8. Frontend (Snap)

```html
<!-- Pakai domain SANDBOX -->
<script
  src="https://app.sandbox.midtrans.com/snap/snap.js"
  data-client-key="ISI_CLIENT_KEY_SANDBOX"></script>

<button id="pay-button">Bayar</button>

<script>
  document.getElementById('pay-button').addEventListener('click', async () => {
    const res = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1 }),
    });
    const data = await res.json();

    window.snap.pay(data.token, {
      onSuccess: (r) => { /* tampilkan halaman sukses; status final tetap dari webhook */ },
      onPending: (r) => { /* menunggu pembayaran */ },
      onError: (r) => { /* tampilkan pesan error */ },
      onClose: () => { /* user menutup popup */ },
    });
  });
</script>
```

## 9. Setting di Dashboard Sandbox

- **Settings > Configuration > Payment Notification URL**: isi `https://<url-publik>/api/payment/notification`
- Saat development lokal, buat URL publik dengan **ngrok** atau **Cloudflare Tunnel**, lalu tempel URL tersebut di pengaturan di atas.

## 10. Cara Menguji

| Metode | Cara uji |
|---|---|
| Kartu kredit | Nomor uji `4811 1111 1111 1114`, CVV bebas (mis. 123), expiry masa depan, OTP 3DS `112233` |
| Virtual Account / QRIS / E-wallet | Gunakan **Payment Simulator** di `https://simulator.sandbox.midtrans.com` |
| Webhook | Setelah simulasi sukses, cek log server dan status order berubah menjadi `paid` |

Nomor kartu uji dan perilaku simulator bisa berubah, cek halaman *Testing Payment* di dokumentasi resmi Midtrans untuk data terbaru.

## 11. Status Transaksi

| `transaction_status` | Arti | Tindakan |
|---|---|---|
| `pending` | Menunggu pembayaran | Order tetap pending |
| `settlement` | Pembayaran berhasil | Tandai order `paid` |
| `capture` | Kartu kredit tertangkap | Cek `fraud_status`, `accept` berarti `paid` |
| `deny` / `cancel` | Ditolak / dibatalkan | Tandai `failed` |
| `expire` | Kedaluwarsa | Tandai `failed`/`expired` |

## 12. Tugas untuk Agent

1. Audit kode Midtrans yang sudah ada dan daftar masalahnya (key di frontend, nominal dari client, tidak ada verifikasi signature, dll.).
2. Rapikan konfigurasi ke environment variable dan blokir mode production.
3. Lengkapi endpoint `create` dan `notification` sesuai panduan ini.
4. Hubungkan status order di database dengan hasil webhook.
5. Tambahkan penanganan error dan log yang tidak membocorkan Server Key.
6. Buat langkah uji singkat (README) cara menjalankan dan menguji di sandbox.

## 13. Checklist Sebelum Dianggap Selesai

- [ ] Key berawalan `SB-` dan hanya dibaca dari `.env`
- [ ] `.env` ada di `.gitignore`
- [ ] Server Key tidak muncul di frontend/log
- [ ] Nominal dihitung di backend
- [ ] Signature webhook diverifikasi
- [ ] Webhook membalas 200 dan idempotent
- [ ] Pembayaran kartu, VA, dan QRIS sudah dicoba di sandbox
- [ ] Order berubah status sesuai webhook

## 14. Nanti Saat Pindah ke Production (jangan dilakukan sekarang)

Setelah akun merchant disetujui: ganti ke key production, set `MIDTRANS_IS_PRODUCTION=true`, ganti script Snap ke `https://app.midtrans.com/snap/snap.js`, dan atur ulang Payment Notification URL di dashboard production.
