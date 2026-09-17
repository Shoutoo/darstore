# 🎮 Dar'sstore — Platform Top Up Games Cepat, Murah & Terpercaya

Website platform top up game modern dan responsif untuk Mobile Legends: Bang Bang dan Valorant, dilengkapi integrasi backend Express API, basis data transaksi, serta Admin Dashboard.

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

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18+)
- [Git](https://git-scm.com/)

### 1. Menjalankan dari Root Proyek (Paling Praktis)
```bash
# Menjalankan backend server (Port 3000)
npm run server

# Menjalankan frontend dev server (Port 5173)
npm run dev
```

### 2. Atau Menjalankan Secara Manual per Folder

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

# Opsional: PostgreSQL (Supabase / Railway). Jika kosong, otomatis fallback ke SQLite lokal
# DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?schema=public"

# Tripay Payment Gateway (QRIS)
TRIPAY_API_KEY=your_tripay_api_key
TRIPAY_PRIVATE_KEY=your_tripay_private_key
TRIPAY_MERCHANT_CODE=your_tripay_merchant_code

# Digiflazz Top Up Provider API
DIGIFLAZZ_USERNAME=your_digiflazz_username
DIGIFLAZZ_KEY=your_digiflazz_api_key
```

---

## 📄 Hak Cipta & Lisensi
© 2026 Dar'sstore. All rights reserved.
