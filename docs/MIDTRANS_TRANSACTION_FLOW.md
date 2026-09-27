# DOKUMENTASI ALUR TRANSAKSI (TRANSACTION FLOW) — DAR'SSTORE
**Keperluan: Onboarding & Merchant Verification Midtrans Payment Gateway**

---

## 1. Ringkasan Model Bisnis & Transaksi
**Dar'sstore** (https://darstore-pearl.vercel.app/) adalah platform e-commerce produk digital yang melayani pengisian ulang (top-up) diamond dan voucher game daring (seperti Mobile Legends: Bang Bang dan Valorant) secara instan 24/7.

Karena produk yang diperjualbelikan merupakan **produk digital non-fisik (virtual goods)**, sistem Dar'sstore menerapkan model **Instant Direct Checkout**:
- Tidak memerlukan ongkos kirim atau kurir logistik fisik.
- Pemilihan produk, penentuan kuantitas, dan kalkulasi tagihan (Order Summary) terintegrasi secara *real-time* di satu halaman transaksi.
- Pembayaran diproses menggunakan integrasi resmi **Midtrans Payment Gateway (QRIS Core API)**.
- Setelah pembayaran berhasil terverifikasi oleh webhook Midtrans, sistem otomatis mengirimkan item virtual langsung ke akun game pelanggan dan memberikan struk/invoice digital.

---

## 2. Pemetaan File & Komponen Alur Transaksi

| Tahap | Halaman / Route | File Terkait | Keterangan |
| :--- | :--- | :--- | :--- |
| **A. Katalog Produk** | `/` (Home View) | [homepage.js](file:///d:/3d/darstore/frontend/src/views/homepage.js)<br>[index.html](file:///d:/3d/darstore/frontend/index.html#L128-L167) | Menampilkan pilihan game dan banner informasi promo. |
| **B. Pemilihan Item & Qty** | `/ml` & `/valo` | [mlView.js](file:///d:/3d/darstore/frontend/src/views/mlView.js)<br>[valoView.js](file:///d:/3d/darstore/frontend/src/views/valoView.js) | Step 2 (Pilih Nominal) & Step 3 (Qty Counter). Mengupdate ringkasan belanja di sidebar kanan secara otomatis. |
| **C. Form Pembeli & Checkout** | `/ml` & `/valo` | [mlView.js](file:///d:/3d/darstore/frontend/src/views/mlView.js)<br>[paymentAccordion.js](file:///d:/3d/darstore/frontend/src/components/paymentAccordion.js)<br>[order.controller.js](file:///d:/3d/darstore/backend/src/controllers/order.controller.js) | Step 1 (ID Game), Step 4 (Pilihan Pembayaran Midtrans), Step 5 (No. WhatsApp & Email). Tombol "Pesan Sekarang!". |
| **D. Integrasi Midtrans** | Pop-up Modal `#checkout-modal` | [paymentGateway.js](file:///d:/3d/darstore/backend/src/services/paymentGateway.js)<br>[webhook.controller.js](file:///d:/3d/darstore/backend/src/controllers/webhook.controller.js) | Memanggil Midtrans API (`CoreApi.charge` QRIS), menampilkan nomor invoice, kode QRIS, countdown timer 15 menit, dan panduan bayar. |
| **E. Bukti Hasil Pembayaran** | `/cek-transaksi` | [invoiceView.js](file:///d:/3d/darstore/frontend/src/views/invoiceView.js)<br>[order.routes.js](file:///d:/3d/darstore/backend/src/routes/order.routes.js) | Lacak status transaksi pelanggan (*Menunggu Pembayaran*, *Diproses*, *Berhasil*, atau *Gagal*). |

---

## 3. Urutan Bukti Screenshot untuk Onboarding Midtrans

File screenshot resmi telah disimpan dalam format beresolusi tinggi di folder:
`docs/midtrans-flow-screenshots/`

### Step 1: Halaman Katalog Produk
- **File:** `01_katalog_produk.png`
- **Deskripsi:** Menampilkan halaman depan katalog website Dar'sstore dengan pilihan game populer (Mobile Legends & Valorant) serta navigasi utama.

### Step 2: Halaman Pemilihan Produk & Kupon/Qty
- **File:** `02_pilih_item_nominal.png`
- **Deskripsi:** Pengguna memasukkan ID akun game, memilih nominal diamond (misal: 12 Diamonds), dan ringkasan pesanan (*Order Summary*) di sisi kanan otomatis menghitung harga satuan dan total belanja.

### Step 3: Form Data Kontak & Pilihan Metode Pembayaran
- **File:** `03_form_pembeli_dan_ringkasan.png`
- **Deskripsi:** Pengguna memilih metode pembayaran **QRIS Midtrans** pada accordion metode pembayaran, memasukkan nomor WhatsApp/Email untuk pengiriman struk, dan memeriksa rincian tagihan akhir (Subtotal + Biaya Layanan).

### Step 4: Tagihan Pembayaran Midtrans QRIS Muncul
- **File:** `04_modal_pembayaran_midtrans_qris.png`
- **Deskripsi:** Setelah tombol "Pesan Sekarang!" diklik, sistem memanggil Midtrans dan memunculkan pop-up tagihan resmi berisi Nomor Invoice (`DS...`), rincian pesanan, total tagihan yang sesuai, batas waktu pembayaran 15 menit, dan kode QRIS terstandarisasi.

### Step 5: Halaman Hasil / Pelacakan Transaksi (Status Pending)
- **File:** `05_status_transaksi_pending.png`
- **Deskripsi:** Halaman Cek Transaksi (`/cek-transaksi`) yang memperlihatkan nomor invoice pelanggan berstatus `Menunggu Pembayaran` sebelum transaksi diselesaikan di e-wallet/m-banking.

### Step 6: Status Pembayaran Berhasil (Payment Success)
- **File:** `06_status_transaksi_berhasil.png`
- **Deskripsi:** Setelah pembayaran diverifikasi oleh notifikasi webhook Midtrans, status transaksi otomatis berubah menjadi `Berhasil` (hijau), item virtual dikirimkan, dan struk digital lengkap ditampilkan kepada pelanggan.

---

## 4. Konfigurasi Sandbox & Keamanan
- Kredensial yang digunakan pada tahap pengujian ini adalah kredensial **Sandbox Midtrans**:
  - `MIDTRANS_SERVER_KEY`: `SB-Mid-server-ji-E3p5XvwgclN3KR8HnAuQO`
  - `MIDTRANS_CLIENT_KEY`: `SB-Mid-client-BB-HmVEYrvOj1HLc`
  - `MIDTRANS_IS_PRODUCTION`: `false`
- Webhook signature di backend diverifikasi menggunakan algoritma **SHA-512** sesuai standar keamanan Midtrans:
  $$\text{Signature} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$
- Mekanisme **Idempotency** diterapkan untuk memastikan setiap pesanan hanya diproses satu kali meskipun notifikasi webhook diterima berulang kali.
