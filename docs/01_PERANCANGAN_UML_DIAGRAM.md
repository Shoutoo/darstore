# BAGIAN A, B, & C: PERANCANGAN SISTEM (UML DIAGRAM)
**Sistem E-Commerce Top-Up Game Online — Dar'sstore**

---

## A. Use Case Diagram

### 1. Visualisasi Use Case Diagram
Berikut adalah representasi visual diagram use case untuk sistem website top-up game online Dar'sstore:

```
[ TEMPATKAN GAMBAR USE CASE DIAGRAM DI SINI ]
Contoh: ![Gambar 3.1 Use Case Diagram Sistem Dar'sstore](file:///d:/3d/darstore/docs/midtrans-flow-screenshots/use_case_diagram.png)
```

```mermaid
flowchart LR
    classDef actorStyle fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef ucStyle fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef extStyle fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc,stroke-dasharray: 4 4;

    subgraph SystemBoundary ["🖥️ Sistem Website Top-Up Game (Dar'sstore)"]
        UC01(["Melihat Katalog Game"]):::ucStyle
        UC02(["Memilih Produk & Nominal"]):::ucStyle
        UC03(["Melakukan Checkout"]):::ucStyle
        UC04(["Melakukan Pembayaran QRIS"]):::ucStyle
        UC05(["Melihat Status Transaksi"]):::ucStyle
        UC06(["Tukar Poin Diskon Loyalitas"]):::extStyle
        UC07(["Validasi ID Akun Game"]):::ucStyle
        UC08(["Verifikasi Webhook Pembayaran"]):::ucStyle
        UC09(["Mengelola Data Produk"]):::ucStyle
        UC10(["Mengelola Data Transaksi"]):::ucStyle
        UC11(["Mengelola Data Pengguna & Poin"]):::ucStyle
        UC12(["Melihat Dashboard Laporan"]):::ucStyle

        %% Relasi Include & Extend
        UC03 -.->|<<include>>| UC02
        UC03 -.->|<<include>>| UC07
        UC03 -.->|<<include>>| UC04
        UC06 -.->|<<extend>>| UC03
        UC08 -.->|mengupdate status| UC05
    end

    %% Aktor
    User["👤 Pengguna / Pelanggan"]:::actorStyle
    Admin["👨‍💼 Administrator"]:::actorStyle
    Midtrans["💳 Gateway Pembayaran (Midtrans)"]:::actorStyle

    %% Asosiasi Pengguna
    User --- UC01
    User --- UC02
    User --- UC03
    User --- UC04
    User --- UC05
    User --- UC06

    %% Asosiasi Admin
    Admin --- UC09
    Admin --- UC10
    Admin --- UC11
    Admin --- UC12

    %% Asosiasi Sistem Eksternal
    UC04 --- Midtrans
    Midtrans --- UC08
```

---

### 2. Penjelasan Use Case Diagram
> **Penjelasan Resmi:**  
> Use Case Diagram menggambarkan interaksi antara pengguna dan admin dengan sistem website top-up game online. Pengguna dapat melihat katalog game, memilih produk, melakukan checkout, melakukan pembayaran QRIS, dan melihat status transaksi. Admin dapat mengelola data produk serta transaksi.

Secara lebih terperinci, hak akses dan peran masing-masing entitas didefinisikan sebagai berikut:

1. **Aktor Pengguna (Customer / Member):**
   - **Melihat Katalog Game:** Pengguna dapat menelusuri daftar game yang didukung oleh sistem (seperti *Mobile Legends: Bang Bang* dan *Valorant*).
   - **Memilih Produk:** Pengguna dapat menentukan denominasi/item (seperti nominal Diamond atau Valorant Points) sesuai kebutuhan.
   - **Melakukan Checkout:** Pengguna memasukkan User ID / Zone ID akun game, nomor WhatsApp atau email kontak, memilih metode bayar, serta meninjau rincian ringkasan pembelian (*Order Summary*).
   - **Melakukan Pembayaran QRIS:** Pengguna menerima tagihan pembayaran terstandarisasi Quick Response Code Indonesian Standard (QRIS) yang diproses melalui gateway Midtrans dan melakukan pemindaian melalui aplikasi perbankan digital/e-wallet.
   - **Melihat Status Transaksi:** Pengguna dapat mengecek invoice pembelian untuk mengetahui status pesanan secara *real-time* (*Menunggu Pembayaran*, *Diproses*, *Berhasil*, atau *Gagal*).
   - **Tukar Poin Diskon (Ekstensi):** Bagi pengguna yang terdaftar (*member*), sistem menyediakan opsi opsional untuk menukarkan poin loyalitas menjadi potongan harga langsung saat checkout.

2. **Aktor Administrator:**
   - **Mengelola Data Produk:** Admin memiliki hak penuh untuk menambah item baru, mengubah harga jual, mengunggah ikon, serta mengaktifkan/menonaktifkan ketersediaan produk.
   - **Mengelola Data Transaksi:** Admin dapat mengawasi arus pesanan masuk, memeriksa nomor invoice pelanggan, melakukan *retry* pengiriman manual jika terjadi gangguan provider, serta mengubah status transaksi.
   - **Mengelola Pengguna & Laporan:** Admin dapat melihat profil member, audit log aksi, serta statistik grafik penjualan toko.

3. **Aktor Pendukung (Midtrans Payment Gateway):**
   - Berfungsi sebagai pihak ketiga yang menerbitkan *string* QRIS, menetapkan batas waktu kedaluwarsa (15 menit), serta mengirimkan *callback HTTP webhook* terenkripsi untuk mengonfirmasi bahwa dana telah berhasil diterima (*settlement*).

---

## B. Activity Diagram

Activity Diagram memodelkan aliran kerja (*workflow*) logis dan sekuensial yang terjadi di dalam sistem dari satu aktivitas ke aktivitas lainnya.

---

### 1. Activity Diagram: Pengguna Melakukan Top-Up
Diagram ini menggambarkan alur kerja pengguna dari saat pertama kali membuka website hingga berhasil membuat pesanan top-up game.

```mermaid
flowchart TD
    Start([Mulai]) --> OpenWeb[Buka Halaman Utama / Katalog Game]
    OpenWeb --> SelectGame[Pilih Game: Mobile Legends / Valorant]
    SelectGame --> InputID[Masukkan Identitas Game: User ID & Zone ID / Riot ID]
    InputID --> SelectNominal[Pilih Denominasi Item / Nominal Produk]
    SelectNominal --> CheckMember{Apakah Pengguna Login?}
    
    CheckMember -- Ya --> UsePoints{Gunakan Poin Diskon?}
    UsePoints -- Ya --> ApplyDiscount[Kalkulasi Potongan Harga Poin]
    UsePoints -- Tidak --> InputContact[Lanjut ke Kontak Pembeli]
    ApplyDiscount --> InputContact
    
    CheckMember -- Tidak --> InputContact[Masukkan Nomor WhatsApp / Email]
    InputContact --> SelectPayment[Pilih Metode Pembayaran: QRIS Midtrans]
    SelectPayment --> ClickCheckout[Klik Tombol 'Pesan Sekarang' / Checkout]
    
    ClickCheckout --> ValidateForm{Validasi Data Input?}
    ValidateForm -- Data Kosong / Tidak Valid --> ShowError[Tampilkan Pesan Error di Form]
    ShowError --> InputID
    
    ValidateForm -- Valid --> CreateOrder[Backend Membuat Invoice Pesanan]
    CreateOrder --> GenerateQRIS[Sistem Meminta Kode QRIS ke Midtrans]
    GenerateQRIS --> ShowModal[Tampilkan Modal Tagihan QRIS & Hitung Mundur 15 Menit]
    ShowModal --> Finish([Selesai])
```

#### Deskripsi Alur Aktivitas 1:
1. Pengguna membuka antarmuka website Dar'sstore dan memilih game yang ingin diisi ulang.
2. Pengguna menginput nomor identitas akun game (*User ID* dan *Zone ID* untuk MLBB, atau *Riot ID* untuk Valorant).
3. Pengguna memilih denominasi nominal produk (misal: 12 Diamonds).
4. Jika pengguna berstatus *member*, terdapat pilihan opsi penukaran poin loyalitas untuk memperoleh diskon.
5. Pengguna memasukkan nomor WhatsApp / email kontak penerima notifikasi, kemudian memilih opsi pembayaran QRIS.
6. Sistem memvalidasi kelengkapan form. Jika valid, sistem memproses pesanan ke backend dan menampilkan modal tagihan QRIS ke layar pengguna.

---

### 2. Activity Diagram: Proses Pembayaran QRIS
Diagram ini memodelkan proses pembayaran interaktif antara Pengguna, E-Wallet/M-Banking, Midtrans Payment Gateway, dan Server Backend Dar'sstore.

```mermaid
flowchart TD
    Start([Mulai]) --> ViewQR[Pengguna Menampilkan QRIS pada Modal Checkout]
    ViewQR --> OpenApp[Pengguna Membuka Aplikasi M-Banking / E-Wallet]
    OpenApp --> ScanQR[Scan Kode QRIS & Verifikasi Jumlah Nominal]
    ScanQR --> InputPIN[Masukkan PIN Transaksi Pembayaran]
    
    InputPIN --> ProcessBank{Transaksi Berhasil Diproses Bank?}
    ProcessBank -- Gagal / Saldo Tidak Cukup --> ShowBankFail[Aplikasi Bank Menampilkan Notifikasi Gagal]
    ShowBankFail --> ExpireCheck{Apakah Waktu 15 Menit Habis?}
    ExpireCheck -- Ya --> StatusExpired[Order Berubah Status: Expired / Kedaluwarsa]
    StatusExpired --> FinishFail([Selesai - Transaksi Batal])
    
    ExpireCheck -- Tidak --> ViewQR
    
    ProcessBank -- Berhasil --> MidtransSettle[Midtrans Mendeteksi Dana Masuk 'settlement']
    MidtransSettle --> SendWebhook[Midtrans Mengirim Notifikasi Webhook POST ke Server]
    
    SendWebhook --> VerifySig{Verifikasi Signature SHA-512 Server?}
    VerifySig -- Tidak Valid --> RejectWebhook[Tolak Request Webhook 403 Forbidden]
    RejectWebhook --> FinishFail
    
    VerifySig -- Valid --> UpdateDB[Update Status Order Menjadi 'Berhasil / Paid']
    UpdateDB --> AddPoints[Tambahkan Poin Loyalitas ke Akun Pembeli]
    AddPoints --> TriggerInject[Sistem Memicu Pengiriman Otomatis Diamond ke Akun Game]
    TriggerInject --> UpdateUI[Halaman Invoice Pengguna Berubah Hijau: 'Berhasil']
    UpdateUI --> FinishSuccess([Selesai - Top Up Sukses])
```

#### Deskripsi Alur Aktivitas 2:
1. Setelah kode QRIS ditampilkan pada modal checkout, pengguna membuka aplikasi M-Banking atau e-wallet (BCA Mobile, GoPay, OVO, Dana, Livin', dll.).
2. Pengguna memindai kode QRIS dan mengonfirmasi pembayaran dengan memasukkan PIN keamanan.
3. Midtrans menerima konfirmasi dana dari jaringan interkoneksi perbankan (status `settlement`).
4. Midtrans secara asinkron mengirimkan HTTP POST *webhook* ke `/api/webhook/payment` milik Dar'sstore.
5. Backend Dar'sstore memverifikasi integritas *signature key* dengan rumus SHA-512.
6. Jika *signature* cocok, status pesanan di database diperbarui dari `Menunggu Pembayaran` menjadi `Berhasil`, poin pengguna ditambahkan, dan proses injeksi item game diselesaikan.

---

### 3. Activity Diagram: Admin Mengelola Transaksi
Diagram ini memodelkan hak operasional administrator dalam mengawasi, memperbarui, dan menindaklanjuti seluruh transaksi penjualan.

```mermaid
flowchart TD
    Start([Mulai]) --> LoginAdmin[Admin Mengakses Halaman Login /admin.html]
    LoginAdmin --> SubmitAuth[Memasukkan Email & Password Admin]
    SubmitAuth --> CheckAuth{Kredensial Valid & Role Admin?}
    CheckAuth -- Tidak --> ShowAuthErr[Tampilkan Peringatan Akses Ditolak]
    ShowAuthErr --> LoginAdmin
    
    CheckAuth -- Ya --> AccessDashboard[Buka Dashboard Administrasi]
    AccessDashboard --> OpenOrderTab[Pilih Menu 'Manajemen Transaksi / Orders']
    OpenOrderTab --> FetchOrders[Sistem Memuat Daftar Seluruh Pesanan dari Database]
    
    FetchOrders --> FilterAction{Tindakan yang Dipilih Admin?}
    
    FilterAction -- Cari / Filter Status --> SearchInvoice[Cari Nomor Invoice / Filter Status: Pending, Success, Failed]
    SearchInvoice --> DisplayList[Tampilkan Hasil Penyaringan Tabel]
    
    FilterAction -- Cek Detail Transaksi --> ViewDetail[Klik Tombol Detail: Periksa Data Game ID, Payment Ref, & Waktu]
    ViewDetail --> DisplayList
    
    FilterAction -- Perbarui Status Manual --> EditStatus[Pilih Status Baru: Selesai / Gagal / Pending]
    EditStatus --> ConfirmUpdate{Konfirmasi Perubahan?}
    ConfirmUpdate -- Ya --> SaveDB[Simpan Perubahan ke Database & Catat Admin Audit Log]
    ConfirmUpdate -- Tidak --> DisplayList
    SaveDB --> ShowSuccessToast[Tampilkan Notifikasi Perubahan Berhasil Disimpan]
    ShowSuccessToast --> DisplayList
    
    FilterAction -- Unduh Laporan --> ExportCSV[Klik 'Export CSV Laporan Penjualan']
    ExportCSV --> GenerateFile[Sistem Men-generate Berkas Laporan Penjualan Toko]
    GenerateFile --> DownloadFile[Download File Rekapitulasi Transaksi]
    
    DisplayList --> LogoutCheck{Keluar dari Sesi?}
    DownloadFile --> LogoutCheck
    LogoutCheck -- Tidak --> FilterAction
    LogoutCheck -- Ya --> LogoutSystem[Hapus Token JWT & Sesi Keluar]
    LogoutSystem --> End([Selesai])
```

#### Deskripsi Alur Aktivitas 3:
1. Administrator masuk melalui gerbang `/admin.html` dengan memasukkan kredensial otentikasi.
2. Setelah divalidasi, admin diarahkan ke panel navigasi manajemen pesanan.
3. Admin dapat mencari transaksi berdasarkan nomor invoice (misal: `DS...`), menyaring status transaksi, atau meninjau detail log webhook dari gateway pembayaran.
4. Apabila terjadi kendala teknis (seperti jaringan provider *down*), admin dapat mengubah status secara manual atau menjalankan proses *retry*. Setiap aksi administratif akan dicatat ke dalam tabel `admin_logs`.
5. Admin dapat mengunduh seluruh data transaksi dalam format file CSV untuk keperluan pembukuan keuangan.

---

## C. Sequence Diagram

Sequence Diagram memodelkan pertukaran pesan antar objek/komponen sistem secara kronologis berdasarkan waktu.

### Alur Proses Utama:
$$\text{Pengguna} \longrightarrow \text{Website (Frontend)} \longrightarrow \text{Backend API} \longrightarrow \text{Midtrans Gateway} \longrightarrow \text{QRIS} \longrightarrow \text{Status Pembayaran} \longrightarrow \text{Sistem}$$

```mermaid
sequenceDiagram
    autonumber
    actor Pengguna as 👤 Pengguna
    participant Web as 🖥️ Website (Frontend)
    participant Back as ⚙️ Backend (Express.js)
    participant DB as 🗄️ Database (PostgreSQL)
    participant Midtrans as 💳 Midtrans Gateway
    participant QRIS as 📱 Layanan QRIS

    %% 1. Inisiasi Pesanan
    Pengguna->>Web: 1. Pilih Game, Nominal & Input ID Game
    Pengguna->>Web: 2. Pilih Pembayaran QRIS & Klik 'Pesan Sekarang'
    
    %% 2. Komunikasi ke Backend
    Web->>Back: 3. POST /api/orders (Data Form Checkout)
    activate Back
    Back->>DB: 4. Validasi Produk & Simpan Order (Status: 'Menunggu Pembayaran')
    DB-->>Back: 5. Order Tersimpan (Invoice: DS-xxx)
    
    %% 3. Integrasi ke Midtrans
    Back->>Midtrans: 6. CoreApi.charge({ payment_type: 'qris', gross_amount, order_id })
    activate Midtrans
    Midtrans->>QRIS: 7. Registrasi & Generate Standar Kode QRIS
    QRIS-->>Midtrans: 8. Kembalikan qr_string & qr_url
    Midtrans-->>Back: 9. Respon Berhasil (transaction_id, qr_string, expiry_time)
    deactivate Midtrans
    
    %% 4. Tampilkan QRIS ke Pengguna
    Back->>DB: 10. Update Order (payment_ref, qris_string, expired_at)
    Back-->>Web: 11. JSON Response (invoice_number, qris_url, total_harga)
    deactivate Back
    Web-->>Pengguna: 12. Tampilkan Modal Tagihan QRIS & Hitung Mundur 15 Menit

    %% 5. Pembayaran oleh Pengguna
    Note over Pengguna,QRIS: Pengguna Memindai QRIS via E-Wallet / M-Banking & Masukkan PIN
    Pengguna->>QRIS: 13. Konfirmasi & Bayar Tagihan
    QRIS-->>Midtrans: 14. Notifikasi Dana Masuk Diterima

    %% 6. Webhook Notifikasi Pembayaran
    Midtrans->>Back: 15. POST /api/webhook/payment (Payload JSON + SHA-512 Signature)
    activate Back
    Back->>Back: 16. Validasi Signature SHA-512 (order_id + status + server_key)
    
    alt Signature Valid & Status Settlement
        Back->>DB: 17. Update Status Order -> 'Berhasil' & Catat payment_logs
        Back->>DB: 18. Tambahkan Poin Loyalitas Akun Pengguna
        Back-->>Midtrans: 19. HTTP 200 OK (Webhook Berhasil Diterima)
        
        %% 7. Pembaruan Status ke Pengguna
        Web->>Back: 20. Polling / Cek Status: GET /api/orders?invoice=DS-xxx
        Back-->>Web: 21. Respon Status: 'Berhasil'
        Web-->>Pengguna: 22. Tampilan Berubah Menjadi Invoice Sukses (Hijau) & Item Game Masuk
    else Pembayaran Kedaluwarsa / Gagal
        Back->>DB: Update Status Order -> 'Gagal / Expired'
        Back-->>Midtrans: HTTP 200 OK
        Web-->>Pengguna: Tampilan Modal Menjadi 'Waktu Pembayaran Habis'
    end
    deactivate Back
```

---

### Penjelasan Rinci Tahapan Sequence Diagram:
1. **Pengguna $\rightarrow$ Website:** Pengguna memilih game, nominal item, memasukkan ID akun game, serta memilih opsi metode pembayaran QRIS.
2. **Website $\rightarrow$ Backend:** Frontend mengirimkan *payload* pesanan melalui *endpoint* `POST /api/orders`.
3. **Backend $\rightarrow$ Database:** Backend memvalidasi ketersediaan produk, mengkalkulasi diskon (bila ada), dan mencatat baris transaksi baru dengan status `Menunggu Pembayaran`.
4. **Backend $\rightarrow$ Midtrans:** Backend memanggil Midtrans Core API `coreApi.charge()` dengan spesifikasi parameter `payment_type: 'qris'`.
5. **Midtrans $\rightarrow$ QRIS $\rightarrow$ Backend:** Midtrans meregistrasikan transaksi ke jaringan QRIS nasional dan mengembalikan data `qr_string`, URL gambar QR, serta batas waktu 15 menit.
6. **Backend $\rightarrow$ Website $\rightarrow$ Pengguna:** Website menampilkan *pop-up modal* berisikan kode QRIS yang siap dipindai oleh pelanggan.
7. **Pengguna $\rightarrow$ QRIS:** Pengguna menyelesaikan pembayaran melalui aplikasi e-wallet (GoPay, OVO, Dana) atau mobile banking.
8. **Midtrans $\rightarrow$ Backend (Webhook):** Midtrans mengirimkan notifikasi *callback* HTTP POST ke backend Dar'sstore.
9. **Backend Verifikasi & Update:** Backend memverifikasi tanda tangan kriptografi SHA-512 untuk mencegah manipulasi data, lalu mengubah status transaksi di database menjadi `Berhasil`.
10. **Website $\rightarrow$ Pengguna:** Halaman antarmuka mendeteksi perubahan status transaksi secara otomatis dan menampilkan bukti pelunasan digital berwarna hijau beserta konfirmasi bahwa pesanan telah berhasil dikirim ke akun game.
