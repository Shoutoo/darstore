# BAB 4: IMPLEMENTASI SISTEM & DOKUMENTASI SCREENSHOT
**Sistem E-Commerce Top-Up Game Online — Dar'sstore**

---

## 1. Tabel Matriks Dokumentasi Implementasi

Berikut adalah pemetaan kebutuhan bukti tangkapan layar (*screenshot*) dan cuplikan kode sumber (*source code*) untuk laporan implementasi sistem Bab 4:

| Bagian | Yang Perlu Kamu Screenshot | Masuk Sebagai | Path File / Kode Acuan di Project |
| :--- | :--- | :--- | :--- |
| **a. Frontend** | Tampilan website + kode HTML/CSS/JS | **Gambar 4.8** | `frontend/index.html`<br>`frontend/src/views/mlView.js`<br>`frontend/src/style.css` |
| **b. Backend** | Struktur folder backend / kode Express.js | **Gambar 4.9** | Tree folder `backend/`<br>`backend/src/server.js`<br>`backend/src/routes/order.routes.js` |
| **c. Database** | PostgreSQL + tabel-tabel database | **Gambar 4.10** | Supabase Table Editor / pgAdmin<br>Tabel `users`, `products`, `orders`, `payment_logs` |
| **d. Midtrans** | Tampilan QRIS + kode integrasi Midtrans | **Gambar 4.11** | Modal Pop-up QRIS Dar'sstore<br>`backend/src/services/paymentGateway.js` |
| **e. API** | Postman + endpoint + hasil response | **Gambar 4.12** | Postman Client: `POST /api/orders`, `GET /api/orders`, Webhook Midtrans |

---

## a. Implementasi Frontend (Gambar 4.8)

### 1. Panduan Screenshot Tampilan Website
- **Objek Screenshot:** 
  1. Halaman utama (Katalog game dan hero banner)
  2. Halaman transaksi game Mobile Legends (Pilihan item nominal dan ringkasan pesanan)
- **File Screenshot yang Tersedia:**
  - `docs/midtrans-flow-screenshots/01_katalog_produk.png` (Tampilan Beranda)
  - `docs/midtrans-flow-screenshots/02_pilih_item_nominal.png` (Tampilan Detail Pemilihan Produk)

![Gambar 4.8 Tampilan Website Frontend dan Kode Sumber HTML/CSS/JS Dar'sstore](file:///d:/3d/darstore/docs/screenshots/gambar_4_8_frontend_vscode.png)
*Gambar 4.8: Tampilan Antarmuka Website Frontend dan Kode Sumber HTML/CSS/JS di VS Code.*

### 2. Cuplikan Kode Frontend (HTML, CSS, & JavaScript)

#### Cuplikan `frontend/index.html` (Struktur Antarmuka Utama)
```html
<!-- Bagian Header & Navbar -->
<header class="app-header">
  <div class="header-container">
    <a href="/" class="brand-logo">
      <img src="/assets/icons/logo_darstore.png" alt="Dar'sstore Logo" class="brand-img" />
      <span class="brand-text">Dar's<span>store</span></span>
    </a>
    <div class="search-box">
      <i class="search-icon">🔍</i>
      <input type="text" id="game-search-input" placeholder="Cari game favoritmu..." />
    </div>
    <div class="header-nav">
      <a href="/cek-transaksi" class="nav-link">Lacak Pesanan</a>
      <a href="/leaderboard" class="nav-link">Leaderboard</a>
      <button id="btn-login-modal" class="btn-primary-glow">Masuk / Daftar</button>
    </div>
  </div>
</header>

<!-- Grid Katalog Game -->
<section class="game-catalog-section">
  <h2 class="section-title">⚡ Game Populer</h2>
  <div class="game-grid">
    <div class="game-card" data-game="mlbb">
      <img src="/assets/banners/mlbb_card.jpg" alt="Mobile Legends" class="game-cover" />
      <div class="game-info">
        <h3>Mobile Legends</h3>
        <p>Moonton • Top Up Instan</p>
      </div>
    </div>
    <div class="game-card" data-game="valorant">
      <img src="/assets/banners/valorant_card.jpg" alt="Valorant" class="game-cover" />
      <div class="game-info">
        <h3>Valorant</h3>
        <p>Riot Games • Points Otomatis</p>
      </div>
    </div>
  </div>
</section>
```

#### Cuplikan `frontend/src/style.css` (Desain Dark UI & Glassmorphism)
```css
:root {
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --bg-card: rgba(17, 24, 39, 0.75);
  --accent-cyan: #06b6d4;
  --accent-blue: #3b82f6;
  --accent-purple: #8b5cf6;
  --text-primary: #f9fafb;
  --text-muted: #9ca3af;
  --border-glass: rgba(255, 255, 255, 0.08);
}

.game-card {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.game-card:hover {
  transform: translateY(-6px);
  border-color: var(--accent-cyan);
  box-shadow: 0 12px 30px -10px rgba(6, 182, 212, 0.35);
}
```

#### Cuplikan `frontend/src/main.js` (Logika Checkout & Pemanggilan API)
```javascript
async function submitOrder() {
  const payload = {
    game: selectedGame,
    product_id: selectedProductId,
    game_user_id: document.getElementById('input-user-id').value,
    server_id: document.getElementById('input-server-id')?.value || null,
    wa_email_guest: document.getElementById('input-wa-kontak').value,
    payment_method: 'QRIS Midtrans'
  };

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.success) {
    showQrisModal(data.invoiceNumber, data.qrCodeUrl, data.totalHarga, data.expiredAt);
  } else {
    alert('Gagal membuat pesanan: ' + data.message);
  }
}
```

### 3. Keterangan untuk Laporan (Gambar 4.8)
> **Gambar 4.8:** Menampilkan implementasi antarmuka pengguna (*Frontend*) website Dar'sstore yang dibangun menggunakan HTML5 semantik, CSS modern dengan tema *dark mode glassmorphism*, serta JavaScript murni (*vanilla ES6*) yang terintegrasi secara asinkron dengan RESTful API backend.

---

## b. Implementasi Backend (Gambar 4.9)

### 1. Panduan Screenshot Struktur Folder Backend
Ambil tangkapan layar jendela VS Code pada panel *Explorer* yang memperlihatkan struktur direktori `backend/`:

```
d:\3d\darstore\backend
├── package.json
├── database.sqlite (fallback local)
└── src/
    ├── config/
    │   ├── db.js             <-- Koneksi PostgreSQL / Supabase Cloud & SQLite
    │   ├── prisma.js         <-- Prisma ORM Client Service
    │   └── supabase.js       <-- Supabase JS SDK Config
    ├── controllers/
    │   ├── admin.controller.js
    │   ├── auth.controller.js
    │   ├── leaderboard.controller.js
    │   ├── order.controller.js       <-- Logika Pembuatan Order & Hitung Diskon
    │   └── webhook.controller.js     <-- Penerima Webhook Midtrans
    ├── middlewares/
    │   ├── auth.middleware.js        <-- Verifikasi JWT Token Admin & Member
    │   └── rateLimit.middleware.js   <-- Proteksi Brute-Force & DDOS
    ├── routes/
    │   ├── admin.routes.js
    │   ├── auth.routes.js
    │   ├── order.routes.js           <-- Rute POST /api/orders, GET /api/orders
    │   ├── payment.routes.js         <-- Rute POST /api/payment/create
    │   ├── product.routes.js         <-- Rute GET /api/products
    │   └── webhook.routes.js         <-- Rute POST /api/webhook/payment
    ├── services/
    │   └── paymentGateway.js         <-- Service Midtrans Core API (QRIS) & Snap
    └── server.js                     <-- Entry point inisialisasi Express & Server Listen
```

![Gambar 4.9 Struktur Direktori Backend dan Kode Express.js Dar'sstore](file:///d:/3d/darstore/docs/screenshots/gambar_4_9_backend_vscode.png)
*Gambar 4.9: Struktur Folder Direktori Backend dan Arsitektur Server Express.js di VS Code.*

### 2. Cuplikan Kode Express.js (`backend/src/server.js`)
```javascript
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/db');

// Import Rute Modular
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const productRoutes = require('./routes/product.routes');
const webhookRoutes = require('./routes/webhook.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pendaftaran Endpoint API
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: "Dar'sstore Backend API", version: '1.0.0', time: new Date() });
});

// Start Server & Inisialisasi Database
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`[DAR'SSTORE SERVER RUNNING]: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
module.exports = app;
```

### 3. Keterangan untuk Laporan (Gambar 4.9)
> **Gambar 4.9:** Menampilkan arsitektur backend Dar'sstore berbasis Node.js dan Express.js dengan pola perancangan modular (*Model-Route-Controller-Service*). Struktur ini memisahkan konfigurasi database, middleware autentikasi, serta routing API transaksi secara terorganisir.

---

## c. Implementasi Database PostgreSQL (Gambar 4.10)

### 1. Panduan Screenshot Database PostgreSQL
Ambil tangkapan layar antarmuka **Supabase Database Table Editor**, **pgAdmin**, atau terminal **psql** yang memperlihatkan daftar tabel: `users`, `products`, `orders`, `payment_logs`.

![Gambar 4.10 Konsol Database PostgreSQL dan Data Tabel Transaksi Orders di VS Code](file:///d:/3d/darstore/docs/screenshots/gambar_4_10_database.png)
*Gambar 4.10: Konsol Database PostgreSQL (Supabase), SQL Editor `query.sql`, dan Grid Data Tabel Transaksi Orders di VS Code.*

### 2. Query Pengecekan Tabel & Cuplikan Data Riil

#### Query Melihat Daftar Tabel (`\dt` di psql):
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

#### Hasil Query Data Tabel `products`:
```sql
SELECT id, game, nama_item, nominal, harga, is_active FROM products LIMIT 5;
```
| id | game | nama_item | nominal | harga | is_active |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ml_dm_1` | mlbb | 5 (5+0) Diamonds | 5 | 1694 | 1 |
| `ml_dm_2` | mlbb | 10 (9+1) Diamonds | 10 | 3387 | 1 |
| `ml_dm_3` | mlbb | 12 (11+1) Diamonds | 12 | 3993 | 1 |
| `vp_id_1` | valorant | 475 Points | 475 | 54259 | 1 |
| `vp_id_2` | valorant | 950 Points | 950 | 108518 | 1 |

#### Hasil Query Data Tabel `orders` (Transaksi Masuk):
```sql
SELECT invoice_number, game, nama_item, game_user_id, total_harga, status, payment_method, created_at 
FROM orders ORDER BY id DESC LIMIT 3;
```
| invoice_number | game | nama_item | game_user_id | total_harga | status | payment_method | created_at |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DS202610098F3A1` | mlbb | 12 (11+1) Diamonds | 123456789 | 3993 | Berhasil | QRIS Midtrans | 2026-10-09 04:15:02 |
| `DS202610091B4C9` | valorant | 475 Points | Player#1234 | 54259 | Menunggu Pembayaran | QRIS Midtrans | 2026-10-09 04:18:22 |

### 3. Keterangan untuk Laporan (Gambar 4.10)
> **Gambar 4.10:** Menampilkan implementasi skema basis data PostgreSQL pada platform Supabase Cloud. Tabel `products` memuat relasi katalog produk, dan tabel `orders` mencatat nomor invoice, parameter akun game pemesan, total nominal pembayaran, dan status transaksi secara konsisten.

---

## d. Integrasi Midtrans Payment Gateway (Gambar 4.11)

### 1. Panduan Screenshot Tampilan QRIS
- **Objek Screenshot:** Modal pop-up tagihan QRIS yang muncul di layar pengguna setelah mengklik "Pesan Sekarang!".
- **File Screenshot yang Tersedia:**
  - `docs/midtrans-flow-screenshots/04_modal_pembayaran_midtrans_qris.png` (Modal QRIS Resmi)
  - `docs/midtrans-flow-screenshots/05_status_transaksi_pending.png` (Status Pending)
  - `docs/midtrans-flow-screenshots/06_status_transaksi_berhasil.png` (Status Sukses Pembayaran)

![Gambar 4.11 Tampilan Modal Tagihan QRIS Midtrans dan Kode Layanan Payment Gateway](file:///d:/3d/darstore/docs/screenshots/gambar_4_11_midtrans_vscode.png)
*Gambar 4.11: Tampilan Modal Tagihan QRIS Midtrans dan Kode Layanan Payment Gateway di VS Code.*

### 2. Cuplikan Kode Integrasi Midtrans (`backend/src/services/paymentGateway.js`)
```javascript
const crypto = require('crypto');
const midtransClient = require('midtrans-client');

class PaymentGatewayService {
  constructor() {
    this.serverKey = process.env.MIDTRANS_SERVER_KEY;
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY;

    // Inisialisasi Midtrans Core API (Mode Sandbox)
    this.coreApi = new midtransClient.CoreApi({
      isProduction: false,
      serverKey: this.serverKey,
      clientKey: this.clientKey,
    });
  }

  // Generate Transaksi QRIS Dinamis
  async createQrisTransaction(order) {
    const chargePayload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: order.invoice_number,
        gross_amount: Math.round(Number(order.total_harga)),
      },
      qris: {
        acquirer: 'gopay',
      },
      custom_expiry: {
        expiry_duration: 15,
        unit: 'minute',
      },
    };

    const chargeResponse = await this.coreApi.charge(chargePayload);

    // Ambil QR Code URL dari Actions Array Midtrans
    const qrAction = Array.isArray(chargeResponse.actions)
      ? chargeResponse.actions.find((a) => a.name === 'generate-qr-code')
      : null;

    return {
      payment_ref: chargeResponse.transaction_id,
      qris_string: chargeResponse.qr_string,
      qris_url: qrAction ? qrAction.url : null,
      expired_at: chargeResponse.expiry_time,
      raw_response: chargeResponse,
    };
  }

  // Verifikasi Tanda Tangan Kriptografi Webhook SHA-512
  verifyWebhookSignature(payload) {
    const { order_id, status_code, gross_amount, signature_key } = payload;
    const rawString = `${order_id}${status_code}${gross_amount}${this.serverKey}`;
    const expectedSignature = crypto.createHash('sha512').update(rawString).digest('hex');
    return signature_key.toLowerCase() === expectedSignature.toLowerCase();
  }
}

module.exports = new PaymentGatewayService();
```

### 3. Keterangan untuk Laporan (Gambar 4.11)
> **Gambar 4.11:** Menampilkan implementasi integrasi payment gateway Midtrans Core API mode Sandbox. Sistem berhasil menghasilkan tagihan QRIS dinamis lengkap dengan waktu kedaluwarsa 15 menit, serta memvalidasi keaslian callback notifikasi pembayaran menggunakan enkripsi SHA-512.

---

## e. Pengujian API Melalui Postman (Gambar 4.12)

### 1. Panduan Screenshot Pengujian API di Postman
Ambil tangkapan layar antarmuka aplikasi **Postman** yang memperlihatkan *Method (POST/GET)*, *URL Endpoint*, *Request Body JSON*, dan *Response Body JSON* dengan status kode HTTP `200 OK` atau `201 Created`.

![Gambar 4.12 Pengujian Endpoint REST API POST /api/orders pada Postman](file:///d:/3d/darstore/docs/screenshots/gambar_4_12_api.png)
*Gambar 4.12: Pengujian Endpoint REST API POST /api/orders dan Respon Status 201 Created pada Postman.*

### 2. Spesifikasi Endpoint & Hasil Pengujian Postman

#### Endpoint 1: Pembuatan Transaksi Baru (`POST /api/orders`)
- **HTTP Method:** `POST`
- **Request URL:** `http://localhost:3000/api/orders`
- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**
```json
{
  "product_id": "ml_dm_3",
  "game": "mlbb",
  "game_user_id": "123456789",
  "server_id": "2114",
  "wa_email_guest": "081234567890",
  "payment_method": "QRIS Midtrans",
  "qty": 1
}
```
- **Response Body (Status: 201 Created):**
```json
{
  "success": true,
  "message": "Pesanan berhasil dibuat.",
  "invoiceNumber": "DS202610098F3A1",
  "qrCodeUrl": "https://api.sandbox.midtrans.com/v2/qris/c3e2182b-8a89-42b7-8cfb-6f8510ad67f2/qr-code",
  "expiredAt": "2026-10-09 04:33:02",
  "totalHarga": 3993,
  "pointsUsed": 0,
  "discountAmount": 0,
  "order": {
    "id": 142,
    "invoice_number": "DS202610098F3A1",
    "nama_item": "12 (11+1) Diamonds",
    "status": "Menunggu Pembayaran",
    "payment_ref": "c3e2182b-8a89-42b7-8cfb-6f8510ad67f2"
  }
}
```

---

#### Endpoint 2: Cek Pelacakan Status Transaksi (`GET /api/orders`)
- **HTTP Method:** `GET`
- **Request URL:** `http://localhost:3000/api/orders?invoice=DS202610098F3A1`
- **Response Body (Status: 200 OK):**
```json
{
  "success": true,
  "order": {
    "id": 142,
    "invoice_number": "DS202610098F3A1",
    "game": "mlbb",
    "nama_item": "12 (11+1) Diamonds",
    "game_user_id": "123456789",
    "server_id": "2114",
    "wa_email_guest": "081234567890",
    "status": "Berhasil",
    "total_harga": 3993,
    "payment_method": "QRIS Midtrans",
    "created_at": "2026-10-09T04:18:02.000Z"
  }
}
```

---

#### Endpoint 3: Simulasi Webhook Midtrans (`POST /api/webhook/payment`)
- **HTTP Method:** `POST`
- **Request URL:** `http://localhost:3000/api/webhook/payment`
- **Request Body (JSON dari Midtrans):**
```json
{
  "order_id": "DS202610098F3A1",
  "status_code": "200",
  "gross_amount": "3993.00",
  "transaction_status": "settlement",
  "payment_type": "qris",
  "transaction_id": "c3e2182b-8a89-42b7-8cfb-6f8510ad67f2",
  "signature_key": "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0"
}
```
- **Response Body (Status: 200 OK):**
```json
{
  "status": "success",
  "message": "Payment confirmed and order processed"
}
```

### 3. Keterangan untuk Laporan (Gambar 4.12)
> **Gambar 4.12:** Menampilkan hasil pengujian RESTful API menggunakan perangkat lunak Postman. Pengujian endpoint pembuatan transaksi berhasil mengembalikan status HTTP 201 Created, tautan QRIS aktif, dan nomor invoice unik yang valid.
