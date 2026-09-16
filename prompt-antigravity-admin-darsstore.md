# PROMPT LANJUTAN UNTUK ANTIGRAVITY — Panel Admin "Dar'sstore"

## KONTEKS

Prompt sebelumnya (warna, penyederhanaan konten, backend, database Prisma +
PostgreSQL) sudah dijalankan. Sekarang tambahkan **Panel Admin** terpisah dari
halaman toko (storefront) yang sudah ada, supaya pemilik toko bisa mengelola
produk, transaksi, user, dan pengaturan lain tanpa masuk langsung ke database.

> **Catatan soal UI**: Panel admin ini adalah halaman/area BARU yang belum
> ada sebelumnya, jadi boleh dibuat desainnya dari nol (bukan seperti prompt
> sebelumnya yang melarang ubah layout storefront). Tetap pakai skema warna
> biru `#006199` yang sudah diterapkan supaya konsisten dengan brand
> Dar'sstore, tapi layout-nya boleh simpel & fungsional khas dashboard admin
> (sidebar + tabel), tidak perlu semewah halaman storefront.

---

## 1. Struktur & Akses Admin

### Role & Autentikasi

- Tambahkan field `role` di tabel `User` (enum: `user`, `admin`), default
  `user`. Update `schema.prisma`:
  ```prisma
  enum UserRole {
    user
    admin
  }

  model User {
    // ...field yang sudah ada
    role UserRole @default(user)
  }
  ```
- Login admin **memakai sistem login yang sama** dengan user biasa (tabel
  `users`), tapi setelah login, cek `role === 'admin'` sebelum mengizinkan
  masuk ke halaman/route admin
- Buat middleware backend `isAdmin.middleware.js` yang menolak akses
  (`403 Forbidden`) kalau token valid tapi role bukan `admin`
- Route panel admin terpisah, misal `/admin` (halaman login khusus admin) dan
  `/admin/dashboard`, dst — **jangan campur dengan route storefront**
- Cara menjadikan seseorang admin pertama kali: lewat seed script Prisma
  (`prisma/seed.ts`) atau update manual langsung di database Supabase,
  bukan lewat UI publik (supaya tidak ada celah orang random daftar jadi
  admin sendiri)

### Struktur menu (sidebar) — pola umum admin toko top up

```
📊 Dashboard          → ringkasan (lihat bagian 2)
📦 Kelola Produk      → CRUD nominal ML & Valorant (bagian 3)
🧾 Kelola Transaksi   → daftar & aksi order (bagian 4)
👥 Kelola User        → daftar user, poin, blokir (bagian 5)
💳 Pengaturan Payment → konfigurasi Tripay/Midtrans (bagian 6)
🔌 Provider Top Up    → status & saldo Digiflazz (bagian 7)
📈 Laporan            → grafik pendapatan (bagian 8)
📜 Log Aktivitas      → audit trail aksi admin (bagian 9)
⚙️ Pengaturan Umum    → kontak WA/email, dll (bagian 10)
```

---

## 2. Dashboard (halaman utama admin)

Tampilkan ringkasan berupa kartu statistik + grafik sederhana:

- Total pendapatan hari ini / minggu ini / bulan ini
- Jumlah transaksi per status (pending, processing, success, failed) —
  hitung dari tabel `orders` dengan `prisma.order.groupBy({ by: ['status'] })`
- Grafik pendapatan 7/30 hari terakhir (bar/line chart sederhana)
- Produk terlaris (agregasi `productId` yang paling sering muncul di `orders`
  berstatus `success`)
- Daftar transaksi terbaru (5–10 baris terakhir) dengan link ke detail

---

## 3. Kelola Produk (CRUD Nominal ML & Valorant)

Halaman tabel dengan kolom: Game, Nama Item, Nominal, Harga, Status
(Aktif/Nonaktif), Aksi (Edit/Hapus).

- Tombol **"Tambah Produk Baru"** → form: pilih game (ML/Valorant), nama
  item, nominal, harga, toggle aktif
- **Edit harga** langsung dari sini — ini yang paling sering dipakai admin
  toko top up sehari-hari (harga provider suka berubah)
- **Toggle aktif/nonaktif** tanpa perlu hapus data (misal nominal tertentu
  lagi kosong stok dari provider)
- Endpoint: `GET/POST/PUT/DELETE /api/admin/products`
- Perubahan di sini otomatis muncul di storefront karena storefront sudah
  mengambil data produk dari API (`GET /api/products`), bukan dari `data.js`
  lagi (sesuai prompt database sebelumnya)

---

## 4. Kelola Transaksi (Order Management)

Tabel semua order dengan **filter**: status, game, rentang tanggal, dan
**search** by nomor invoice / kontak WA.

Kolom: Invoice, Tanggal, Game, Item, Akun Target (User ID/Riot ID), Kontak,
Total, Status, Aksi.

### Aksi yang harus tersedia per baris

- **Lihat Detail** — buka detail lengkap order (termasuk `payment_logs`
  terkait untuk troubleshooting)
- **Proses Manual / Tandai Selesai** — untuk kasus order stuck di
  `processing` karena API provider gagal tapi barang sebenarnya sudah masuk
  manual dari CS. Endpoint: `POST /api/admin/orders/:id/complete`
- **Retry Top Up** — trigger ulang pemanggilan ke API provider (Digiflazz)
  untuk order yang `failed`. Endpoint: `POST /api/admin/orders/:id/retry`
- **Refund/Batalkan** — ubah status jadi `failed`/`refunded` (tambahkan enum
  value `refunded` di `OrderStatus` kalau mau ada state ini secara eksplisit)
- Setiap aksi manual admin di atas **wajib dicatat ke Log Aktivitas** (bagian
  9) — siapa yang melakukan, kapan, order mana, aksi apa

---

## 5. Kelola User

Tabel daftar user terdaftar: Nama, Email, WhatsApp, Poin, Total Transaksi,
Tanggal Daftar, Status (Aktif/Diblokir), Aksi.

- **Lihat riwayat transaksi per user** (klik nama → lihat semua order milik
  user tsb)
- **Adjust poin manual** — kadang perlu tambah/kurang poin manual (misal
  kompensasi komplain). Endpoint: `POST /api/admin/users/:id/points/adjust`
  dengan body `{ amount, reason }`, tercatat juga di `point_history`
- **Blokir/aktifkan user** — tambahkan field `isBlocked Boolean @default(false)`
  di model `User`; user yang diblokir tidak bisa login (dicek di endpoint
  login backend)
- Tidak perlu fitur hapus user permanen (riwayat transaksi harus tetap ada
  untuk pembukuan)

---

## 6. Pengaturan Payment Gateway

Form untuk mengatur kredensial payment gateway (Tripay/Midtrans) **tanpa
perlu edit file `.env` manual tiap kali ganti kunci**:

- API Key, Private Key, Merchant Code (field-nya menyesuaikan gateway yang
  dipilih)
- Mode: Sandbox / Production (toggle)
- **PENTING — Keamanan**: kredensial ini sensitif. Simpan di tabel terpisah
  `payment_settings` dengan nilai **terenkripsi** (jangan plain text di
  database), atau alternatif lebih aman: tetap simpan di `.env` server dan
  halaman ini hanya untuk *melihat status koneksi* (test koneksi ke gateway),
  bukan untuk mengubah kredensial langsung dari UI. Pilih pendekatan kedua
  kalau ingin lebih aman & lebih sederhana untuk tahap awal.

---

## 7. Provider Top Up (Digiflazz)

- Tampilkan **saldo Digiflazz saat ini** (fetch dari API cek saldo provider)
  supaya admin tahu kapan harus top up saldo provider sebelum kehabisan dan
  transaksi customer gagal
- Tampilkan status koneksi (online/error) ke API provider
- Endpoint: `GET /api/admin/provider/balance`

---

## 8. Laporan (Reports)

- Grafik pendapatan harian/mingguan/bulanan (line/bar chart)
- Breakdown pendapatan per game (ML vs Valorant)
- Export data transaksi ke **CSV/Excel** untuk kebutuhan pembukuan
  (`GET /api/admin/reports/export?from=...&to=...`)

---

## 9. Log Aktivitas (Audit Trail)

Tabel baru untuk mencatat semua aksi sensitif yang dilakukan admin:

```prisma
model AdminLog {
  id         Int      @id @default(autoincrement())
  adminId    Int      @map("admin_id")
  action     String              // contoh: "complete_order", "adjust_points", "edit_product"
  targetType String   @map("target_type")   // "order" | "user" | "product"
  targetId   Int      @map("target_id")
  detail     Json?               // detail perubahan (before/after value)
  createdAt  DateTime @default(now()) @map("created_at")

  admin      User     @relation(fields: [adminId], references: [id])

  @@map("admin_logs")
}
```

Setiap kali admin melakukan aksi di bagian 4 (proses manual/retry/refund)
atau bagian 5 (adjust poin/blokir user) atau bagian 3 (edit harga produk),
insert satu baris ke tabel ini. Ini penting untuk akuntabilitas — kalau ada
komplain "kenapa transaksi saya ditandai selesai padahal belum masuk",
riwayatnya bisa ditelusuri.

---

## 10. Pengaturan Umum

Halaman sederhana untuk mengubah data yang sering berubah tanpa perlu edit
kode:
- Nomor WhatsApp CS
- Alamat email kontak
- Nama toko/tagline (kalau suatu saat berubah)

Simpan di tabel `store_settings` (key-value sederhana), dibaca oleh backend
untuk endpoint `GET /api/settings/contact` yang dipakai storefront (footer,
halaman Hubungi Kami) supaya nomor WA & email tidak lagi hardcode di
`main.js`.

---

## 11. Keamanan Panel Admin

- Semua route `/api/admin/*` wajib lewat middleware `isAdmin` (cek JWT +
  role)
- Tambahkan **rate limiting lebih ketat** di endpoint login admin (misal
  maks 5 percobaan per 15 menit) untuk cegah brute force
- Pertimbangkan **2FA sederhana** (kode OTP by email) untuk login admin,
  karena akun ini punya akses penuh ke data keuangan & user
- Jangan expose endpoint admin di dokumentasi publik/Swagger tanpa proteksi

---

## Hasil Akhir yang Diharapkan

Panel admin terpisah di route `/admin` dengan sidebar berisi menu Dashboard,
Kelola Produk, Kelola Transaksi, Kelola User, Pengaturan Payment, Provider
Top Up, Laporan, Log Aktivitas, dan Pengaturan Umum — memakai skema warna
biru `#006199` yang konsisten dengan storefront, terhubung penuh ke database
PostgreSQL yang sama, dengan setiap aksi sensitif tercatat di log aktivitas
untuk akuntabilitas.
