# LAPORAN IMPLEMENTASI FINAL SISTEM PEMBAYARAN DAR'SSTORE
## Konfigurasi Midtrans Production Virtual Account & QRIS Demonstrasi (BAB IV Tugas Akhir)

**Tanggal:** 23 Oktober 2026  
**Penyusun:** Senior Full-Stack Developer & Security Engineer  
**Proyek:** Website Top-Up Game Online Dar'sstore  
**Status Audit & Pengujian:** **100% SUKSES (40/40 SKENARIO LULUS)**

---

## DAFTAR ISI
1. [A. Ringkasan Eksekutif & Arsitektur Pembayaran](#a-ringkasan-eksekutif--arsitektur-pembayaran)
2. [B. Detail Implementasi Virtual Account Midtrans Production](#b-detail-implementasi-virtual-account-midtrans-production)
3. [C. Detail Implementasi QRIS Demonstrasi (Tugas Akhir / BAB IV)](#c-detail-implementasi-qris-demonstrasi-tugas-akhir--bab-iv)
4. [D. Matriks Keamanan & Hardenings yang Tetap Berlaku](#d-matriks-keamanan--hardenings-yang-tetap-berlaku)
5. [E. Hasil Eksekusi Suite Pengujian Otomatis (40 Skenario)](#e-hasil-eksekusi-suite-pengujian-otomatis-40-skenario)
6. [F. Panduan Operasional & Skenario Demonstrasi Sidang](#f-panduan-operasional--skenario-demonstrasi-sidang)
7. [G. Status Kesiapan Deploy & Checklist Produksi](#g-status-kesiapan-deploy--checklist-produksi)
8. [H. Kesimpulan & Penegasan Batasan](#h-kesimpulan--penegasan-batasan)

---

## A. RINGKASAN EKSEKUTIF & ARSITEKTUR PEMBAYARAN

### 1. Latar Belakang & Rasionalitas Desain
Pada ekosistem payment gateway **Midtrans Production**, channel **Core API QRIS** memerlukan verifikasi dokumen dan aktivasi merchant tersendiri yang membutuhkan waktu. Sementara itu, channel **Virtual Account (Bank Transfer)** telah aktif dan siap digunakan secara penuh untuk transaksi produksi langsung (*live transaction*).

Untuk kebutuhan operasional nyata sekaligus pemenuhan demonstrasi antarmuka pada pengujian skripsi/Tugas Akhir (**BAB IV Dokumentasi Sistem**), arsitektur pembayaran Dar'sstore distrukturkan menjadi dua pilar:

| Metode Pembayaran | Status di Production | Peran & Perilaku Sistem |
| :--- | :--- | :--- |
| **Virtual Account (VA)** | **Tersedia (Aktif Penuh)** | **Satu-satunya metode pembayaran nyata.** Menghasilkan nomor VA resmi dari Midtrans (BNI, BRI, Mandiri, CIMB, Permata), menerima webhook `settlement`, dan memicu top-up produk Digiflazz secara otomatis. |
| **QRIS Demonstrasi** | **Belum Aktif (Pratinjau Antarmuka)** | **Demonstrasi visual UI & kebutuhan akademis.** Tidak memicu transaksi keuangan, tidak memanggil API Midtrans, tidak membuat baris invoice di database, dan tidak memicu antrean Digiflazz. Dilengkapi watermark diagonal: `"DEMO — TIDAK UNTUK PEMBAYARAN"` dan tombol pengalih ke Virtual Account. |

### 2. Diagram Arsitektur Alur Transaksi

```
                    ┌─────────────────────────┐
                    │    Pengguna Dar'sstore   │
                    └────────────┬────────────┘
                                 │
                 Pilih Metode Pembayaran di Checkout
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
   [ Opsi QRIS Demo ]                          [ Opsi Virtual Account ]
           │                                           │
  Klik: Modal Pratinjau Terbuka               Pilih Bank (BNI/BRI/Mandiri/dsb)
  - Watermark Demo Jelas                      Kirim Request Checkout
  - Tombol 'Bayar' Diblokir                            │
  - Nol Panggilan Gateway API                          ▼
  - Opsi: "👉 Gunakan Virtual Account" ──────> ┌───────────────────────────┐
                                               │ Backend Order Controller  │
                                               │ - Otoritas Harga Server   │
                                               │ - Guard: Tolak Demo (400) │
                                               └─────────────┬─────────────┘
                                                             │
                                               ┌─────────────┴─────────────┐
                                               ▼                           ▼
                                      [ Database Supabase ]       [ Midtrans Core VA ]
                                      Status: Menunggu Bayar      Generate No VA Resmi
                                               │                           │
                                               └─────────────┬─────────────┘
                                                             ▼
                                                Nomor VA & Countdown 24 Jam
                                                Tampil di Modal & Invoice
                                                             │
                                                Pelanggan Bayar via ATM/M-Banking
                                                             │
                                                             ▼
                                                Midtrans Webhook (SHA-512)
                                                             │
                                                             ▼
                                                Fulfillment Digiflazz & SN
```

---

## B. DETAIL IMPLEMENTASI VIRTUAL ACCOUNT MIDTRANS PRODUCTION

### 1. Bank-Bank yang Didukung
Sistem mendukung 5 bank Virtual Account utama melalui integrasi Midtrans Core API:
- **BNI Virtual Account** (`bni_va` / `bank: 'bni'`) — Format prefix gateway: `8808...`
- **BRI Virtual Account** (`bri_va` / `bank: 'bri'`) — Format prefix gateway: `12800...`
- **Mandiri Bill Payment** (`echannel` / `bank: 'mandiri'`) — Biller Code resmi: `70012` + Bill Key unik
- **CIMB Niaga Virtual Account** (`cimb_va` / `bank: 'cimb'`)
- **Permata Virtual Account** (`permata_va` / `bank: 'permata'`)

### 2. Implementasi Backend (`createVaTransaction`)
File: [`backend/src/services/paymentGateway.js`](file:///d:/3d/darstore/backend/src/services/paymentGateway.js)
```javascript
async createVaTransaction(order, customer = {}) {
  // Guard ketat: menolak metode demo
  if (channel.includes('demo') || (method.includes('qris') && !channel.includes('va'))) {
    throw new Error('Metode pembayaran QRIS hanya tersedia sebagai demonstrasi...');
  }
  
  // Normalisasi bank
  const bank = resolveBank(channel);
  
  // Produksi: Charge Midtrans Core API (Bank Transfer)
  if (isProductionEnv() && !mockMode) {
    const parameter = {
      payment_type: bank === 'mandiri' ? 'echannel' : 'bank_transfer',
      transaction_details: {
        order_id: order.invoice_number,
        gross_amount: Math.round(Number(order.total_harga))
      },
      ...
    };
    return await coreApi.charge(parameter);
  }
}
```

### 3. Kontrak Respons Controller (`order.controller.js`)
File: [`backend/src/controllers/order.controller.js`](file:///d:/3d/darstore/backend/src/controllers/order.controller.js)
Ketika pesanan berhasil dibuat (`HTTP 201 Created`):
```json
{
  "success": true,
  "message": "Pesanan berhasil dibuat. Silakan lakukan pembayaran ke Virtual Account.",
  "invoiceNumber": "DS20261023XXXX",
  "accessToken": "48-char-hex-guest-token",
  "paymentMethod": "Virtual Account",
  "paymentChannel": "bni_va",
  "bank": "BNI",
  "vaNumber": "88081234567890",
  "expiredAt": "2026-10-24T02:00:00.000Z",
  "totalHarga": 31000,
  "payment_data": {
    "bank": "bni",
    "va_number": "88081234567890",
    "expired_at": "2026-10-24T02:00:00.000Z"
  }
}
```

### 4. Penanganan Countdown Expiry 24 Jam
- Waktu kedaluwarsa ditetapkan `24 jam` sejak pembuatan pesanan (`new Date(Date.now() + 24 * 60 * 60 * 1000)`).
- Modal checkout dan halaman invoice menampilkan hitung mundur dinamis (*live countdown timer*) serta tombol satu-klik "Salin Nomor VA".
- Jika waktu habis sebelum pembayaran diselesaikan, status pesanan otomatis dialihkan ke `Gagal` (atau `expire` via webhook Midtrans) dan poin loyalitas pengguna di-*refund* secara atomik.

---

## C. DETAIL IMPLEMENTASI QRIS DEMONSTRASI (TUGAS AKHIR / BAB IV)

### 1. Komponen Antarmuka QRIS Demo
- **Badge Kategori:** Ditandai dengan badge merah eksplisit `[Belum Aktif]`.
- **Card Metode:** Menggunakan class CSS `.card-demo-method` dengan styling border bergaris putus-putus (*dashed border*) dan chip label `DEMO`.
- **Subteks Status:** Menampilkan keterangan `Pratinjau (Belum Aktif)` menggantikan nominal biaya admin.

### 2. Modal Dialog Demonstrasi (`#qris-demo-modal`)
File: [`frontend/index.html`](file:///d:/3d/darstore/frontend/index.html) & [`frontend/public/assets/payments/qris_demo_watermark.svg`](file:///d:/3d/darstore/frontend/public/assets/payments/qris_demo_watermark.svg)
- Menampilkan ilustrasi QRIS dengan **watermark diagonal permanen**:
  > `"DEMO — TIDAK UNTUK PEMBAYARAN"`
- Header modal memuat peringatan:
  > `"Fitur pembayaran QRIS sedang dalam tahap aktivasi. Kode QR yang ditampilkan merupakan demonstrasi dan tidak dapat digunakan untuk melakukan pembayaran. Silakan gunakan Virtual Account untuk menyelesaikan transaksi."`
- Tombol Utama:
  > `[👉 Gunakan Virtual Account (Tersedia)]` — Seketika menutup dialog demo, memfokuskan kursor ke pilihan Virtual Account aktif, dan memperbarui ringkasan total.

### 3. Isolasi Keamanan Backend (Zero Side-Effects)
Backend menerapkan *defense-in-depth* di baris awal `createOrder`:
```javascript
const methodLower = String(payment_method || '').toLowerCase();
const channelLower = String(req.body.payment_channel || '').toLowerCase();

if (methodLower.includes('demo') || channelLower.includes('demo') || (methodLower.includes('qris') && !channelLower.includes('va'))) {
  return res.status(400).json({
    success: false,
    message: 'Metode pembayaran QRIS sedang dalam tahap aktivasi dan hanya tersedia sebagai demonstrasi antarmuka. Silakan gunakan Virtual Account untuk menyelesaikan transaksi.'
  });
}
```
**Garansi Sistem:**
1. **0 Pemanggilan Midtrans API:** Tidak ada charge ID atau token yang dibuat.
2. **0 Baris di Database:** Tabel `orders` dan `payment_logs` tidak mengalami penambahan record.
3. **0 Mutasi Saldo Poin:** Poin loyalitas pengguna tidak akan berkurang.
4. **0 Pemanggilan Provider:** Antrean Digiflazz tidak pernah menerima tugas (*zero balance deduction*).

---

## D. MATRIKS KEAMANAN & HARDENINGS YANG TETAP BERLAKU

Seluruh 12 pilar *security hardening* yang dibangun sebelumnya tetap aktif tanpa regresi:

| No | Fitur Keamanan | Mekanisme & Bukti Pengujian | Status |
| :---: | :--- | :--- | :---: |
| 1 | **Server-Side Price Authority** | Harga murni dihitung dari DB (`product.harga * qty + fee - diskon`). Payload `total_harga` dari client diabaikan sepenuhnya. | **AKTIF** |
| 2 | **SHA-512 Webhook Verification** | `crypto.createHash('sha512').update(order_id + status_code + gross_amount + server_key)`. Signature palsu ditolak HTTP 403. | **AKTIF** |
| 3 | **Gross Amount Matching** | Webhook memeriksa kecocokan `receivedAmount === expectedAmount`. Mismatch ditolak HTTP 400 dan dicatat ke audit log. | **AKTIF** |
| 4 | **Webhook Idempotency & Replay Shield** | Notifikasi ganda berstatus `settlement` dijaga status check & database transaction. Hanya 1 eksekusi top-up. | **AKTIF** |
| 5 | **Race Condition Protection** | Penanganan status pesanan konkuren menggunakan atomic update. | **AKTIF** |
| 6 | **Guest Access Token Isolation** | Guest order dilindungi 48-char random hex token. Tanpa token valid, akses ditolak HTTP 403. | **AKTIF** |
| 7 | **Public Tracking Sanitization** | Endpoint publik `getOrder` menyaring dan menyembunyikan `access_token` dari respon. | **AKTIF** |
| 8 | **Anti-Loss Loyalty Cap** | Pemotongan poin dibatasi maksimal 20% dari modal pokok transaksi (`MAX_DISCOUNT_PERCENT = 0.20`). | **AKTIF** |
| 9 | **Loyalty Concurrency Guard** | Pemotongan poin diverifikasi secara atomik (`WHERE id = ? AND points >= ?`) untuk mencegah saldo minus. | **AKTIF** |
| 10 | **Atomic Loyalty Refund on Expire** | Jika transaksi kedaluwarsa atau dibatalkan, poin dikembalikan tepat 1 kali via flag `points_refunded`. | **AKTIF** |
| 11 | **Provider Timeout Safeguard** | Timeout provider ditandai status `pending`, tidak melakukan auto-retry membabi buta. | **AKTIF** |
| 12 | **Strict Production Safeguard** | Simulasi pembayaran via endpoint sandbox diblokir mutlak pada environment production (`HTTP 404`). | **AKTIF** |

---

## E. HASIL EKSEKUSI SUITE PENGUJIAN OTOMATIS (40 SKENARIO)

Pengujian dijalankan pada runtime Node.js test harness resmi (`node --test tests/security.test.js`):

```
> backend@1.0.0 test
> node --test tests/security.test.js

Connected to SQLite test database...
✔ Skenario 1: Simulasi pembayaran ditolak pada production (mengembalikan 404 & tidak mengubah status) (90ms)
✔ Skenario 2: Nominal yang dimanipulasi frontend diabaikan (menggunakan total_harga dari database) (114ms)
✔ Skenario 3: Pembayaran dengan invoice tidak valid ditolak (404 Not Found) (2ms)
✔ Skenario 4: Pembayaran dengan nominal berbeda (gross amount mismatch) ditolak & tidak lunas (12ms)
✔ Skenario 5: Signature webhook yang salah ditolak (403 Forbidden) (6ms)
✔ Skenario 6: Webhook valid diproses dengan benar (status berubah ke Diproses/Berhasil) (228ms)
✔ Skenario 7: Webhook identik yang dikirim berulang (replay) bersifat idempoten & tidak top-up ganda (290ms)
✔ Skenario 8: Webhook bersamaan (concurrent race condition) terlindungi secara atomik (246ms)
✔ Skenario 9: Pembayaran pending tidak memicu pemenuhan produk (122ms)
✔ Skenario 10: Pembayaran kedaluwarsa (expire) ditangani dengan benar (Gagal & refund poin) (56ms)
✔ Skenario 11: Poin loyalitas tidak diberikan dua kali (idempotent loyalty awarding) (194ms)
✔ Skenario 12: Pengembalian poin (refund) tidak dilakukan dua kali (62ms)
✔ Skenario 13: Timeout Digiflazz ditandai pending & tidak menyebabkan retry berbahaya (2ms)
✔ Skenario 14: Fallback ke Snap hanya dijalankan jika QRIS belum aktif, bukan untuk semua error (7ms)
✔ Skenario 15: Sistem tidak menggunakan sandbox secara diam-diam ketika production aktif (1ms)
✔ Skenario 16: Webhook settlement datang setelah expire ditolak & status Gagal tidak tertimpa (22ms)
✔ Skenario 17: Webhook expire datang setelah pesanan Berhasil diabaikan & poin tidak di-refund (13ms)
✔ Skenario 18: Dua worker mencoba memproses invoice yang sama di queue (hanya 1 eksekusi provider) (20ms)
✔ Skenario 19: Pesanan terhenti saat status Diproses dapat dipulihkan via retryOrder admin (122ms)
✔ Skenario 20: Penggunaan poin bersamaan pada dua checkout tidak menyebabkan saldo minus (101ms)
✔ Skenario 21: Guest token tidak valid ditolak saat meminta payment-link (403 Forbidden) (12ms)
✔ Skenario 22: Guest token milik invoice lain ditolak (isolasi antar invoice tamu) (20ms)
✔ Skenario 23: Invoice lama tanpa token (legacy order) tetap dapat diakses dengan aman (15ms)
✔ Skenario 24: Migrasi / initDatabase dijalankan berulang kali bersifat idempoten & aman (144ms)
✔ Skenario 25: Proteksi kebocoran token akses tamu pada endpoint pelacakan publik (getOrder) (211ms)
✔ Skenario 26: Tampil dialog QRIS demo ketika opsi diklik (UI Contract & Modal Check) (1ms)
✔ Skenario 27: Watermark / label demo terverifikasi pada asset SVG dan modal dialog (1ms)
✔ Skenario 28: QRIS demo tidak memanggil Midtrans API (Spy verifikasi) (1ms)
✔ Skenario 29: QRIS demo tidak membuat invoice di database backend (2ms)
✔ Skenario 30: QRIS demo tidak mengubah saldo poin pengguna atau memutasi tabel lain (12ms)
✔ Skenario 31: QRIS demo tidak memicu antrian pemenuhan produk / Digiflazz queue (1ms)
✔ Skenario 32: Tombol Gunakan Virtual Account berfungsi (Frontend contract check) (1ms)
✔ Skenario 33: Pembuatan pesanan VA valid menghitung nominal dari database & mengembalikan detail VA (23ms)
✔ Skenario 34: Pesanan VA berstatus pending tidak memicu top-up Digiflazz (16ms)
✔ Skenario 35: Webhook settlement VA valid berhasil memicu fulfillment (185ms)
✔ Skenario 36: Webhook settlement VA dengan signature salah ditolak (HTTP 403) (16ms)
✔ Skenario 37: Webhook settlement VA duplikat (replay) bersifat idempoten (289ms)
✔ Skenario 38: Nomor VA berasal dari respon gateway backend, bukan manipulasi payload client (22ms)
✔ Skenario 39: Metode pembayaran VA tercatat dengan benar di tabel orders (22ms)
✔ Skenario 40: Integritas sistem: tidak ada jalan bagi order QRIS Demo untuk berstatus paid/success (1ms)

--------------------------------------------------------------------------------
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 9701.5363
```

---

## F. PANDUAN OPERASIONAL & SKENARIO DEMONSTRASI SIDANG

### Skenario 1: Demonstrasi Antarmuka QRIS (Untuk BAB IV Tugas Akhir)
1. **Langkah:** Buka halaman top-up Mobile Legends atau Valorant.
2. **Aksi:** Pada accordion pembayaran, klik opsi **"QRIS (Semua E-Wallet)"**.
3. **Hasil yang Diamati:**
   - Dialog pratinjau (`#qris-demo-modal`) muncul ke layar.
   - Terlihat watermark merah diagonal: **`DEMO — TIDAK UNTUK PEMBAYARAN`**.
   - Badge status: **`STATUS: BELUM AKTIF DI PRODUCTION`**.
   - Tombol checkout tidak aktif/tidak terpilih.
   - Pilihan metode checkout tetap aman dan terproteksi.
4. **Poin Penjelasan untuk Dosen Penguji:**
   > *"Fitur antarmuka QRIS diimplementasikan secara utuh sebagai pembuktian integrasi UI dan arsitektur responsif. Namun demi menjaga integritas keuangan dan karena proses aktivasi QRIS di Midtrans memerlukan persetujuan merchant terpisah, sistem menerapkan isolasi penuh sehingga kode QR ini berstatus demo dan pengguna diarahkan ke Virtual Account."*

### Skenario 2: Pembayaran Nyata via Virtual Account (Simulasi Pengujian)
1. **Langkah:** Klik tombol **"👉 Gunakan Virtual Account"** di dialog demo atau pilih langsung bank (misal: BNI / BRI / Mandiri).
2. **Aksi:** Lengkapi nomor WhatsApp dan klik tombol **"Beli Sekarang"**.
3. **Hasil yang Diamati:**
   - Muncul modal transaksi yang menampilkan nomor Virtual Account resmi (misal prefix `8808...`), batas waktu pembayaran 24 jam, dan panduan transfer ATM/M-Banking.
   - Pelanggan diarahkan ke invoice pelacakan dengan status `Menunggu Pembayaran`.
4. **Penyelesaian Transaksi:**
   - Di lingkungan Sandbox/Testing, penguji dapat membuka [Midtrans Payment Simulator](https://simulator.sandbox.midtrans.com) lalu memasukkan nomor VA untuk menyimulasikan pembayaran `settlement`.
   - Webhook menerima callback, memvalidasi signature SHA-512, dan mengubah status pesanan menjadi `Berhasil` secara *real-time*.

### Skenario 3: Verifikasi Keamanan Manipulasi Nominal
1. **Langkah:** Buka DevTools Network, tangkap request `POST /api/orders`, lalu ubah nilai `total_harga` menjadi `100`.
2. **Hasil yang Diamati:**
   - Backend menghitung harga resmi dari database (`Rp 30.000` + fee VA `Rp 1.000` = `Rp 31.000`).
   - Nominal yang tertera pada Virtual Account Midtrans tetap `Rp 31.000`. Manipulasi nominal dari client digagalkan total.

---

## G. STATUS KESIAPAN DEPLOY & CHECKLIST PRODUKSI

| Item Pemeriksaan | File / Komponen Terkait | Status Kesiapan |
| :--- | :--- | :---: |
| **Vite Production Bundle** | `frontend/dist/` (39.37 kB HTML, 173.31 kB JS) | **SIAP (Build Bersih 469ms)** |
| **Pemisahan Kategori Pembayaran** | `frontend/src/data/payments.js` & `paymentAccordion.js` | **TERVERIFIKASI** |
| **Aset Watermark Demo** | `frontend/public/assets/payments/qris_demo_watermark.svg` | **TERSEDIA** |
| **Pembersihan Tombol Sandbox** | `frontend/index.html` & `frontend/src/views/invoiceView.js` | **BERSIH** |
| **Handler VA Gateway** | `backend/src/services/paymentGateway.js` (`createVaTransaction`) | **TERVERIFIKASI** |
| **Guard Penolakan Demo** | `backend/src/controllers/order.controller.js` (HTTP 400 guard) | **TERVERIFIKASI** |
| **Automated Test Suite** | `backend/tests/security.test.js` (40 Test Scenarios) | **100% PASS** |
| **Supabase DDL Integrity** | 5 Kolom orders (`access_token`, `points_awarded`, dsb.) | **TERAPLIKASI** |

---

## H. KESIMPULAN & PENEGASAN BATASAN

1. **Integritas Keuangan:**
   - Tidak ada saldo riil yang terpotong pada Digiflazz selama pengujian berlangsung.
   - Tidak ada pemotongan biaya atau transaksi nyata yang ditarik pada Midtrans.
2. **Keamanan Kredensial:**
   - Seluruh kunci rahasia (`MIDTRANS_SERVER_KEY`, `DIGIFLAZZ_KEY`, dsb.) tetap tersimpan di dalam environment variable lokal dan tidak pernah dibocorkan atau dicetak ke log publik.
3. **Kepatuhan Akademis:**
   - Antarmuka QRIS memenuhi seluruh kriteria visual Tugas Akhir tanpa membuka kerentanan celah transaksi tak valid.
   - Sistem pembayaran Virtual Account siap digunakan untuk menerima transaksi nyata pada saat rilis ke pengguna publik.
