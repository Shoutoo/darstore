# LAPORAN AUDIT DAN PERBAIKAN KEAMANAN SISTEM PEMBAYARAN & PEMENUHAN PRODUK
**Proyek:** Dar'sstore Top-Up Game (Mobile Legends & Valorant)  
**Status Audit & Hardening:** SELESAI & TERVERIFIKASI  
**Tanggal Pengujian:** 23 Oktober 2026  
**Klasifikasi:** Internal Security Documentation  

---

## DAFTAR ISI
1. [A. Ringkasan Audit & Matriks Kerentanan](#a-ringkasan-audit--matriks-kerentanan)
2. [B. Rincian File yang Diubah](#b-rincian-file-yang-diubah)
3. [C. Perbaikan Sistem Pembayaran](#c-perbaikan-sistem-pembayaran)
4. [D. Perbaikan Pemenuhan Provider Digiflazz](#d-perbaikan-pemenuhan-provider-digiflazz)
5. [E. Status Integrasi Midtrans Production & Fallback](#e-status-integrasi-midtrans-production--fallback)
6. [F. Hasil Pengujian Otomatis (15 Skenario Keamanan)](#f-hasil-pengujian-otomatis-15-skenario-keamanan)
7. [G. Temuan Tersisa & Rekomendasi Lanjutan](#g-temuan-tersisa--rekomendasi-lanjutan)
8. [H. Dampak terhadap Dokumentasi Tugas Akhir (BAB IV)](#h-dampak-terhadap-dokumentasi-tugas-akhir-bab-iv)

---

## A. RINGKASAN AUDIT & MATRIKS KERENTANAN

Audit kode komprehensif dilakukan terhadap implementasi transaksi, otorisasi, webhook gateway pembayaran, dan antrean pemrosesan produk. Ditemukan 12 kerentanan keamanan aktual mulai dari tingkat Risiko Kritis (*Critical*) hingga Sedang (*Medium*). Seluruh kerentanan tersebut telah ditangani dan divalidasi dengan pengujian otomatis.

### Matriks Kerentanan

| ID | Kategori | Lokasi File Asal | Tingkat Risiko | Deskripsi Singkat & Dampak | Status Perbaikan |
|:---|:---|:---|:---:|:---|:---:|
| **VULN-01** | *Insecure Simulation* | [`backend/src/routes/webhook.routes.js:14`](file:///d:/3d/darstore/backend/src/routes/webhook.routes.js#L14), [`backend/src/controllers/webhook.controller.js:26`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L26) | **Kritis** | Endpoint `/api/webhook/simulate-payment` dapat diakses bebas di lingkungan produksi tanpa validasi environment tepercaya, memungkinkan siapa saja menandai pesanan lunas. | **TERATASI (404 di Prod)** |
| **VULN-02** | *Provider Drain* | [`backend/src/controllers/webhook.controller.js:42`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L42) | **Kritis** | Endpoint simulasi memasukkan pesanan ke antrean `orderQueue`, sehingga pemanggilan simulasi memicu pemesanan nyata ke Digiflazz dan menguras saldo deposit merchant. | **TERATASI (Bypass Provider Queue)** |
| **VULN-03** | *Price Tampering* | [`backend/src/routes/payment.routes.js:42-75`](file:///d:/3d/darstore/backend/src/routes/payment.routes.js#L42-L75) | **Kritis** | Endpoint `/api/payment/payment-link` menerima parameter `amount`/`gross_amount` langsung dari body request frontend tanpa validasi ulang terhadap harga database. | **TERATASI (Server-Side Price Authority)** |
| **VULN-04** | *Broken Object Authorization* | [`backend/src/controllers/order.controller.js:45-70`](file:///d:/3d/darstore/backend/src/controllers/order.controller.js#L45-L70), [`backend/src/routes/payment.routes.js:45-60`](file:///d:/3d/darstore/backend/src/routes/payment.routes.js#L45-L60) | **Tinggi** | Guest checkout tidak memiliki mekanisme token akses rahasia. Siapa pun yang menebak format invoice dapat membuat tagihan atau mengakses data pembeli lain. | **TERATASI (Crypto Access Token)** |
| **VULN-05** | *Signature Bypass* | [`backend/src/controllers/webhook.controller.js:112-125`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L112-L125) | **Kritis** | Terdapat pengecualian regex `isTestNotification` yang meloloskan webhook tanpa validasi SHA-512 jika payload memiliki format order ID tertentu. | **TERATASI (Strict SHA-512 Enforced)** |
| **VULN-06** | *Gross Amount Mismatch* | [`backend/src/controllers/webhook.controller.js:125-160`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L125-L160) | **Tinggi** | Webhook tidak membandingkan nilai `gross_amount` yang dibayar di Midtrans dengan `total_harga` pesanan yang tercatat di database, rentan transaksi kurang-bayar (*underpaid*). | **TERATASI (Strict DB Amount Matching)** |
| **VULN-07** | *Race Condition & Double Fulfillment* | [`backend/src/controllers/webhook.controller.js:140-195`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L140-L195), [`backend/src/jobs/processOrderQueue.js:35-95`](file:///d:/3d/darstore/backend/src/jobs/processOrderQueue.js#L35-L95) | **Tinggi** | Webhook berulang (*replay*) atau permintaan bersamaan (*concurrent*) dapat memicu `orderQueue.addOrder` lebih dari satu kali untuk invoice yang sama. | **TERATASI (Atomic State Update)** |
| **VULN-08** | *Sensitive Data Exposure* | [`backend/src/controllers/webhook.controller.js:160-180`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L160-L180) | **Sedang** | Pencatatan ke `payment_logs` mencatat seluruh payload mentah tanpa sanitasi, berpotensi mengekspos token sesi atau kredensial internal gateway ke log publik. | **TERATASI (Payload Sanitization)** |
| **VULN-09** | *Incorrect Digiflazz RC Mapping* | [`backend/src/services/topupProvider.js:165-195`](file:///d:/3d/darstore/backend/src/services/topupProvider.js#L165-L195) | **Sedang** | Pemetaan respons Digiflazz untuk RC 40 (kesalahan format/payload), RC 43 (SKU gangguan/tidak aktif), dan RC 44 (saldo deposit kurang) belum sesuai dokumentasi resmi. | **TERATASI (Standarisasi RC Resmi)** |
| **VULN-10** | *Unsafe Timeout Handling* | [`backend/src/services/topupProvider.js:195-208`](file:///d:/3d/darstore/backend/src/services/topupProvider.js#L195-L208) | **Tinggi** | Kesalahan jaringan atau timeout ke Digiflazz dianggap sebagai kegagalan final seketika, berisiko retry yang menyebabkan top-up ganda atau refund keliru padahal transaksi di provider masih berjalan. | **TERATASI (Status Pending & Rekonsiliasi)** |
| **VULN-11** | *Double Points Operation* | [`backend/src/controllers/webhook.controller.js:190-230`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L190-L230), [`backend/src/jobs/processOrderQueue.js:60-90`](file:///d:/3d/darstore/backend/src/jobs/processOrderQueue.js#L60-L90) | **Sedang** | Callback sukses berulang atau status kedaluwarsa berulang dapat memberikan poin reward atau mengembalikan poin diskon berkali-kali. | **TERATASI (Atomic Flag `points_awarded` & `points_refunded`)** |
| **VULN-12** | *Silent Sandbox / Fake QRIS Fallback* | [`backend/src/services/paymentGateway.js:50-100`](file:///d:/3d/darstore/backend/src/services/paymentGateway.js#L50-L100) | **Tinggi** | Saat integrasi production mengalami error, sistem menghasilkan QRIS tiruan lokal (*mock sandbox*) tanpa membedakan jenis kegagalan. | **TERATASI (Strict Error Classification & Snap Live)** |

---

## B. RINCIAN FILE YANG DIUBAH

Berikut adalah daftar file yang dimodifikasi, fungsi perubahannya, dan alasan teknis di baliknya:

### 1. `backend/src/routes/webhook.routes.js`
- **Fungsi:** Menjaga proteksi tingkat routing untuk endpoint simulasi pembayaran.
- **Alasan:** Memastikan bahwa pada mode production (`NODE_ENV === 'production'`), route `/simulate-payment` tidak didaftarkan atau ditolak langsung dengan status HTTP 404 sebelum masuk ke logika controller.

### 2. `backend/src/controllers/webhook.controller.js`
- **Fungsi:** Mengamankan `simulatePayment` dan `handlePaymentWebhook`.
- **Alasan:** 
  - Memblokir `simulatePayment` di lingkungan produksi (HTTP 404).
  - Pada lingkungan pengembangan, simulasi hanya menandai status pesanan secara langsung dan menghasilkan SN simulasi tanpa meneruskan pesanan ke antrean `orderQueue` Digiflazz.
  - Menghapus celah bypass signature `isTestNotification`.
  - Memvalidasi keaslian signature Midtrans menggunakan SHA-512 secara ketat.
  - Memverifikasi kesesuaian `gross_amount` dengan `order.total_harga`.
  - Melakukan transisi status database atomik (`UPDATE orders SET status = 'Diproses' WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending')`) untuk mencegah *race condition*.
  - Melakukan sanitasi log sebelum dicatat ke tabel `payment_logs`.

### 3. `backend/src/routes/payment.routes.js`
- **Fungsi:** Memperbaiki endpoint pembuatan tagihan `/api/payment/create` dan `/api/payment/payment-link`.
- **Alasan:** 
  - Mengabaikan parameter nominal yang dikirim oleh frontend.
  - Mengambil data pesanan dan total harga riil langsung dari database.
  - Memeriksa hak kepemilikan pesanan: bagi user terdaftar dicek `user_id`, sedangkan bagi pengguna tamu (*guest*) wajib menyertakan `access_token` yang valid.
  - Mencegah pembuatan tagihan berganda: jika tagihan aktif sudah ada dan belum kedaluwarsa, endpoint mengembalikan URL tagihan yang telah tersimpan.

### 4. `backend/src/controllers/order.controller.js`
- **Fungsi:** Otorisasi pesanan dan kalkulasi harga server-side.
- **Alasan:** 
  - Memastikan seluruh perhitungan total harga produk, kalkulasi diskon poin (maksimal 20%), dan validasi kontak pelanggan dilakukan di backend.
  - Menghasilkan `access_token` berbasis `crypto.randomBytes(24).toString('hex')` untuk setiap pesanan baru guna mengamankan guest checkout.
  - Melindungi pembacaan detail pesanan (`getOrderDetails`) dengan pemeriksaan kepemilikan (`user_id` atau `access_token`).

### 5. `backend/src/config/db.js` & `backend/src/config/prisma.js`
- **Fungsi:** Skema dan migrasi database PostgreSQL (Supabase) serta SQLite lokal.
- **Alasan:** 
  - Menambahkan kolom `access_token` (VARCHAR(64)), `points_awarded` (BOOLEAN DEFAULT 0), `points_refunded` (BOOLEAN DEFAULT 0), `sn` (VARCHAR(255)), dan `redirect_url` (TEXT) ke tabel `orders`.
  - Memastikan persistensi atribut keamanan dan penanganan status idempotensi di tingkat basis data.

### 6. `backend/src/services/paymentGateway.js`
- **Fungsi:** Integrasi Midtrans Core API (QRIS) dan Midtrans Snap.
- **Alasan:** 
  - Mengimplementasikan klasifikasi error QRIS Core API: hanya melakukan fallback ke Snap Live jika kegagalan disebabkan channel QRIS belum aktif (misal pesan error *"Payment channel is not activated"* atau 404).
  - Menolak dan melempar error resmi jika terjadi kegagalan otentikasi (HTTP 401) atau format payload salah (HTTP 400).
  - Melarang peralihan diam-diam ke sandbox saat mode production aktif.
  - Menghapus pembuatan gambar QRIS palsu.

### 7. `backend/src/services/topupProvider.js`
- **Fungsi:** Layanan integrasi ke provider Digiflazz.
- **Alasan:** 
  - Memperbaiki pemetaan kode respon (RC) resmi: RC 40 (kesalahan parameter/payload), RC 43 (SKU gangguan/tidak aktif), dan RC 44 (saldo deposit tidak mencukupi).
  - Mengimplementasikan batas waktu jaringan (*timeout*) menggunakan `AbortSignal.timeout(10000)` dan menandai transaksi timeout sebagai `pending` agar tidak memicu pemesanan berulang yang berbahaya.
  - Menyediakan fungsi `reconcileTransaction` untuk pengecekan status menggunakan `ref_id` yang sama tanpa pengisian saldo ganda.

### 8. `backend/src/jobs/processOrderQueue.js`
- **Fungsi:** Pemrosesan antrean pemenuhan pesanan ke provider game.
- **Alasan:** 
  - Menjamin eksekusi idempoten terhadap status pesanan.
  - Menggunakan flag `points_awarded` atomik sehingga poin loyalitas hanya diberikan tepat 1 kali ketika pesanan berhasil.
  - Menggunakan flag `points_refunded` atomik sehingga poin yang digunakan dikembalikan tepat 1 kali jika pesanan dinyatakan gagal permanen.

### 9. `frontend/src/views/invoiceView.js` & `frontend/src/main.js`
- **Fungsi:** Tampilan invoice dan interaksi checkout.
- **Alasan:** 
  - Tombol simulasi pembayaran hanya ditampilkan jika pesanan menyediakan atribut `simulator_url`.
  - Menangani respon HTTP 404 dari server secara elegan dengan notifikasi peringatan bila simulasi dipanggil di lingkungan production.
  - Meneruskan `access_token` pada setiap permintaan status dan pembuatan tagihan pembayaran tamu.

### 10. `backend/tests/security.test.js` & `package.json`
- **Fungsi:** Pengujian otomatis 15 skenario keamanan menggunakan *native test runner* Node.js (`node --test`).
- **Alasan:** Memvalidasi seluruh skenario audit keamanan secara terisolasi tanpa transaksi riil.

---

## C. PERBAIKAN SISTEM PEMBAYARAN

### 1. Otoritas Harga di Tingkat Backend (*Server-Side Price Authority*)
Sebelum perbaikan, parameter `amount` dapat dikirim dari frontend pada route `/api/payment/payment-link`. Kondisi ini diperbaiki secara menyeluruh:
- Backend hanya menerima `order_id` (nomor invoice) dan `payment_channel`.
- Pesanan dicari ke database; jika tidak ditemukan, server merespons HTTP 404.
- Nilai tagihan yang dikirimkan ke Midtrans wajib berasal dari kolom `orders.total_harga` di database.
- Perhitungan harga dasar produk selalu merujuk pada tabel `products`. Diskon penggunaan poin dihitung ulang di backend dengan batas maksimal 20% dari total nilai transaksi.
- Parameter `amount` atau `gross_amount` dari frontend diabaikan total.

### 2. Otorisasi Pesanan Tamu (*Secure Guest Checkout*)
Untuk tetap mendukung fitur checkout tanpa login (*guest checkout*) tanpa mengorbankan keamanan:
- Saat pesanan baru dibuat melalui `orderController.createOrder`, backend membangkitkan token acak berentropi tinggi:
  ```javascript
  const accessToken = crypto.randomBytes(24).toString('hex');
  ```
- Token ini disimpan di kolom `orders.access_token` dan dikembalikan ke frontend hanya pada sesi checkout pembeli yang bersangkutan.
- Setiap kali endpoint detail pesanan atau pembuatan tagihan dipanggil oleh pengguna tamu, backend memverifikasi:
  ```javascript
  if (!req.user || req.user.id !== order.user_id) {
    if (!token || token !== order.access_token) {
      return res.status(403).json({ error: 'Akses pesanan ditolak. Diperlukan otorisasi token pesanan.' });
    }
  }
  ```
- Pendekatan ini mencegah pengguna lain menebak nomor invoice (misal `DS-20261023-...`) untuk melihat data sensitif atau membuat tagihan pembayaran fiktif.

### 3. Pencegahan Tagihan Ganda Aktif (*Duplicate Bill Prevention*)
- Jika pengguna meminta pembuatan tautan pembayaran untuk pesanan yang sudah memiliki tautan pembayaran aktif dan statusnya masih `Menunggu Pembayaran`, backend mengembalikan `redirect_url` yang sudah tersimpan tanpa memanggil ulang API gateway.

### 4. Verifikasi Webhook Midtrans yang Aman
Pada `/api/webhook/payment`:
- **SHA-512 Signature Validation:** Signature wajib diverifikasi menggunakan formula resmi Midtrans:
  $$\text{Signature} = \text{SHA-512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$
  Seluruh bypass berbasis regex dinonaktifkan.
- **Pencocokan Nominal:** `gross_amount` dari Midtrans dicocokkan dengan `order.total_harga` di database:
  ```javascript
  if (Math.round(Number(gross_amount)) !== Math.round(Number(order.total_harga))) {
    return res.status(400).json({ error: 'Gross amount mismatch' });
  }
  ```
- **Transisi Atomik Anti Race-Condition:**
  Pembaruan status dari `Menunggu Pembayaran` ke `Diproses` dieksekusi secara atomik menggunakan klausul kondisi database:
  ```sql
  UPDATE orders SET status = 'Diproses' WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending');
  ```
  Jika dua webhook tiba dalam milidetik yang sama, hanya satu eksekusi yang menghasilkan baris terpengaruh (*rows affected = 1*), sehingga antrean pemenuhan hanya dipicu tepat satu kali.

---

## D. PERBAIKAN PEMENUHAN PROVIDER DIGIFLAZZ

### 1. Standarisasi Respon Kode (RC) Resmi
Berdasarkan dokumentasi resmi Digiflazz API, kode status dipetakan secara presisi:
- **RC 00:** Transaksi Sukses. Serial Number (SN) disimpan ke database.
- **RC 03:** Transaksi Berstatus Pending di provider, menunggu callback webhook atau rekonsiliasi.
- **RC 40:** Kesalahan format parameter/payload pesanan (*Payload Parameter Error*).
- **RC 41:** Buyer SKU Code tidak valid atau tidak terdaftar.
- **RC 42:** IP server belum terdaftar pada IP Whitelist Digiflazz.
- **RC 43:** SKU produk sedang gangguan atau tidak aktif di provider.
- **RC 44:** Saldo deposit Digiflazz tidak mencukupi untuk memproses pesanan.
- **RC 45:** ID Akun Game atau Server tujuan salah / tidak sesuai region.
- **RC 53:** Duplikasi referensi transaksi (*Duplicate ref_id*).

### 2. Penanganan Timeout yang Aman (*Safe Timeout Handling*)
- Pemanggilan HTTP ke endpoint transaksi Digiflazz dilengkapi timeout 10 detik via `AbortSignal.timeout(10000)`.
- Jika terjadi timeout jaringan, sistem **TIDAK** langsung menganggap transaksi gagal permanen dan **TIDAK** melakukan retry yang membabi buta.
- Transaksi ditandai sebagai `pending`:
  ```javascript
  return {
    success: true,
    pending: true,
    message: 'Koneksi ke Digiflazz timeout. Transaksi berstatus pending menunggu konfirmasi callback/rekonsiliasi.',
    raw: { status: 'Pending', timeout: true }
  };
  ```
- Untuk memeriksa status transaksi yang tertunda, digunakan mekanisme rekonsiliasi resmi dengan memanggil endpoint transaksi menggunakan `ref_id` yang sama, sehingga status terkini diperoleh tanpa memotong saldo berulang.

### 3. Idempotensi Pengelolaan Poin
- **Pemberian Poin Loyalitas:** Diproteksi kolom `points_awarded = 1`. Callback atau pemrosesan berulang tidak akan menambahkan poin lebih dari satu kali.
- **Pengembalian Poin Diskon:** Diproteksi kolom `points_refunded = 1`. Apabila status pesanan berakhir kedaluwarsa (*expire*) atau dibatalkan (*cancel*), poin dikembalikan ke saldo pengguna tepat satu kali.

---

## E. STATUS INTEGRASI MIDTRANS PRODUCTION & FALLBACK

### 1. Kondisi Akun & Channel Saat Ini
- **Status Akun:** Akun Midtrans Production telah aktif.
- **Status Channel QRIS Production:** Channel Core API QRIS langsung belum aktif (masih menunggu penyelesaian aktivasi dari pihak acquirer/Midtrans).
- **Kredensial:** Konfigurasi environment menggunakan Server Key Production resmi yang valid.

### 2. Mekanisme Smart Fallback ke Midtrans Snap Live
Untuk memastikan transaksi pelanggan di situs tetap berjalan lancar tanpa mengalami kegagalan sistem:
1. Sistem terlebih dahulu mencoba membuat transaksi Core API QRIS Production.
2. Jika Midtrans merespons error yang menandakan channel QRIS belum aktif (misalnya respon error `"Payment channel is not activated"` atau HTTP 404 dari POP ID):
   - Sistem mencatat pemberitahuan: `[MIDTRANS PRODUCTION] Core API QRIS channel belum diaktifkan... Mengalihkan ke Midtrans Snap Live Checkout...`
   - Sistem secara otomatis mengalihkan transaksi ke **Midtrans Snap Live**.
3. **Klasifikasi Error yang Ketat:**
   - Fallback HANYA dijalankan untuk kegagalan channel belum aktif.
   - Jika error disebabkan kredensial tidak sah (HTTP 401) atau format payload salah (HTTP 400), error langsung dilempar dan transaksi dihentikan demi integritas sistem.
4. **Pencegahan Sandbox Diam-Diam:**
   - Sistem dilarang keras beralih ke mode Sandbox secara diam-diam saat `MIDTRANS_IS_PRODUCTION=true`.
   - Tidak ada pembuatan QRIS tiruan (*fake mock QRIS*) di lingkungan produksi.
5. **Channel Aktif pada Snap Live:**
   Transaksi Snap menggunakan channel pembayaran yang sudah aktif pada akun merchant:
   `['gopay', 'bni_va', 'bri_va', 'echannel', 'permata_va', 'cimb_va']`.

---

## F. HASIL PENGUJIAN OTOMATIS (15 SKENARIO KEAMANAN)

Pengujian otomatis dieksekusi secara terisolasi menggunakan built-in Node.js Test Runner (`node --test tests/security.test.js`) dengan database SQLite pengujian khusus. Seluruh gateway, email, dan provider menggunakan *mock* dan *stub* untuk menjamin tidak ada transaksi uang riil, tidak ada pemotongan saldo deposit, dan tidak ada pengiriman diamond/VP game nyata selama pengujian.

### Ringkasan Eksekusi Pengujian
- **Total Skenario:** 15 Skenario
- **Skenario Lulus:** 15 Skenario (100%)
- **Skenario Gagal:** 0 Skenario
- **Durasi Eksekusi:** 9.67 detik

### Bukti Hasil Pengujian per Skenario

| No | Skenario Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Bukti Output Log Pengujian |
|:---:|:---|:---|:---|:---:|:---|
| **1** | Simulasi pembayaran ditolak pada production | Mengembalikan HTTP 404 & status DB tidak berubah | HTTP 404 Not Found, status tetap `Menunggu Pembayaran` | **LULUS** | `✔ Skenario 1: Simulasi pembayaran ditolak pada production (73.9ms)` |
| **2** | Nominal dimanipulasi frontend diabaikan | Backend menggunakan `total_harga` asli dari DB | Gateway menerima nilai asli Rp 30.000 (Rp 1 dari frontend diabaikan) | **LULUS** | `✔ Skenario 2: Nominal yang dimanipulasi frontend diabaikan (78.7ms)` |
| **3** | Pembayaran dengan invoice tidak valid ditolak | Mengembalikan HTTP 404 saat invoice tidak ada di DB | Webhook merespons 404 Not Found dan mencatat peringatan | **LULUS** | `[WEBHOOK] Order DS-NONEXISTENT-... tidak ditemukan di database.`<br>`✔ Skenario 3: Pembayaran dengan invoice tidak valid ditolak (1.5ms)` |
| **4** | Pembayaran dengan nominal berbeda ditolak | Webhook menolak pembayaran kurang-bayar (HTTP 400) | Respon 400 'Gross amount mismatch', status pesanan tetap pending | **LULUS** | `[WEBHOOK SECURITY ALERT] Nominal mismatch: Midtrans=10000, DB=30000`<br>`✔ Skenario 4: Pembayaran dengan nominal berbeda ditolak (10.4ms)` |
| **5** | Signature webhook salah ditolak | Mengembalikan HTTP 403 Forbidden | Ditolak 403, status pesanan tidak berubah | **LULUS** | `[WEBHOOK SECURITY] Signature tidak valid untuk pesanan TEST-BAD-SIGN-...`<br>`✔ Skenario 5: Signature webhook yang salah ditolak (7.8ms)` |
| **6** | Webhook valid diproses dengan benar | Status pesanan diperbarui dan pemenuhan diproses | Respon 200 OK, status beralih ke `Diproses` / `Berhasil` | **LULUS** | `[WEBHOOK] Payment confirmed (settlement)`<br>`[QUEUE] Order completed successfully with SN`<br>`✔ Skenario 6: Webhook valid diproses dengan benar (237.1ms)` |
| **7** | Webhook identik berulang (*replay*) aman | Provider top-up hanya dipanggil 1 kali | Webhook kedua diabaikan secara idempoten, topup provider = 1 kali | **LULUS** | `✔ Skenario 7: Webhook identik yang dikirim berulang bersifat idempoten (308.3ms)` |
| **8** | Webhook bersamaan (*race condition*) aman | Proteksi atomik mencegah pemenuhan ganda | 2 webhook bersamaan hanya menghasilkan 1 kali pemanggilan provider | **LULUS** | `[WEBHOOK] Order sudah diproses oleh request bersamaan. Melewati enqueue ganda.`<br>`✔ Skenario 8: Webhook bersamaan terlindungi secara atomik (249.2ms)` |
| **9** | Pembayaran pending tidak memicu produk | Pesanan tetap berstatus pending tanpa antrean | Respon 200 OK, antrean pemenuhan tidak dieksekusi | **LULUS** | `[WEBHOOK] Status pending received. Order remains pending.`<br>`✔ Skenario 9: Pembayaran pending tidak memicu pemenuhan produk (122.2ms)` |
| **10** | Pembayaran kedaluwarsa ditangani benar | Status diubah menjadi Gagal & poin diskon dikembalikan | Respon 200 OK, status 'Gagal', poin diskon bertambah kembali ke user | **LULUS** | `[LOYALTY] Refunded 15 points to user ID 999 for failed/expired order`<br>`✔ Skenario 10: Pembayaran kedaluwarsa ditangani dengan benar (48.1ms)` |
| **11** | Poin loyalitas tidak diberikan dua kali | Callback sukses berulang tidak menggandakan reward | Poin loyalitas pengguna tetap sesuai hak transaksi (tepat 1x) | **LULUS** | `✔ Skenario 11: Poin loyalitas tidak diberikan dua kali (202.6ms)` |
| **12** | Pengembalian poin tidak dilakukan dua kali | Webhook cancel/expire berulang tidak menduplikasi refund | Poin yang di-refund tetap sama (flag `points_refunded` aktif) | **LULUS** | `✔ Skenario 12: Pengembalian poin (refund) tidak dilakukan dua kali (61.9ms)` |
| **13** | Timeout Digiflazz tidak menyebabkan retry berbahaya | Timeout ditandai pending, bukan gagal permanen | Respon `{ success: true, pending: true }` untuk rekonsiliasi berkala | **LULUS** | `[DIGIFLAZZ TIMEOUT] Transaksi timeout. Status belum pasti, ditandai pending.`<br>`✔ Skenario 13: Timeout Digiflazz ditandai pending & aman (2.5ms)` |
| **14** | Fallback Snap hanya untuk kondisi yang sesuai | Beralih ke Snap hanya jika QRIS belum aktif; error 401 dilempar | Error 'channel not activated' beralih ke Snap; error 401 melempar exception | **LULUS** | `[MIDTRANS PRODUCTION] Core API QRIS channel belum diaktifkan... Mengalihkan ke Midtrans Snap Live...`<br>`✔ Skenario 14: Fallback ke Snap hanya untuk kondisi yang sesuai (7.4ms)` |
| **15** | Tidak menggunakan sandbox diam-diam saat production | Kegagalan production tidak dialihkan ke mock sandbox | Error gateway live dilempar sebagai error resmi | **LULUS** | `✔ Skenario 15: Sistem tidak menggunakan sandbox secara diam-diam ketika production aktif (2.2ms)` |

---

## G. TEMUAN TERSISA & REKOMENDASI LANJUTAN

Meskipun seluruh perbaikan logika kode dan arsitektur keamanan telah tuntas 100%, terdapat beberapa faktor operasional pihak ketiga (*third-party operational prerequisites*) yang harus diperhatikan sebelum peluncuran transaksi komersial skala penuh:

1. **Aktivasi Channel QRIS Production Midtrans:**
   - *Status Saat Ini:* Akun Midtrans Production sudah siap, namun Core API QRIS masih menunggu proses persetujuan dan aktivasi dari pihak mitra acquirer Midtrans.
   - *Tindakan Lanjutan:* Setelah pihak Midtrans menyelesaikan aktivasi QRIS di dashboard merchant, sistem secara otomatis akan menggunakan Core API QRIS secara langsung tanpa harus melalui fallback Snap. Tidak diperlukan perubahan kode tambahan.

2. **IP Whitelist Digiflazz untuk Lingkungan Serverless (Vercel):**
   - *Kondisi:* Platform Vercel menggunakan alamat IP dinamis (*dynamic egress IPs*), sedangkan Digiflazz menerapkan validasi ketat terhadap IP server pengirim (RC 42).
   - *Rekomendasi:* Untuk deployment production di Vercel, disarankan menggunakan layanan *Static IP Proxy* (seperti Fixie / QuotaGuard Static) atau menyediakan micro-service proxy ber-IP statis untuk merutekan permintaan API dari Vercel menuju `api.digiflazz.com`.

3. **Konfigurasi Production Notification URL di Dashboard Midtrans:**
   - *Rekomendasi:* Pastikan *Payment Notification URL* pada menu *Settings > Configuration* di Dashboard Production Midtrans diisi dengan endpoint webhook resmi:
     `https://[domain-production]/api/webhook/payment`
     serta pastikan domain telah dilengkapi sertifikat SSL/TLS (HTTPS) yang valid.

---

## H. DAMPAK TERHADAP DOKUMENTASI TUGAS AKHIR (BAB IV)

Seluruh perbaikan teknis di atas memiliki korelasi langsung dengan pemaparan implementasi dan pengujian sistem pada Dokumen Tugas Akhir (BAB IV). Poin-poin pembaruan yang perlu dicerminkan dalam naskah skripsi/tugas akhir adalah sebagai berikut:

1. **Subbab Implementasi Keamanan Transaksi:**
   - Menjelaskan mekanisme *Server-Side Price Authority*: frontend hanya memilih item, backend yang memvalidasi harga katalog dan menghitung diskon poin.
   - Menjelaskan implementasi *Guest Access Token* menggunakan fungsi kriptografi `crypto.randomBytes(24)` untuk melindungi privasi transaksi tamu tanpa mewajibkan proses registrasi akun.
   - Menjelaskan verifikasi tanda tangan digital SHA-512 (*Cryptographic Signature Verification*) untuk memastikan integritas dan keaslian pesan dari Midtrans.

2. **Subbab Idempotensi & Arsitektur Antrean Transaksi:**
   - Menjelaskan bagaimana *Race Condition* antara notifikasi webhook simultan dicegah dengan query SQL kondisional atomik (`UPDATE orders SET status = 'Diproses' WHERE id = ? AND status IN ('Menunggu Pembayaran', 'pending')`).
   - Menjelaskan penanganan transaksi menggantung (*Pending Reconcile Pattern*) pada integrasi Digiflazz ketika terjadi batas waktu jaringan (*network timeout*), sehingga tidak terjadi pemotongan saldo berulang.

3. **Subbab Perancangan Fallback Gateway Pembayaran:**
   - Menampilkan diagram alir pembayaran yang mencakup mekanisme *Graceful Degradation / Smart Fallback* dari Midtrans Core API QRIS ke Midtrans Snap Live Checkout ketika channel QRIS belum aktif pada akun merchant produksi.

4. **Subbab Pengujian Sistem (Whitebox & Blackbox Security Testing):**
   - Tabel hasil pengujian 15 skenario keamanan pada Bagian F laporan ini dapat langsung diadopsi sebagai bukti pengujian fungsional dan keamanan transaksi pada matriks pengujian BAB IV.

---
*Laporan ini disusun secara otomatis berdasarkan audit kode sumber aktual dan hasil uji eksekusi test suite proyek Dar'sstore.*
