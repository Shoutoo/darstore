# LAPORAN PERBAIKAN FINAL KEAMANAN OTORISASI PESANAN LAMA (LEGACY INVOICE AUTHORIZATION)
## Implementasi Prinsip Deny by Default & Isolasi Transaksi Dar'sstore (BAB IV Tugas Akhir)

**Tanggal:** 23 Oktober 2026  
**Penyusun:** Senior Backend Engineer & Application Security Engineer  
**Proyek:** Website Top-Up Game Online Dar'sstore  
**Status Audit & Pengujian:** **100% SUKSES (48/48 SKENARIO LULUS)**

---

## DAFTAR ISI
1. [A. Ringkasan Masalah & Akar Penyebab](#a-ringkasan-masalah--akar-penyebab)
2. [B. Endpoint yang Diaudit](#b-endpoint-yang-diaudit)
3. [C. Perbaikan yang Dilakukan](#c-perbaikan-yang-dilakukan)
4. [D. Penanganan Pesanan Legacy (Tanpa Token)](#d-penanganan-pesanan-legacy-tanpa-token)
5. [E. Hasil Eksekusi Suite Pengujian Otomatis](#e-hasil-eksekusi-suite-pengujian-otomatis)
6. [F. Hasil Pengujian Regresi Sistem Pembayaran](#f-hasil-pengujian-regresi-sistem-pembayaran)
7. [G. Dampak terhadap Dokumentasi BAB IV Tugas Akhir](#g-dampak-terhadap-dokumentasi-bab-iv-tugas-akhir)
8. [H. Analisis Risiko & Batasan yang Tersisa](#h-analisis-risiko--batasan-yang-tersisa)

---

## A. RINGKASAN MASALAH & AKAR PENYEBAB

### 1. Deskripsi Celah Keamanan (Vulnerability Identification)
Pada implementasi sebelumnya di endpoint penerbitan ulang tagihan ([`backend/src/routes/payment.routes.js`](file:///d:/3d/darstore/backend/src/routes/payment.routes.js)), mekanisme verifikasi otorisasi pesanan disusun dengan logika kondisional sebagai berikut:

```javascript
// KODE LAMA SEBELUM PERBAIKAN:
if (order.user_id) {
  const isOwner = req.user && (req.user.id === order.user_id || req.user.role === 'admin');
  if (!isOwner) {
    return res.status(403).json({ success: false, message: 'Akses ditolak...' });
  }
} else if (order.access_token) {
  const clientToken = access_token || req.headers['x-order-token'] || req.query.token;
  if (!clientToken || clientToken !== order.access_token) {
    return res.status(403).json({ success: false, message: 'Akses ditolak...' });
  }
}
// Eksekusi pembuatan tagihan Payment Link / pengambilan redirect_url...
```

### 2. Kondisi Bypass pada Pesanan Lama (*Legacy Orders*)
Ketika sistem memproses transaksi tamu lama (*legacy guest orders*) yang dibuat sebelum fase migrasi kolom `access_token`:
- `order.user_id` bernilai `NULL` (karena guest checkout).
- `order.access_token` bernilai `NULL` (karena dibuat sebelum security hardening).

Akibatnya:
1. Blok `if (order.user_id)` bernilai `false`.
2. Blok `else if (order.access_token)` bernilai `false`.
3. Alur eksekusi **melewati seluruh lapisan validasi otorisasi** (*fall-through bypass*).
4. Siapapun pengguna publik atau pihak ketiga yang mengetahui atau menebak nomor invoice lama dapat menerbitkan ulang Payment Link, memperoleh `order.redirect_url`, atau melihat detail transaksi tanpa membuktikan kepemilikan sah.
5. Pada suite pengujian lama, Skenario 23 bahkan mengasumsikan transaksi lama harus tetap mengembalikan `HTTP 200` tanpa token, yang secara fundamental bertentangan dengan prinsip keamanan **Deny by Default**.

---

## B. ENDPOINT YANG DIAUDIT

Audit komprehensif dilakukan terhadap seluruh endpoint yang menangani siklus hidup pesanan, pembayaran, dan informasi sensitif pengguna:

| No | Endpoint | Method | Mekanisme Autentikasi Saat Ini | Kondisi yang Memungkinkan Bypass | Dampak terhadap Pesanan Lama | File & Nomor Baris | Status Pasca-Perbaikan |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | `/api/payment/payment-link` | POST | `optionalToken` | `order.user_id === null` && `order.access_token === null` melewati percabangan `if-else`. | Siapapun dapat menerbitkan tagihan Midtrans baru atau mengambil `redirect_url` lama. | [`backend/src/routes/payment.routes.js:136-154`](file:///d:/3d/darstore/backend/src/routes/payment.routes.js#L136-L154) | **DIPERBAIKI (Deny by Default 403)** |
| 2 | `/api/orders` | GET | `optionalToken` | Jika visitor publik tidak memiliki token, `order.access_token` dihapus namun nomor telepon/email (`wa_email_guest`) dan `redirect_url` tetap terlampir. | Informasi kontak pribadi pemesan lama dapat dibaca publik yang mengetahui nomor invoice. | [`backend/src/controllers/order.controller.js:424-434`](file:///d:/3d/darstore/backend/src/controllers/order.controller.js#L424-L434) | **DIPERBAIKI (Masking & Sanitasi Penuh)** |
| 3 | `/api/orders/track/:invoice` | GET | `optionalToken` | Alias dari `orderController.getOrder`. Perilaku sama dengan endpoint nomor 2. | Kontak dan tautan pembayaran lama berpotensi terbaca publik. | [`backend/src/routes/order.routes.js:9-12`](file:///d:/3d/darstore/backend/src/routes/order.routes.js#L9-L12) | **DIPERBAIKI (Tersanitasi)** |
| 4 | `/api/payment/create` | POST | `optionalToken` | Menerima order baru atau mendelegasikan ke `createOrder`. | Menghasilkan order baru dengan `accessToken` acak baru, tidak mengubah pesanan lama. | [`backend/src/routes/payment.routes.js:22-111`](file:///d:/3d/darstore/backend/src/routes/payment.routes.js#L22-L111) | **AMAN** |
| 5 | `/api/orders` | POST | `rateLimit`, `optionalToken` | Membuat pesanan baru. Menerapkan server-side pricing dan guard penolakan QRIS demo. | Selalu menerbitkan token 48-hex untuk pesanan tamu baru. | [`backend/src/controllers/order.controller.js:14-335`](file:///d:/3d/darstore/backend/src/controllers/order.controller.js#L14-L335) | **AMAN** |
| 6 | `/api/orders/history` | GET | Tanpa Token | Mengembalikan 20 riwayat pesanan publik dengan nomor kontak tersamarkan (`0812****890`). | Tidak membocorkan token, kontak penuh, maupun URL pembayaran. | [`backend/src/controllers/order.controller.js:446-481`](file:///d:/3d/darstore/backend/src/controllers/order.controller.js#L446-L481) | **AMAN** |
| 7 | `/api/payment/notification` | POST | SHA-512 Signature | Webhook Midtrans diverifikasi menggunakan hash SHA-512 `order_id + status_code + gross_amount + server_key`. | Hanya Midtrans resmi yang dapat mengirim notifikasi. Pesanan lama tetap dapat lunas secara sah tanpa butuh token. | [`backend/src/controllers/webhook.controller.js:31-150`](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js#L31-L150) | **AMAN** |
| 8 | `/api/admin/*` | ALL | `requireAdmin` | Dilindungi verifikasi JWT role `admin` dan pengecekan status blokir user. | Hanya admin yang terotentikasi yang dapat mengelola transaksi lama atau baru. | [`backend/src/routes/admin.routes.js:1-47`](file:///d:/3d/darstore/backend/src/routes/admin.routes.js#L1-L47) | **AMAN** |

---

## C. PERBAIKAN YANG DILAKUKAN

### 1. Pembuatan Modul Otorisasi Terpusat (`backend/src/utils/orderAuth.js`)
File baru: [`backend/src/utils/orderAuth.js`](file:///d:/3d/darstore/backend/src/utils/orderAuth.js)

Modul ini mengisolasi seluruh logika otorisasi dan proteksi data sensitif dengan prinsip **Deny by Default**:

- **Perbandingan Aman Anti-Timing Attack:**
  ```javascript
  function timingSafeEqualStr(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
  ```

- **Ekstraksi Token Fleksibel:** Mendukung pengambilan token dari request body (`access_token`, `token`), header HTTP (`x-order-token`, `x-access-token`, `access-token`), dan query string (`token`).

- **Fungsi Otorisasi Terpusat (`evaluateOrderAuthorization`):**
  1. **Administrator:** Diberikan otorisasi jika request membawa JWT admin valid (`isAdmin === true`).
  2. **Pengguna Terdaftar (`order.user_id != null`):** Wajib login, ID user harus identik dengan `order.user_id`. Pengguna lain ditolak `HTTP 403`.
  3. **Tamu Baru (`order.user_id == null && order.access_token != null`):** Wajib menyertakan token yang cocok via `timingSafeEqualStr`. Jika tidak cocok atau kosong, ditolak `HTTP 403`.
  4. **Tamu Lama / Legacy (`order.user_id == null && order.access_token == null`):** **DITOLAK SECARA DEFAULT (HTTP 403)** dengan pesan informatif untuk mengarahkan pengguna ke verifikasi customer service.

- **Sanitasi Pelacakan Publik (`sanitizeOrderForPublic`):**
  Menghapus `access_token`, `redirect_url`, dan `payment_ref`. Menyamarkan kontak (`081298765432` menjadi `0812****432` atau `us***@domain.com`).

### 2. Refactoring Endpoint Payment Link (`backend/src/routes/payment.routes.js`)
File: [`backend/src/routes/payment.routes.js:136-146`](file:///d:/3d/darstore/backend/src/routes/payment.routes.js#L136-L146)
Menggantikan seluruh percabangan manual `if-else` yang rentan bypass dengan panggilan terpusat:
```javascript
// 2. Verifikasi otorisasi pesanan secara terpusat (DENY BY DEFAULT)
const { evaluateOrderAuthorization } = require('../utils/orderAuth');
const authResult = evaluateOrderAuthorization(order, req);
if (!authResult.authorized) {
  return res.status(authResult.status || 403).json({
    success: false,
    message: authResult.reason
  });
}
```

### 3. Penguatan Endpoint Pelacakan Publik (`backend/src/controllers/order.controller.js`)
File: [`backend/src/controllers/order.controller.js:424-434`](file:///d:/3d/darstore/backend/src/controllers/order.controller.js#L424-L434)
```javascript
if (order) {
  order.simulator_url = isProd ? null : 'https://simulator.sandbox.midtrans.com/qris/index';

  const { evaluateOrderAuthorization, sanitizeOrderForPublic } = require('../utils/orderAuth');
  const authResult = evaluateOrderAuthorization(order, req);
  if (!authResult.authorized) {
    // Pelacakan publik tanpa otorisasi sah: lindungi data pribadi & informasi pembayaran
    order = sanitizeOrderForPublic(order, authResult.isLegacy);
  }
}
```

---

## D. PENANGANAN PESANAN LEGACY (TANPA TOKEN)

Sesuai arahan kebijakan keamanan, sistem memperlakukan transaksi lama (*legacy*) dengan aturan ketat:

1. **Nomor Invoice Bukan Bukti Kepemilikan:**
   Pengetahuan nomor invoice saja (`DSXXXXXXXXXX`) tidak lagi memberikan hak untuk menerbitkan ulang tagihan, mengubah status pesanan, maupun mengakses tautan pembayaran aktif.
2. **Deny by Default:**
   Permintaan ke endpoint pembayaran tanpa token otorisasi langsung ditolak dengan `HTTP 403 Forbidden`:
   > *"Transaksi ini dibuat menggunakan sistem sebelumnya. Untuk menjaga keamanan data dan pembayaran, silakan hubungi customer service dengan menyertakan nomor invoice untuk proses verifikasi."*
3. **Integritas Data Transaksi Terjamin:**
   - Database tidak mengalami mutasi data liar saat terjadi penolakan akses.
   - Status pesanan tidak berubah.
   - Riwayat transaksi tetap utuh dan tersimpan di database.
   - Tidak ada pembuatan token akses baru otomatis berbasis tebakan nomor invoice.
4. **Alur Pemulihan yang Sah (Administrator Only):**
   Pelanggan lama yang memerlukan konfirmasi atau bantuan dapat menghubungi customer service/admin. Administrator resmi dapat membuka detail transaksi melalui dashboard admin (`/api/admin/orders/:id`), memvalidasi bukti pembayaran mutasi bank pemesan, dan melakukan tindakan manual (`completeOrder` / `retryOrder`) secara sah dengan pencatatan audit log lengkap (`admin_logs`).
5. **Dukungan Webhook Tanpa Kendala:**
   Notifikasi webhook resmi dari Midtrans (yang mengandalkan verifikasi tanda tangan kriptografis SHA-512) tetap dapat memperbarui status pesanan lama menjadi `Diproses`/`Berhasil` tanpa dipengaruhi oleh ada atau tidaknya `access_token`.

---

## E. HASIL EKSEKUSI SUITE PENGUJIAN OTOMATIS

Seluruh pengujian dijalankan pada database pengujian lokal SQLite yang terisolasi (`npm --prefix backend test`):

### Ringkasan Pengujian
- **Total Pengujian Dieksekusi:** **48 Skenario**
- **Lulus (Pass):** **48**
- **Gagal (Fail):** **0**
- **Waktu Eksekusi:** **~9.6 detik**

### Rincian Skenario Otorisasi & Legacy Access Control

| Skenario | Judul & Sasaran Pengujian | Hasil Aktual | Status |
| :---: | :--- | :--- | :---: |
| **Skenario 21** | Guest token tidak valid ditolak saat meminta payment-link (`403 Forbidden`). | Menghasilkan status 403 dan pesan penolakan token. | **PASS** |
| **Skenario 22** | Guest token milik invoice B ditolak saat mengakses invoice A (Isolasi Antar Invoice). | Menghasilkan status 403 Forbidden. Token antar invoice terisolasi mutlak. | **PASS** |
| **Skenario 23** *(Diperbarui)* | Invoice lama tanpa token (legacy order) ditolak tanpa otorisasi (`DENY BY DEFAULT 403`). | Menghasilkan status 403, mengembalikan pesan verifikasi CS, tidak membuat payment link. | **PASS** |
| **Skenario 25** | Proteksi kebocoran token akses tamu pada endpoint pelacakan publik (`getOrder`). | Nilai `access_token` bernilai `undefined` pada respon pelacakan publik. | **PASS** |
| **Skenario 41** | Pengguna terdaftar dapat meminta payment-link untuk pesanan miliknya sendiri (JWT Valid). | Menghasilkan status 200 dan tautan pembayaran aktif. | **PASS** |
| **Skenario 42** | Pengguna terdaftar lain ditolak saat mencoba meminta payment-link pesanan orang lain (`403`). | Menghasilkan status 403 Forbidden. Akses lintas akun diblokir. | **PASS** |
| **Skenario 43** | Tamu baru dengan token valid dapat meminta informasi pembayaran (payment-link). | Menghasilkan status 200 dan respon pembayaran sukses. | **PASS** |
| **Skenario 44** | Nomor invoice saja tidak cukup: pelacakan publik menyamarkan kontak dan menghapus rahasia. | Kontak disamarkan (`0812****432`), `redirect_url` dan `access_token` disembunyikan. | **PASS** |
| **Skenario 45** | Administrator yang sah dapat melihat detail pesanan legacy melalui endpoint admin. | Admin dengan JWT valid berhasil melihat detail pesanan dan log pembayaran. | **PASS** |
| **Skenario 46** | Pengguna biasa / token non-admin ditolak saat mengakses endpoint admin (`requireAdmin 403`). | Menghasilkan status 403 `"Fitur ini khusus untuk Administrator"`. | **PASS** |
| **Skenario 47** | Upaya pembuatan tagihan baru pada legacy order ditolak dan tidak mengubah status di DB. | Status di database tetap `Menunggu Pembayaran`, token tetap `null`. | **PASS** |
| **Skenario 48** | Webhook settlement Midtrans tetap dapat memproses pesanan legacy secara sah. | Webhook dengan SHA-512 valid berhasil mengupdate status pesanan legacy ke `Berhasil` & memicu queue. | **PASS** |

---

## F. HASIL PENGUJIAN REGRESI SISTEM PEMBAYARAN

Pemeriksaan menyeluruh dilakukan untuk menjamin tidak ada fitur yang mengalami degradasi atau *breakage*:

| Fitur / Modul | Hasil Pengujian Regresi | Verifikasi Terkait |
| :--- | :--- | :--- |
| **Pembuatan Pesanan Virtual Account** | Berjalan sempurna. Menghitung nominal resmi dari database (`Rp 30.000` + fee `Rp 1.000` = `Rp 31.000`). | [Skenario 33](file:///d:/3d/darstore/backend/tests/security.test.js#L1210) (PASS) |
| **Proteksi Manipulasi Harga** | Nominal manipulasi dari client diabaikan secara total. | [Skenario 2](file:///d:/3d/darstore/backend/tests/security.test.js#L121) (PASS) |
| **Webhook Midtrans Settlement** | Memvalidasi tanda tangan SHA-512, memicu pemenuhan Digiflazz (mock). | [Skenario 6 & 35](file:///d:/3d/darstore/backend/tests/security.test.js#L210) (PASS) |
| **Idempotensi & Replay Webhook** | Webhook settlement berulang tidak menyebabkan top-up ganda. | [Skenario 7 & 37](file:///d:/3d/darstore/backend/tests/security.test.js#L260) (PASS) |
| **Refund Poin Transaksi Kedaluwarsa** | Poin dikembalikan secara atomik dan idempoten ke akun pengguna. | [Skenario 10 & 12](file:///d:/3d/darstore/backend/tests/security.test.js#L380) (PASS) |
| **Konkurensi Poin Loyalitas** | Dua checkout bersamaan tidak pernah menyebabkan saldo poin minus. | [Skenario 20](file:///d:/3d/darstore/backend/tests/security.test.js#L849) (PASS) |
| **QRIS Demonstrasi Antarmuka** | Tetap terisolasi penuh: modal pratinjau tampil, 0 call API Midtrans, 0 mutasi DB, 0 queue. | [Skenario 26-31, 40](file:///d:/3d/darstore/backend/tests/security.test.js#L1025) (PASS) |
| **Vite Frontend Production Build** | Kompilasi bundel production berhasil tanpa peringatan maupun error (521ms). | `npm --prefix frontend run build` (0 Errors) |

---

## G. DAMPAK TERHADAP DOKUMENTASI BAB IV TUGAS AKHIR

Hasil perbaikan ini memberikan materi pengujian keamanan aplikasi yang kokoh dan berstandar industri untuk dituliskan ke dalam **BAB IV (Hasil dan Pembahasan / Pengujian Sistem)**:

1. **Penerapan Prinsip Least Privilege & Deny by Default:**
   Dapat dijelaskan bahwa sistem tidak mengasumsikan keberadaan entitas tanpa token sebagai entitas yang sah. Setiap transaksi tamu diwajibkan memiliki bukti kepemilikan kriptografis (*bearer guest access token* berukuran 48 karakter heksadesimal).
2. **Mitigasi Serangan Insecure Direct Object Reference (IDOR):**
   Dengan adanya isolasi antar pesanan (`evaluateOrderAuthorization`), pengguna yang mengetahui atau melakukan *brute force* enumerasi nomor invoice tidak dapat membajak proses pembayaran, menerbitkan tagihan palsu, maupun mengakses data kontak pribadi pemesan.
3. **Data Privacy & Compliance (Sanitasi Pelacakan Publik):**
   Pada antarmuka pelacakan umum, data sensitif seperti nomor WhatsApp, email, dan URL pembayaran rahasia disamarkan (*masked*), sehingga menjamin kepatuhan terhadap prinsip privasi perlindungan data pribadi konsumen.
4. **Backward Compatibility Tanpa Mengorbankan Keamanan:**
   Transaksi lama dari era sebelum migrasi tidak dihapus dari riwayat transaksi, namun gerbang pembayaran dinonaktifkan secara otomatis dan dialihkan ke mekanisme verifikasi berotoritas tinggi (administrator), membuktikan kematangan perancangan arsitektur sistem.

---

## H. ANALISIS RISIKO & BATASAN YANG TERSISA

1. **Keterbatasan Pelanggan Lama:**
   Pemesan lama yang transaksinya belum selesai (*pending*) dan tidak memiliki `access_token` tidak dapat membayar secara mandiri melalui web tanpa bantuan customer service/admin. Namun, karena transaksi *pending* memiliki batas waktu kedaluwarsa 24 jam, pesanan lama secara alamiah akan kedaluwarsa (*expire*) dan pelanggan disarankan membuat pesanan baru yang otomatis terlindungi token modern.
2. **Kepatuhan Pembatasan Operasional:**
   - Database Supabase Production **tidak disentuh maupun dimutasi** selama proses perbaikan ini.
   - Tidak ada transaksi riil yang ditarik pada Midtrans Production.
   - Tidak ada saldo Digiflazz yang terpotong.
   - Seluruh rahasia dan kunci API tetap berada di environment variables yang aman.
