# DOKUMEN REVISI: VERIFIKASI KESELARASAN URL BISNIS & ALUR TRANSAKSI (TRANSACTION FLOW)
**Merchant: Dar'sstore**  
**Keperluan: Pemenuhan Koreksi Aktivasi Metode Pembayaran (BSI VA, GoPay QRIS, Bank Transfer, GoPay eMoney)**  
**Target Pengajuan: Midtrans Merchant Verification / Risk & Compliance Team**  

---

## 1. Lembar Pernyataan Keselarasan URL Bisnis (URL Alignment Declaration)

Dokumen ini disusun sebagai lampiran **Dokumen Tambahan (Business Supporting Document)** untuk memenuhi permintaan koreksi (*Need Correction*) verifikasi merchant Midtrans. Kami menyatakan dan membuktikan bahwa **URL Website Bisnis yang terdaftar pada Dashboard Midtrans telah 100% IDENTIK dan SELARAS dengan URL Operasional Website serta Dokumen Alur Transaksi**.

### Tabel Verifikasi Parameter URL Bisnis

| Parameter Verifikasi | Data di Dashboard Midtrans | Data di Website Operasional | Status Keselarasan |
| :--- | :--- | :--- | :---: |
| **Nama Merchant / Brand** | Dar'sstore | Dar'sstore | **IDENTIK / COCOK** |
| **URL Website Utama** | `https://darstore-pearl.vercel.app/` | `https://darstore-pearl.vercel.app/` | **IDENTIK / COCOK** |
| **Protokol Keamanan** | HTTPS (SSL Certificate Active) | HTTPS (SSL Certificate Active) | **IDENTIK / COCOK** |
| **Kategori Bisnis** | Digital Goods / Game Top-up Voucher | Digital Goods / Game Top-up Voucher | **IDENTIK / COCOK** |
| **Status Aksesibilitas** | Aktif & Dapat Diakses Publik (24/7) | Aktif & Dapat Diakses Publik (24/7) | **LIVE / VERIFIED** |

> **Catatan untuk Merchant:**  
> Jika URL di dashboard Midtrans Anda saat ini menggunakan domain lain (misal: `https://darsstore.vercel.app/` atau domain kustom Anda), pastikan URL pada tabel di atas dan di seluruh dokumen ini disesuaikan agar persis sama dengan yang ada di dashboard Midtrans.

---

## 2. Bukti Tangkapan Layar: Dashboard Midtrans (Business Profile)

Berikut adalah bukti bahwa URL Website pada pengaturan profil bisnis Midtrans telah terisi dan sesuai dengan URL yang diajukan:

```
+-----------------------------------------------------------------------------------+
|  MIDTRANS MERCHANT DASHBOARD -> SETTINGS -> BUSINESS INFO                         |
+-----------------------------------------------------------------------------------+
|  Business Name    : Dar'sstore                                                    |
|  Business Type    : Individual / Perorangan                                       |
|  Website URL      : https://darstore-pearl.vercel.app/     <--- [TERVERIFIKASI]   |
|  Contact Email    : support@darsstore.com                                         |
|  WhatsApp CS      : +62 812-3456-7890                                             |
+-----------------------------------------------------------------------------------+
```

*(Lampirkan tangkapan layar / screenshot langsung dari dashboard Midtrans menu **Settings > Business Info** pada area ini sebelum dikonversi ke PDF).*

---

## 3. Profil Bisnis & Layanan Pelanggan (Consumer Protection)

Sesuai regulasi Bank Indonesia dan standar kepatuhan mitra Midtrans (BSI, GoPay, dan Bank Transfer Partner), website Dar'sstore telah memenuhi standar transparansi konsumen:

1. **Katalog Produk & Transparansi Harga**: Seluruh nominal diamond game (Mobile Legends, Valorant) memiliki harga satuan yang tercantum jelas tanpa biaya tersembunyi.
2. **Kanal Bantuan Pelanggan (CS 24 Jam)**:
   - **WhatsApp Resmi:** `+62 812-3456-7890` (Tombol melayang / Floating Button aktif 24 jam)
   - **Email Dukungan:** `support@darsstore.com`
3. **Mekanisme Pengiriman Cepat (Instant Delivery)**: Produk berupa item virtual (in-game diamonds/points) dikirimkan langsung ke ID Game pengguna dalam waktu 1-3 detik setelah webhook pembayaran Midtrans terverifikasi.
4. **Kebijakan Transaksi**: Halaman pelacakan pesanan (*Cek Transaksi*) dapat diakses secara publik kapan saja oleh pelanggan menggunakan nomor invoice resmi (`DS...`).

---

## 4. Alur Integrasi 4 Metode Pembayaran yang Diajukan

| Metode Pembayaran | Implementasi Teknis di Dar'sstore | Perilaku Pengguna (User Flow) |
| :--- | :--- | :--- |
| **1. GoPay QRIS** | Midtrans Core API `payment_type: 'qris'`, acquirer `gopay`. | Pelanggan memindai Dynamic QR Code resmi Midtrans menggunakan GoPay atau aplikasi e-wallet/perbankan apa pun. |
| **2. GoPay eMoney** | Integrasi pembayaran digital e-wallet langsung. | Pelanggan diarahkan untuk konfirmasi bayar langsung menggunakan saldo GoPay. |
| **3. BSI Virtual Account** | Midtrans Bank Transfer VA (`bank: 'bsi'`). | Sistem menampilkan nomor Virtual Account BSI unik 16 digit beserta instruksi m-Banking BSI / BSI Mobile. |
| **4. Bank Transfer (Multibank)** | Midtrans Virtual Account (BCA, Mandiri, BNI, BRI, Permata). | Sistem menghasilkan nomor VA dinamis dengan batas kedaluwarsa 15 menit. |

---

## 5. Dokumentasi Visual Alur Transaksi Langkah-demi-Langkah (Step-by-Step Flow)

Setiap tahapan di bawah ini dijalankan langsung pada URL live website: **`https://darstore-pearl.vercel.app/`**

### Langkah 1: Akses Katalog & Beranda Website
- **URL Halaman:** `https://darstore-pearl.vercel.app/`
- **Tampilan:** Pengunjung melihat katalog game yang tersedia (Mobile Legends & Valorant), banner informasi, dan fitur navigasi.
- **Tangkapan Layar:**
  *(Sertakan tangkapan layar `01_katalog_produk.png` dengan URL bar browser terlihat)*

---

### Langkah 2: Pemilihan Produk & Pengisian Data Akun Pengguna
- **URL Halaman:** `https://darstore-pearl.vercel.app/ml`
- **Tampilan:**
  1. Pengguna memasukkan User ID dan Zone ID akun game.
  2. Pengguna memilih nominal produk (contoh: 12 Diamonds / 50 Diamonds).
  3. Ringkasan belanja (*Order Summary*) otomatis menghitung total harga di kolom samping.
- **Tangkapan Layar:**
  *(Sertakan tangkapan layar `02_pilih_item_nominal.png`)*

---

### Langkah 3: Pemilihan Metode Pembayaran & Data Kontak
- **URL Halaman:** `https://darstore-pearl.vercel.app/ml`
- **Tampilan:**
  1. Pengguna memilih salah satu metode pembayaran yang didukung Midtrans (**QRIS / GoPay / Transfer Bank**).
  2. Pengguna memasukkan nomor WhatsApp / Email untuk bukti struk digital.
  3. Pengguna meninjau rincian akhir pesanan dan menekan tombol **"Pesan Sekarang!"**.
- **Tangkapan Layar:**
  *(Sertakan tangkapan layar `03_form_pembeli_dan_ringkasan.png`)*

---

### Langkah 4: Tampilan Tagihan & Invoice Resmi Midtrans
- **URL / Modal:** `https://darstore-pearl.vercel.app/ml` (Pop-up Modal Pembayaran `#checkout-modal`)
- **Tampilan:**
  1. Sistem backend memanggil API Midtrans (`CoreApi.charge`).
  2. Tampil nomor Invoice resmi Dar'sstore (contoh: `DS20261005...`).
  3. Muncul kode QRIS / nomor Virtual Account resmi dari Midtrans beserta penghitung waktu mundur (*countdown timer* 15 menit).
- **Tangkapan Layar:**
  *(Sertakan tangkapan layar `04_modal_pembayaran_midtrans_qris.png`)*

---

### Langkah 5: Pelacakan Status Transaksi Pelanggan (Menunggu Pembayaran)
- **URL Halaman:** `https://darstore-pearl.vercel.app/cek-transaksi`
- **Tampilan:**
  - Pelanggan dapat memeriksa status transaksi secara mandiri.
  - Saat pembayaran belum diselesaikan di aplikasi bank/e-wallet, status transaksi berstatus kuning: **"Menunggu Pembayaran"**.
- **Tangkapan Layar:**
  *(Sertakan tangkapan layar `05_status_transaksi_pending.png`)*

---

### Langkah 6: Verifikasi Notifikasi Webhook & Transaksi Berhasil
- **URL Halaman:** `https://darstore-pearl.vercel.app/cek-transaksi`
- **Tampilan:**
  - Setelah pelanggan berhasil membayar, Midtrans mengirimkan notifikasi webhook terenkripsi SHA-512 ke endpoint server Dar'sstore.
  - Sistem otomatis mengubah status menjadi hijau: **"Berhasil" (Settlement)**.
  - Item diamond game otomatis terkirim dan struk pelunasan lengkap ditampilkan.
- **Tangkapan Layar:**
  *(Sertakan tangkapan layar `06_status_transaksi_berhasil.png`)*

---

## 6. Pernyataan & Validasi Merchant

Dengan dokumen ini, kami menegaskan kembali komitmen operasional Dar'sstore dalam menjaga keamanan, integritas sistem, serta kepatuhan penuh terhadap seluruh ketentuan operasional Midtrans Payment Gateway dan Bank Indonesia.

- **Nama Merchant / Usaha:** Dar'sstore
- **Domain Resmi:** `https://darstore-pearl.vercel.app/`
- **Status Integrasi:** Siap Beroperasi (Ready for Production Activation)
- **Tanggal Dokumen:** 5 Oktober 2026
