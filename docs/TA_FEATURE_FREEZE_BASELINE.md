# DOKUMEN BASELINE FEATURE FREEZE TUGAS AKHIR
## Proyek Website Top-Up Game Online Dar'sstore

**Tanggal Penetapan Baseline:** 23 Oktober 2026  
**Status Baseline:** **TA FEATURE FREEZE BASELINE (LOCKED FOR BAB IV)**  
**Rekomendasi Rilis:** **FREEZE WITH WARNINGS** (Seluruh kode & tes lokal 100% lulus; working tree menunggu persetujuan commit; transaksi riil dibatasi secara terencana)  
**Penyusun:** Senior Software Engineer, Release Manager, & Technical Documentation Engineer  

---

## DAFTAR ISI
1. [A. Identitas Proyek](#a-identitas-proyek)
2. [B. Ruang Lingkup Fitur Tugas Akhir](#b-ruang-lingkup-fitur-tugas-akhir)
3. [C. Arsitektur Sistem](#c-arsitektur-sistem)
4. [D. Konfigurasi Sistem Pembayaran](#d-konfigurasi-sistem-pembayaran)
5. [E. Ringkasan Keamanan Sistem](#e-ringkasan-keamanan-sistem)
6. [F. Status Pengujian Otomatis & Verifikasi Build](#f-status-pengujian-otomatis--verifikasi-build)
7. [G. Status Git & Status Repositori](#g-status-git--status-repositori)
8. [H. Status Deployment (Lokal vs Live)](#h-status-deployment-lokal-vs-live)
9. [I. Batasan Operasional & Status Produksi Aktual](#i-batasan-operasional--status-produksi-aktual)
10. [J. Kebijakan Feature Freeze (Feature Freeze Policy)](#j-kebijakan-feature-freeze-feature-freeze-policy)
11. [K. Kebutuhan Dokumentasi BAB IV Tugas Akhir](#k-kebutuhan-dokumentasi-bab-iv-tugas-akhir)

---

## A. IDENTITAS PROYEK

| Parameter | Keterangan |
| :--- | :--- |
| **Nama Aplikasi** | **Dar'sstore** (Storefront & Admin Management System) |
| **Domain Aplikasi** | Website Top-Up Game Online (Mobile Legends & Valorant) |
| **Teknologi Frontend** | HTML5, Vanilla CSS3, JavaScript (ES6+), Vite Bundler |
| **Teknologi Backend** | Node.js, Express.js (REST API Architecture) |
| **Database Produksi** | PostgreSQL (Supabase Cloud) dengan Prisma ORM & Connection Pool |
| **Database Pengujian** | SQLite (`backend/test-database.sqlite`) terisolasi lokal |
| **Payment Gateway** | Midtrans Production (Virtual Account Bank Transfer & Core API) |
| **Digital Provider** | Digiflazz H2H Top-Up API & Callback Webhook |
| **Platform Hosting** | Vercel Serverless Platform |
| **Branch Git Aktif** | `main` |
| **Commit Git Terakhir** | `31af8e5` (*feat: adaptive QR checkout modal for Native QRIS vs Midtrans Live Snap*) |
| **Rekomendasi Tag Git** | `ta-feature-freeze-2026-10-23` *(hanya rekomendasi, belum dieksekusi)* |

---

## B. RUANG LINGKUP FITUR TUGAS AKHIR

Seluruh fitur di bawah ini telah selesai diimplementasikan dan dinyatakan **Terkunci (Frozen)** untuk dokumentasi skripsi BAB IV:

### 1. Storefront & Guest Experience
1. **Pilihan Game:**
   - Mobile Legends: Bang Bang (Validasi format User ID 6-10 digit & Zone ID 3-5 digit angka).
   - Valorant (Validasi format Riot ID `Player#1234` dengan tagline angka 3-5 digit).
2. **Katalog Produk Dinamis:**
   - Daftar nominal diamond MLBB & Riot Points Valorant dimuat langsung dari database.
3. **Guest Checkout (Checkout Tanpa Login):**
   - Pelanggan dapat berbelanja langsung dengan mengisi kontak WhatsApp/Email.
   - Diterbitkan token akses unik 48-karakter heksadesimal (`access_token`) untuk mengisolasi kepemilikan transaksi tamu.
4. **Cek Transaksi & Pelacakan Invoice Publik:**
   - Pelanggan dapat mengecek status pesanan menggunakan nomor invoice (`DSXXXXXXXXXX`).
   - Perlindungan privasi: data kontak disamarkan (*masked*), token rahasia dan URL pembayaran dihilangkan dari tampilan publik.
5. **Leaderboard Real-Time & Peringkat Belanja:**
   - Menampilkan peringkat pembeli terbanyak berdasarkan agregasi nominal transaksi lunas.

### 2. Akun Pengguna, Loyalitas, & Gamifikasi
1. **Autentikasi Pengguna:** Registrasi dan login aman menggunakan JWT dan enkripsi `bcryptjs`.
2. **Poin Loyalitas (Cashback):**
   - Transaksi lunas memperoleh reward poin (1 poin tiap kelipatan transaksi Rp 10.000).
   - Poin dapat digunakan memotong harga pesanan berikutnya (1 poin = Rp 100).
   - *Anti-Loss Protection:* Pemotongan dibatasi maksimal 20% dari modal produk agar sistem tidak merugi.
   - *Concurrency Guard:* Penggunaan poin simultan dilindungi pengecekan atomik di database untuk mencegah saldo minus.
   - *Auto-Refund:* Jika transaksi kedaluwarsa atau gagal, poin otomatis dikembalikan secara idempoten.
3. **Katalog Penukaran Reward:**
   - Penukaran saldo poin dengan item digital / saldo reward.

### 3. Dashboard Manajemen Administrator
1. **Autentikasi Khusus:** Dilindungi middleware `requireAdmin` dengan validasi peran (*role-based access control*).
2. **Statistik Penjualan:** Omzet harian, mingguan, bulanan, dan grafik tren 7 hari terakhir.
3. **Manajemen Produk:** Tambah, edit harga/nominal, dan nonaktifkan produk.
4. **Manajemen Transaksi:** Pencarian, filter status, pelacakan payment log mentah, dan aksi manual (`completeOrder`, `retryOrder`, `cancelOrder`).
5. **Audit Trail Logging:** Setiap tindakan administrator otomatis dicatat ke tabel `admin_logs`.

---

## C. ARSITEKTUR SISTEM

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT TIER                                       |
|  - Modern Storefront (HTML5 / Vanilla CSS / ES6 Modules)                         |
|  - Admin Dashboard (admin.html, Charting, Management Panels)                      |
|  - Vite Build System (dist/ 39.37 kB HTML, 173.31 kB JS)                          |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS / REST API
                                          v
+-----------------------------------------------------------------------------------+
|                              BACKEND SERVICE TIER                                 |
|  - Express.js Engine (Port 5000 / Vercel Serverless Function)                     |
|  - Centralized Auth Guard: evaluateOrderAuthorization (Deny by Default)           |
|  - Price Authority: Database-driven calculations (Zero client nominal trust)      |
|  - Asynchronous Queue: processOrderQueue.js (Retry & Worker Concurrency Guard)    |
|  - Multi-Driver DB Layer: Prisma ORM (PostgreSQL Supabase) + SQLite Driver        |
+---------------------+-------------------+-------------------+---------------------+
                      |                   |                   |
                      v                   v                   v
+-----------------------------+ +-------------------+ +-----------------------------+
|      DATA STORAGE TIER      | |  PAYMENT GATEWAY  | |     DIGITAL TOPUP H2H       |
| PostgreSQL Supabase Cloud   | | Midtrans Prod     | | Digiflazz H2H Engine        |
| - 5 New Security Columns    | | - BNI VA          | | - Pre-order validation      |
| - Connection Pooling        | | - BRI VA          | | - Topup execution & SN      |
| - Atomic Constraints        | | - Mandiri Bill    | | - Auto callback webhook     |
| - Zero Orphan Records       | | - QRIS (Demo UI)  | | - Timeout safety            |
+-----------------------------+ +-------------------+ +-----------------------------+
```

---

## D. KONFIGURASI SISTEM PEMBAYARAN

### 1. Virtual Account (VA) Midtrans Production — Metode Nyata
- **Peran:** Satu-satunya metode pembayaran aktif yang menghasilkan tagihan finansial riil.
- **Channel Bank yang Dikonfigurasi:**
  - BNI Virtual Account (`bni_va` / prefix `8808...`)
  - BRI Virtual Account (`bri_va` / prefix `12800...`)
  - Mandiri Bill Payment (`echannel` / Biller Code `70012` + Bill Key)
  - CIMB Niaga VA (`cimb_va`)
  - Permata VA (`permata_va`)
- **Fitur Transaksi:**
  - Menghasilkan nomor VA langsung dari respons gateway backend (kebal manipulasi payload client).
  - Waktu kedaluwarsa 24 jam dengan hitung mundur dinamis (*live countdown*).
  - Panduan tata cara transfer ATM / Internet Banking / Mobile Banking.
  - Webhook settlement otomatis memproses pesanan ke antrean pemenuhan produk.

### 2. QRIS Demonstrasi — Pratinjau Antarmuka Non-Aktif
- **Peran:** Kebutuhan presentasi akademis, evaluasi UI responsif, dan dokumentasi visual Tugas Akhir (BAB IV).
- **Perilaku Sistem:**
  - Status pada accordion: **`Belum Aktif`** dengan badge merah dan chip label **`DEMO`**.
  - Interaksi klik **TIDAK memilih metode checkout**, melainkan memunculkan dialog `#qris-demo-modal`.
  - Dilengkapi watermark diagonal permanen: **`DEMO — TIDAK UNTUK PEMBAYARAN`**.
  - Peringatan tertulis: *"Fitur pembayaran QRIS sedang dalam tahap aktivasi. Kode QR yang ditampilkan merupakan demonstrasi dan tidak dapat digunakan untuk melakukan pembayaran. Silakan gunakan Virtual Account untuk menyelesaikan transaksi."*
  - Tombol pengalih cepat: `[👉 Gunakan Virtual Account (Tersedia)]`.
- **Isolasi Keamanan Backend:**
  - Endpoint `POST /api/orders` memiliki guard yang menolak setiap payload metode demo dengan `HTTP 400`.
  - Menjamin **0 panggilan API Midtrans**, **0 mutasi database**, **0 pemotongan saldo poin**, dan **0 antrean Digiflazz**.

---

## E. RINGKASAN KEAMANAN SISTEM

| No | Mekanisme Pertahanan | Deskripsi Implementasi | Bukti Verifikasi |
| :---: | :--- | :--- | :--- |
| 1 | **Server-Side Price Authority** | Nominal pesanan dihitung murni dari harga produk database ditambah biaya admin resmi. Nilai `amount`/`total_harga` dari client diabaikan total. | Skenario 2 & 33 (PASS) |
| 2 | **SHA-512 Signature Webhook** | Verifikasi hash `crypto.createHash('sha512').update(order_id + status_code + gross_amount + server_key)`. Webhook palsu ditolak HTTP 403. | Skenario 5 & 36 (PASS) |
| 3 | **Gross Amount Matching** | Webhook mencocokkan `receivedAmount === expectedAmount`. Selisih nominal ditolak HTTP 400 dan dicatat ke audit log. | Skenario 4 (PASS) |
| 4 | **Webhook Idempotency & Replay Guard** | Pengiriman webhook duplikat dicek terhadap status transaksi saat ini. Hanya 1 eksekusi top-up yang diizinkan. | Skenario 7 & 37 (PASS) |
| 5 | **Race Condition Shield** | Penanganan status pesanan konkuren menggunakan atomic update berbasis database state. | Skenario 8 (PASS) |
| 6 | **Guest Access Token Isolation** | Guest order dilindungi token acak 48-karakter heksadesimal. Akses tanpa token sah ditolak HTTP 403. | Skenario 21 & 22 (PASS) |
| 7 | **Legacy Deny by Default** | Pesanan lama tanpa token tidak dapat menerbitkan tagihan baru dan ditolak HTTP 403 dengan arahan ke CS. | Skenario 23 & 47 (PASS) |
| 8 | **Public Tracking Sanitization** | Endpoint publik menyembunyikan `access_token`, menghapus `redirect_url`/`payment_ref`, dan menyamarkan nomor kontak (`0812****890`). | Skenario 25 & 44 (PASS) |
| 9 | **Timing-Attack Proof Comparison** | Pembandingan token rahasia menggunakan `crypto.timingSafeEqual` dengan pengecekan panjang buffer. | `orderAuth.js` |
| 10 | **Anti-Loss Loyalty Protection** | Potongan poin dibatasi maksimal 20% modal pokok, pemotongan konkuren aman, dan refund otomatis idempoten. | Skenario 10, 11, 12, 20 (PASS) |
| 11 | **Provider Timeout Safeguard** | Timeout Digiflazz ditandai status `pending`, tidak melakukan auto-retry berbahaya. | Skenario 13 (PASS) |
| 12 | **Strict Production Sandbox Blocking** | Endpoint simulasi pembayaran diblokir secara permanen di production (`HTTP 404`). | Skenario 1 (PASS) |

---

## F. STATUS PENGUJIAN OTOMATIS & VERIFIKASI BUILD

### 1. Hasil Eksekusi Test Suite Backend
- **Perintah:** `npm --prefix backend test`
- **Runner:** Node.js Native Test Runner (`node --test tests/security.test.js`)
- **Lingkungan:** SQLite lokal terisolasi (`backend/test-database.sqlite`), mock Midtrans Core API, mock Digiflazz.
- **Metrik Hasil:**
  - **Total Skenario Pengujian:** **48 Skenario**
  - **Jumlah Lulus (Passed):** **48**
  - **Jumlah Gagal (Failed):** **0**
  - **Durasi Eksekusi:** **9.82 detik**

### 2. Rincian Distribusi 48 Skenario Uji
- **Skenario 1 – 12:** Keamanan webhook, manipulasi nominal, status race condition, refund poin, dan proteksi sandbox.
- **Skenario 13 – 20:** Timeout Digiflazz, fallback kontrol Snap, isolasi worker antrean, konkurensi pemotongan poin.
- **Skenario 21 – 25:** Validasi token tamu, isolasi antar invoice, migrasi idempoten, sanitasi pelacakan publik.
- **Skenario 26 – 32:** Validasi antarmuka QRIS Demo, label watermark SVG, nol pemanggilan API, tombol switch ke VA.
- **Skenario 33 – 40:** Pembuatan pesanan Virtual Account resmi, handling pending/settlement, integritas DB pesanan demo.
- **Skenario 41 – 48:** Otorisasi legacy order (Deny by Default), cross-user isolation, masking kontak, otorisasi admin.

### 3. Hasil Kompilasi Produksi Frontend
- **Perintah:** `npm --prefix frontend run build`
- **Bundler:** Vite v6.4.3
- **Durasi Build:** **663ms**
- **Status:** **100% SUKSES (0 Errors, 0 Warnings)**
- **Aset yang Dihasilkan:**
  - `dist/index.html`: 39.37 kB (gzip: 8.64 kB)
  - `dist/admin.html`: 72.50 kB (gzip: 13.61 kB)
  - `dist/assets/main-CKOmc6qU.css`: 65.49 kB (gzip: 12.11 kB)
  - `dist/assets/main-D2JLILuL.js`: 173.31 kB (gzip: 36.08 kB)
  - `dist/assets/admin-DwFdmmkJ.js`: 37.42 kB (gzip: 10.51 kB)

---

## G. STATUS GIT & STATUS REPOSITORI

### 1. Status Git Saat Ini
- **Branch Aktif:** `main`
- **Tracking Branch:** Up to date with `origin/main` (berdasarkan riwayat commit lokal terakhir).
- **Commit Terakhir:** `31af8e5` (*feat: adaptive QR checkout modal for Native QRIS vs Midtrans Live Snap*).
- **Working Tree State:** **Dirty (Terdapat 22 file modifikasi lokal dan 6 file baru yang belum di-commit)**.

### 2. Daftar Perubahan yang Belum Di-Commit (*Uncommitted Changes*)
Sesuai batasan operasional, tidak ada perintah Git mutasi (`git add`, `git commit`, `git push`, atau `git tag`) yang dijalankan secara otomatis. Seluruh perubahan ini tercatat aman di working tree lokal:

#### A. File Termodifikasi (22 Files)
1. `backend/package.json` — Penambahan script pengujian `node --test tests/security.test.js`.
2. `backend/prisma/schema.prisma` — Sinkronisasi skema Prisma dengan kolom keamanan baru.
3. `backend/src/config/db.js` — Migrasi DDL idempoten untuk database SQLite lokal.
4. `backend/src/config/prisma.js` — Penanganan query fallback multi-driver.
5. `backend/src/controllers/admin.controller.js` — Audit trail logging dan proteksi pesanan legacy.
6. `backend/src/controllers/order.controller.js` — Otoritas harga, guard penolakan QRIS demo, sanitasi pelacakan publik.
7. `backend/src/controllers/webhook.controller.js` — Verifikasi SHA-512 ketat, penanganan gross amount mismatch.
8. `backend/src/jobs/processOrderQueue.js` — Penanganan worker ganda dan retry aman.
9. `backend/src/routes/order.routes.js` — Rate limiting dan sanitasi endpoint tracking.
10. `backend/src/routes/payment.routes.js` — Otorisasi terpusat `evaluateOrderAuthorization` (Deny by Default).
11. `backend/src/routes/webhook.routes.js` — Pemblokiran endpoint simulasi di production.
12. `backend/src/services/paymentGateway.js` — Implementasi `createVaTransaction` Midtrans VA.
13. `backend/src/services/topupProvider.js` — Penanganan timeout Digiflazz dan parsing respon.
14. `frontend/index.html` — Penambahan modal pratinjau QRIS Demo dan pembersihan tombol simulasi sandbox.
15. `frontend/src/components/paymentAccordion.js` — Pemisahan kategori VA vs QRIS Demo dengan badge status.
16. `frontend/src/data/payments.js` — Konfigurasi status `Tersedia` (VA) dan `Belum Aktif` (QRIS Demo).
17. `frontend/src/main.js` — Event listener modal demo dan tombol pengalih ke Virtual Account.
18. `frontend/src/style.css` — Styling badge status, chip label demo, dan kartu pembayaran.
19. `frontend/src/views/invoiceView.js` — Tampilan instruksi pembayaran Virtual Account & pembersihan simulasi sandbox.
20. `frontend/src/views/mlView.js` — Validasi checkout bank VA dan render detail transaksi nomor VA.
21. `frontend/src/views/valoView.js` — Validasi checkout bank VA untuk Valorant.
22. `package.json` — Konfigurasi root workspace.

#### B. File Baru Belum Dilacak / Untracked (6 Files / Folders)
1. `backend/src/utils/` — Berisi helper otorisasi terpusat [`orderAuth.js`](file:///d:/3d/darstore/backend/src/utils/orderAuth.js).
2. `backend/tests/` — Berisi suite pengujian otomatis lengkap [`security.test.js`](file:///d:/3d/darstore/backend/tests/security.test.js).
3. `backend/test-database.sqlite` — Database SQLite lokal khusus runtime pengujian otomatis.
4. `docs/` — Folder dokumentasi teknis & laporan audit.
5. `frontend/public/assets/payments/qris_demo_watermark.svg` — Vektor QRIS dengan watermark diagonal permanen.
6. `bab4-evidence-audit.md` — Catatan pengujian awal.

---

## H. STATUS DEPLOYMENT (LOKAL VS LIVE)

Penting untuk membedakan antara kondisi kode lokal dan kondisi aplikasi live yang terpasang di Vercel:

| Aspek | Kondisi Kode Lokal (Baseline Saat Ini) | Kondisi Aplikasi Live (Vercel Production) |
| :--- | :--- | :--- |
| **Commit ID** | Berbasis commit `31af8e5` + 22 file modifikasi keamanan | Berjalan pada commit `31af8e5` (sebelum modifikasi VA & Otorisasi Legacy) |
| **Metode Pembayaran** | Virtual Account (Aktif) + QRIS Demo (Modal Watermark) | Masih menampilkan QR checkout adaptif / Snap redirect lama |
| **Otorisasi Legacy** | Prinsip *Deny by Default* (HTTP 403 untuk pesanan tanpa token) | Masih rentan bypass jika pesanan legacy diakses tanpa token |
| **Sanitasi Publik** | Nomor kontak disamarkan (`0812****890`), URL rahasia dihapus | Kontak penuh masih dapat terbaca via endpoint pelacakan |
| **Hasil Build** | Telah divalidasi lokal dan sukses bersih (Vite 663ms) | Ter-deploy dari build lama |

> [!IMPORTANT]
> Seluruh perbaikan keamanan dan konfigurasi Virtual Account saat ini berada pada lingkungan lokal yang stabil. Untuk menerapkan perbaikan ini ke aplikasi live, diperlukan persetujuan pengguna untuk melakukan Git commit, push ke branch `main`, dan pemicuan deployment Vercel.

---

## I. BATASAN OPERASIONAL & STATUS PRODUKSI AKTUAL

Untuk menjaga kejujuran dan validitas akademis laporan Tugas Akhir, batasan berikut ditegaskan:

1. **Pengujian Menggunakan Mocking Terisolasi:**
   Keberhasilan 48 skenario pengujian membuktikan **kebenaran logika aplikasi, penanganan kesalahan, dan kepatuhan arsitektur backend**. Namun, pengujian tersebut menggunakan mock gateway/provider lokal, bukan transaksi uang riil.
2. **Channel Virtual Account Production:**
   Kredensial Midtrans Production terpasang, namun transaksi uang nyata (*live money charge*) sengaja tidak dijalankan demi mematuhi batasan operasional nol biaya pengujian.
3. **Status Channel QRIS Production:**
   Channel QRIS Core API pada akun Midtrans Production terbukti **belum diaktifkan** oleh pihak Midtrans. Oleh karena itu, penetapan QRIS sebagai demonstrasi visual non-aktif merupakan keputusan rekayasa sistem yang tepat.
4. **Status Provider Digiflazz Production:**
   Kredensial Digiflazz Production tersedia. Namun transaksi pemesanan diamond nyata sengaja tidak dieksekusi agar tidak memotong saldo akun secara riil. Selain itu, IP Vercel belum di-whitelist secara statis pada dashboard Digiflazz.
5. **Integritas Database Supabase Production:**
   Struktur tabel `orders` pada PostgreSQL Supabase telah diverifikasi read-only: kelima kolom keamanan (`access_token`, `points_awarded`, `points_refunded`, `sn`, `redirect_url`) telah ada dan tidak ada data yang rusak atau hilang.

---

## J. KEBIJAKAN FEATURE FREEZE (FEATURE FREEZE POLICY)

Mulai tanggal **23 Oktober 2026**, proyek Dar'sstore dinyatakan memasuki status **FEATURE FREEZE**. Kebijakan yang berlaku:

### 1. Aturan Larangan Keras (*Prohibited Actions*)
- DILARANG menambahkan fitur, game, atau metode pembayaran baru.
- DILARANG mengubah arsitektur frontend, skema database, atau dependency package.
- DILARANG melakukan refactoring kode yang tidak didasari oleh kebutuhan perbaikan bug kritis.
- DILARANG memodifikasi konfigurasi Midtrans, Digiflazz, atau Supabase tanpa izin eksplisit.

### 2. Pengecualian yang Diizinkan (*Permitted Exceptions*)
Perubahan kode setelah baseline ini hanya diperbolehkan jika memenuhi salah satu syarat berikut:
1. Menutup celah kerentanan keamanan yang terbukti (*proven security vulnerability*).
2. Memperbaiki bug kritis yang menghentikan alur utama aplikasi (*blocker bug*).
3. Mengoreksi ketidakkonsistenan yang secara material memengaruhi validitas data pada laporan Tugas Akhir.
4. Perbaikan yang diminta secara eksplisit oleh pengguna dengan konfirmasi tertulis.

---

## K. KEBUTUHAN DOKUMENTASI BAB IV TUGAS AKHIR

Kondisi baseline ini menyediakan seluruh bukti empiris yang diperlukan untuk menyusun **BAB IV (Hasil dan Pembahasan)**:

### 1. Pembahasan yang Harus Dimasukkan
1. **Implementasi Antarmuka Pengguna (UI/UX):**
   - Halaman katalog top-up Mobile Legends dan Valorant.
   - Accordion metode pembayaran dengan pemisahan status "Tersedia" (VA) dan "Belum Aktif" (QRIS Demo).
   - Dialog pratinjau QRIS Demonstrasi ber-watermark untuk kebutuhan evaluasi sistem.
   - Modal pembayaran nomor Virtual Account lengkap dengan hitung mundur 24 jam dan panduan transfer.
2. **Implementasi Keamanan Sistem (Security Engineering):**
   - Pembuktian Server-Side Price Authority terhadap serangan manipulasi harga client.
   - Pembuktian verifikasi kriptografis webhook Midtrans SHA-512.
   - Pembuktian mekanisme isolasi transaksi tamu menggunakan Bearer Access Token.
   - Pembuktian penerapan prinsip *Deny by Default* pada pesanan lama (*legacy authorization*).
   - Pembuktian mitigasi IDOR dan perlindungan privasi data melalui masking kontak pelacakan publik.
3. **Pengujian Fungsional & Keamanan (Testing & Evaluation):**
   - Tabel hasil eksekusi 48 skenario pengujian otomatis (*Automated Test Matrix*).
   - Bukti log eksekusi test runner Node.js dengan tingkat kelulusan 100%.

### 2. Aset & Bukti yang Siap Digunakan
- **Aset Watermark Demo:** [`frontend/public/assets/payments/qris_demo_watermark.svg`](file:///d:/3d/darstore/frontend/public/assets/payments/qris_demo_watermark.svg)
- **Suite Pengujian Keamanan:** [`backend/tests/security.test.js`](file:///d:/3d/darstore/backend/tests/security.test.js)
- **Modul Otorisasi Terpusat:** [`backend/src/utils/orderAuth.js`](file:///d:/3d/darstore/backend/src/utils/orderAuth.js)
- **Laporan Implementasi Pembayaran:** [`docs/FINAL_PAYMENT_IMPLEMENTATION_REPORT.md`](file:///d:/3d/darstore/docs/FINAL_PAYMENT_IMPLEMENTATION_REPORT.md)
- **Laporan Otorisasi Legacy:** [`docs/FINAL_LEGACY_AUTH_FIX_REPORT.md`](file:///d:/3d/darstore/docs/FINAL_LEGACY_AUTH_FIX_REPORT.md)
- **Laporan Integritas Database:** [`docs/SUPABASE_DATABASE_INTEGRITY_REPORT.md`](file:///d:/3d/darstore/docs/SUPABASE_DATABASE_INTEGRITY_REPORT.md)
- **Laporan Kesiapan Produksi:** [`docs/FINAL_PRODUCTION_READINESS_REPORT.md`](file:///d:/3d/darstore/docs/FINAL_PRODUCTION_READINESS_REPORT.md)
