# 🎮 Pengembangan Website Top-Up Game Online dengan Integrasi Pembayaran QRIS melalui Midtrans pada Lingkungan Sandbox

Website platform top up game modern dan responsif untuk Mobile Legends: Bang Bang dan Valorant dengan integrasi resmi sistem pembayaran QRIS melalui **Midtrans (Lingkungan Sandbox)**, pemenuhan pesanan otomatis via H2H Digiflazz, basis data transaksi, serta Admin Dashboard.

---

## 🚀 Struktur Proyek

```
darstore/
├── frontend/                     # Aplikasi Frontend (Vite + Vanilla JS + CSS System)
│   ├── public/assets/            # Aset gambar terorganisir (banners, games, icons, logo, payments, social)
│   ├── src/
│   │   ├── api/                  # API client wrapper & endpoint connectors (auth, orders, products)
│   │   ├── components/           # Komponen UI modular (modals, paymentAccordion)
│   │   ├── data/                 # Data domain statis & katalog (games, nominals, payments, faqs)
│   │   ├── utils/                # Utility helpers (format currency, dates, token, state)
│   │   ├── views/                # Handler tampilan halaman (homepage, mlView, valoView, invoiceView)
│   │   ├── admin.css             # Desain sistem Admin Dashboard
│   │   ├── admin.js              # Logika & controller Admin Dashboard
│   │   ├── main.js               # Entry point utama storefront & router
│   │   └── style.css             # Desain sistem utama Storefront
│   ├── admin.html                # Halaman portal Admin Dashboard
│   ├── index.html                # Halaman utama storefront
│   ├── package.json              # Dependensi frontend Vite
│   └── vite.config.js            # Konfigurasi server Vite & proxy /api
├── backend/                      # Backend API (Express + Prisma + SQLite/PostgreSQL)
│   ├── prisma/                   # Schema database Prisma & seeder
│   ├── src/
│   │   ├── config/               # Koneksi database & runtime config
│   │   ├── controllers/          # Controller auth, order, product, webhook, admin
│   │   ├── middlewares/          # Autentikasi JWT & admin gate
│   │   ├── routes/               # Routing REST API
│   │   └── server.js             # Express server entry point
│   ├── database.sqlite           # Database lokal SQLite (otomatis dibuat)
│   ├── .env.example              # Template konfigurasi environment
│   └── package.json              # Dependensi backend Express
├── DESIGN_SYSTEM.md              # Dokumentasi lengkap Design System & CSS
├── package.json                  # Runner script workspace root
└── README.md                     # Dokumentasi panduan proyek
```

---

## 🛠️ Panduan Memulai (Instalasi & Menjalankan)

### 🐳 Menjalankan dengan Docker (Rekomendasi untuk Deployment & Portabilitas)

Proyek ini sudah dilengkapi `Dockerfile` multi-stage dan `docker-compose.yml`. Anda dapat menjalankannya di mana saja (VPS, cloud, local PC):

```bash
# 1. Jalankan langsung dengan Docker Compose (Port 3000)
docker compose up -d --build

# 2. Cek status container & log
docker compose ps
docker compose logs -f

# 3. Menghentikan container
docker compose down
```
*Aplikasi langsung dapat diakses di: `http://localhost:3000` (Storefront) dan `http://localhost:3000/admin` (Admin Dashboard).*

---

### 💻 Menjalankan Secara Manual (Development Lokal)

#### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18+)
- [Git](https://git-scm.com/)

#### 1. Menjalankan dari Root Proyek (Paling Praktis)
```bash
# Menjalankan backend server (Port 3000)
npm run server

# Menjalankan frontend dev server (Port 5173)
npm run dev
```

#### 2. Atau Menjalankan Secara Manual per Folder

#### Backend:
```bash
cd backend
npm install
npm run dev    # atau node src/server.js
```
*Backend berjalan di:* `http://localhost:3000` *(Health check: `/api/health`)*

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```
*Frontend berjalan di:* `http://localhost:5173`

---

## ⚙️ Environment Variables (`backend/.env`)

Salin `backend/.env.example` menjadi `backend/.env`:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=darstore_super_secret_jwt_key_2026

# Loyalty points ratio: Rp 10.000 = 1 Point
RUPIAH_PER_POINT=10000

# PostgreSQL (Supabase / Railway / Self-hosted)
DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Midtrans Payment Gateway (Mode Sandbox)
MIDTRANS_MERCHANT_ID=M738281649
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false

# Digiflazz H2H Top Up Provider API
DIGIFLAZZ_USERNAME=your_digiflazz_username
DIGIFLAZZ_KEY=your_digiflazz_api_key
DIGIFLAZZ_MODE=development
```

---

## 🧪 Uji Coba Simulasi Pembayaran (Midtrans Sandbox Simulator)

Pada mode **Sandbox**, pembayaran QRIS tidak menggunakan uang asli. Sistem telah terintegrasi dengan **Midtrans Payment Simulator**:

1. Lakukan pemesanan top-up di halaman game (Mobile Legends / Valorant).
2. Pada modal popup tagihan, klik tombol **"Buka Midtrans Payment Simulator"** atau akses langsung:
   👉 **[https://simulator.sandbox.midtrans.com/qris/index](https://simulator.sandbox.midtrans.com/qris/index)**
3. Klik tombol **"Salin URL Gambar QR"** di modal pembayaran Dar'sstore, lalu tempel (*paste*) URL tersebut ke kolom *QR Code Image Url* pada simulator Midtrans, kemudian klik **Scan QR** (atau gunakan tombol **"⚡ Simulasi Bayar Instan (Demo)"**).
4. Status pembayaran otomatis terverifikasi secara *real-time* dan pesanan langsung diproses.


---

## 📄 Hak Cipta & Lisensi
© 2026 Dar'sstore. All rights reserved.
