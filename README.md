# OURASTORE — Top Up Games Cepat, Murah & Terpercaya

Website platform top up game modern dan responsif yang diimplementasikan **persis 1:1** berdasarkan 5 mockup desain SVG dari Figma:
1. **Beranda / Homepage** (`homepage.svg`)
2. **Top Up Mobile Legends** (`ml top up.svg`)
3. **Top Up Valorant** (`valo top up.svg`)
4. **Cek Transaksi / Invoice Tracker** (`cek transaksi.svg`)
5. **Leaderboard Top 10 Pembelian** (`leaderboard.svg`)

---

## 🎮 Fitur Utama

- **Desain & Aset 100% Asli**:
  - Palet warna dark gaming: `#262727`, `#212121`, aksen emas `#A58C6F`, dan badge hijau `#285346`.
  - Menggunakan aset logo resmi OURASTORE, banner Starlight Hanzo, MLBB, Valorant, 12 poster game, ikon produk, serta logo pembayaran lengkap hasil ekstraksi resolusi tinggi.
- **Navigasi Mulus (Single Page App / Router)**:
  - Berpindah antar halaman (*Topup, Cek Transaksi, Leaderboard, Kalkulator*) tanpa reload halaman.
- **Alur Pemesanan & Kasir Interaktif**:
  - Form input akun game (User ID & Server untuk ML, Riot ID dengan Tagline untuk Valorant).
  - Pilihan nominal produk lengkap (Special Item, Weekly Pass, First Top Up Double Diamonds, Diamond Pack, VP Region Indonesia/Malaysia/Thailand/Singapore/Filipina).
  - Penghitung jumlah pembelian [-] [qty] [+] dengan pembaruan harga otomatis.
  - Accordion metode pembayaran lengkap: *Oura Coin, QRIS (All E-Wallet), Virtual Account Bank (BCA, Mandiri, BRI, BNI, dll.), Convenience Store (Alfamart, Indomaret, Lawson)*.
  - Sticky summary panel dengan rating 4.99 ★★★★★ dan rincian total tagihan realtime.
  - Tombol **Pesan Sekarang** menerbitkan invoice resmi lengkap dengan **Kode QR QRIS** dan status pesanan.
- **Pelacak Invoice (Cek Transaksi)**:
  - Cari status invoice pesanan kapan saja dengan tombol salin dari clipboard.
  - Tabel transaksi real-time dengan status pesanan.
- **Leaderboard 3 Periode**:
  - Peringkat 10 besar pembelian (*Hari Ini, Minggu Ini, Bulan Ini*) dengan medali emas/perak/perunggu dan nama tersensor.
- **Kalkulator Win Rate MLBB**:
  - Menghitung jumlah kemenangan beruntun (win streak) tanpa kalah untuk mencapai target win rate.
- **Fitur Tambahan**:
  - Modal autentikasi Masuk & Daftar.
  - Modal bantuan Customer Service (Live Chat 24 jam).
  - Toggle Dark Mode / Light Mode di footer dengan penyimpanan preferensi di localStorage.

---

## 🛠️ Teknologi yang Digunakan

- **HTML5**: Semantik modern dan struktur modular view.
- **Vanilla CSS3**: Design system berbasis custom properties, layout flexbox & grid responsif, glassmorphism, dan micro-animations.
- **Vanilla JavaScript (ES6 Modules)**: State management reaktif, router view, kalkulasi harga dinamis, dan integrasi modal.
- **Vite**: Bundler dan development server berkecepatan tinggi.

---

## 🚀 Panduan Memulai (Instalasi & Menjalankan)

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18+)
- [Git](https://git-scm.com/)

### Langkah Menjalankan
```bash
# 1. Clone repository
git clone https://github.com/Shoutoo/darstore.git
cd darstore

# 2. Install dependensi
npm install

# 3. Jalankan server lokal
npm run dev
```

Buka browser Anda di `http://localhost:5173/`

### Build untuk Produksi
```bash
npm run build
```
Hasil build siap hosting akan berada di folder `dist/`.

---

## 📦 Struktur Folder

```
darstore/
├── public/
│   └── assets/
│       ├── banners/       # Banner promosi (Starlight, ML, Valorant)
│       ├── games/         # 12 poster game katalog
│       ├── icons/         # Ikon diamond, pass, dan badges
│       ├── logo/          # Logo OURASTORE header & footer
│       ├── news/          # Thumbnail artikel berita
│       ├── payments/      # Logo QRIS, Bank VA, & Minimarket
│       └── social/        # Ikon sosial media resmi
├── src/
│   ├── data.js            # Dataset produk, nominal, payments, FAQ, & news
│   ├── main.js            # Router, kalkulasi pesanan, modal, & interaktivitas
│   └── style.css          # Design system CSS & styling responsif
├── index.html             # Dokumen utama aplikasi
├── package.json           # Konfigurasi project & dependensi Vite
├── vite.config.js         # Konfigurasi dev server Vite
└── README.md              # Dokumentasi proyek
```

---

## 🔄 Panduan Backup & Revert

Repository ini sudah memiliki tag snapshot awal **`v1.0.0`**. Jika Anda ingin membatalkan perubahan atau kembali ke versi awal:

```bash
# Membatalkan perubahan pada 1 file:
git restore <nama_file>

# Mengembalikan seluruh proyek ke versi awal:
git reset --hard v1.0.0
```

---

## 📄 Lisensi & Hak Cipta
© 2026 OURASTORE. All rights reserved.
