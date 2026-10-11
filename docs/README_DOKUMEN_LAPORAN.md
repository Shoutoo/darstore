# 📑 PANDUAN DAN DAFTAR DOKUMEN LAPORAN SISTEM DAR'SSTORE

Dokumen-dokumen markdown berikut telah dibuat secara terpisah dan terperinci untuk memenuhi kebutuhan laporan perancangan serta implementasi sistem sesuai dengan materi pada masing-masing gambar:

---

## 📂 Pemetaan File Markdown Berdasarkan Gambar

### 1. [01_PERANCANGAN_UML_DIAGRAM.md](file:///d:/3d/darstore/docs/01_PERANCANGAN_UML_DIAGRAM.md)
*Mencakup Gambar 3 (Bab 3: Perancangan UML)*
- **A. Use Case Diagram:**
  - Penjelasan baku sesuai arahan gambar: *"Use Case Diagram menggambarkan interaksi antara pengguna dan admin dengan sistem website top-up game online. Pengguna dapat melihat katalog game, memilih produk, melakukan checkout, melakukan pembayaran QRIS, dan melihat status transaksi. Admin dapat mengelola data produk serta transaksi."*
  - Visualisasi diagram use case interaktif (Mermaid & PlantUML).
- **B. Activity Diagram:**
  1. *Activity Pengguna Melakukan Top-Up*
  2. *Activity Proses Pembayaran QRIS*
  3. *Activity Admin Mengelola Transaksi*
- **C. Sequence Diagram:**
  - Alur proses utama: **Pengguna $\rightarrow$ Website $\rightarrow$ Backend $\rightarrow$ Midtrans $\rightarrow$ QRIS $\rightarrow$ Status Pembayaran $\rightarrow$ Sistem**

---

### 2. [02_PERANCANGAN_DATABASE_DAN_ANTARMUKA.md](file:///d:/3d/darstore/docs/02_PERANCANGAN_DATABASE_DAN_ANTARMUKA.md)
*Mencakup Gambar 1 (Bab 3: Database & Figma)*
- **D. Perancangan Database:**
  - Visualisasi **Entity Relationship Diagram (ERD)** lengkap.
  - Tabel-tabel relasional **PostgreSQL** (`users`/admin, `products`/katalog game, `orders`/transaksi, `payment_logs`, `point_history`, dan `store_settings`).
  - Kamus data, tipe data, *primary key*, *foreign key*, dan batasan (*constraints*).
  - Skrip DDL PostgreSQL siap dieksekusi.
- **E. Perancangan Antarmuka (Figma / Wireframe):**
  - Rincian rancangan untuk 7 modul antarmuka:
    1. Halaman Beranda (Home)
    2. Katalog Game
    3. Detail Produk (Pilihan Denominasi)
    4. Checkout (Form Identitas Akun & Ringkasan Belanja)
    5. Pembayaran QRIS (Modal Tagihan QRIS)
    6. Status Transaksi (Halaman Invoice & Tracking)
    7. Dashboard Admin (Analitik, Order, & Kelola Produk)

---

### 3. [03_IMPLEMENTASI_DAN_DOKUMENTASI_SCREENSHOT.md](file:///d:/3d/darstore/docs/03_IMPLEMENTASI_DAN_DOKUMENTASI_SCREENSHOT.md)
*Mencakup Gambar 2 (Bab 4: Implementasi & Pengujian Sistem)*
- **Matriks Tangkapan Layar & Kode Sumber:**
  - **a. Frontend (Gambar 4.8):** Tampilan website + Kode HTML/CSS/JS (`index.html`, `style.css`, `main.js`).
  - **b. Backend (Gambar 4.9):** Struktur folder backend + Kode Express.js (`server.js`, routing order).
  - **c. Database (Gambar 4.10):** PostgreSQL + Tabel-tabel database (`products`, `orders`, `users`).
  - **d. Midtrans (Gambar 4.11):** Tampilan modal QRIS + Kode integrasi Midtrans Core API (`paymentGateway.js`).
  - **e. API (Gambar 4.12):** Pengujian Postman + endpoint (`POST /api/orders`, `GET /api/orders`, Webhook) + hasil respon JSON status 200/201.
