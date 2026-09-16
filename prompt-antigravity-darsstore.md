# PROMPT UNTUK ANTIGRAVITY — Pengembangan Backend "Dar'sstore"

## KONTEKS PROYEK

Saya punya proyek **Vite** (vanilla JS, tanpa framework React/Vue) untuk
website top up game bernama **Dar'sstore**. UI/layout-nya **sudah final dan
sudah bagus** — jangan diubah sama sekali. Saat ini semuanya masih murni
frontend: data produk hardcode di `data.js`, transaksi disimpan di
`localStorage` (bukan database asli), dan QR pembayaran cuma gambar dummy.
Tugasmu: bangun backend & database asli, sederhanakan konten sesuai daftar di
bawah, dan ganti warna — **tanpa mengubah struktur HTML/CSS/layout**.

### Struktur folder saat ini

```
darstore/
├── dist/
├── node_modules/
├── public/
├── src/
│   ├── data.js       ← semua data statis (game, nominal, payment, dst)
│   ├── main.js        ← semua logic render + event handler
│   └── style.css      ← styling, termasuk variabel warna
├── index.html
├── package.json        ← project "ourastore", Vite ^6.2.0, vanilla JS (type: module)
├── vite.config.js
└── (svg/aset lainnya, jangan diubah)
```

> **ATURAN UTAMA — UI/LAYOUT TIDAK BOLEH DIUBAH.**
> Perubahan yang diizinkan HANYA: (1) nilai warna di CSS variables, (2)
> penghapusan/penyederhanaan konten sesuai daftar di bawah, (3) penambahan
> backend/logic yang murni fungsional (tidak mengubah tampilan), (4) logo
> sederhana/placeholder sementara.

---

## 1. Penyesuaian Warna (Gold → Biru `#006199`)

Sudah saya telusuri isi `style.css` (2095 baris). Semua warna gold ternyata
terpusat rapi di beberapa CSS custom properties di dalam `:root` (baris 8–47),
dan variabel ini dipanggil ulang baik dari CSS maupun langsung dari string
HTML yang di-generate `main.js` (misal `color: var(--accent-gold)` muncul
puluhan kali). **Jangan ganti nama variabelnya** — cukup ganti NILAI HEX-nya
saja di `:root`, supaya seluruh pemanggilan di CSS maupun `main.js` otomatis
ikut berubah tanpa perlu menyentuh file lain.

### Variabel warna gold → ganti nilainya (baris 8–47 di `style.css`)

| Variabel | Nilai lama | Ganti jadi (biru) |
|---|---|---|
| `--accent-gold` | `#a58c6f` | `#006199` |
| `--accent-gold-hover` | `#ba9e7d` | `#1483bf` |
| `--accent-gold-light` | `#fff1be` | `#6fd1ff` |
| `--accent-gold-glow` | `rgba(165, 140, 111, 0.35)` | `rgba(0, 97, 153, 0.35)` |
| `--border-focus` | `#a58c6f` | `#006199` |
| `--shadow-glow` | `... rgba(165, 140, 111, 0.25)` | `... rgba(0, 97, 153, 0.25)` |

> Catatan: `--badge-green`, `--badge-yellow`, `--badge-red` adalah warna
> status (sukses/pending/gagal) yang tidak terkait gold — **jangan diubah**.

### Background gelap ("hitam" di pondasi) → geser jadi navy senada biru

Warna dasar dark-mode saat ini abu-abu netral, bukan hitam pekat murni, tapi
tetap perlu digeser sedikit ke arah navy supaya senada dengan `#006199`:

| Variabel | Nilai lama | Ganti jadi (navy) |
|---|---|---|
| `--bg-primary` | `#262727` | `#16212c` |
| `--bg-secondary` | `#212121` | `#121a22` |
| `--bg-card` | `#313438` | `#1e2a36` |
| `--bg-card-subtle` | `#2b2e32` | `#18232d` |
| `--bg-card-hover` | `#383c41` | `#263440` |
| `--bg-input` | `#373b3f` | `#1c2830` |
| `--bg-input-focus` | `#3d4247` | `#23323d` |
| `--border-subtle` | `#3c4045` | `#26333d` |
| `--border-card` | `#43474d` | `#304250` |

(Nilai-nilai di atas adalah saran awal yang proporsional dengan tingkat
kegelapan aslinya — boleh disesuaikan sedikit asal tetap dalam keluarga navy
yang sama.)

### Hex hardcode (bukan variabel) — ada 2 kasus berbeda, tangani beda cara

Beberapa tempat di `style.css` menulis hex langsung, bukan lewat variabel:
`#1a1a1a`, `#17181a`, `#373b3f`, `#292b2e`. Ini dipakai untuk **dua tujuan
berbeda**, jadi jangan di-replace pukul rata:

1. **Sebagai warna teks di atas tombol/badge gold** (contoh: baris 364, 638,
   850, 966 — pola `background: var(--accent-gold); color: #1a1a1a;` atau
   `#17181a`). Karena gold lama itu warna terang (tan/krem) sehingga cocok
   dengan teks gelap, sedangkan biru `#006199` itu **lebih gelap**, teks
   gelap di atasnya jadi tidak terbaca. **Ganti teks ini jadi putih
   (`#ffffff`)**, bukan navy.
2. **Sebagai warna background panel** (contoh: baris 695, 740, 934 — dipakai
   untuk gradient/panel gelap seperti modal checkout, chat bubble). Ganti ke
   navy yang senada, misal `#1c2830` (samakan dengan `--bg-input` baru) untuk
   `#373b3f`, dan `#0f171d` untuk `#292b2e`/`#17181a`/`#1a1a1a` versi
   background gelap.

Cara paling aman: telusuri tiap kemunculan hex tadi satu per satu di
`style.css`, lihat apakah dia dipasangkan dengan `background: var(--accent-gold)`
di rule yang sama (berarti kasus #1 → teks putih) atau berdiri sendiri sebagai
`background-color`/`background: linear-gradient(...)` (berarti kasus #2 →
navy gelap).

### Setelah warna diganti

- Pastikan kontras teks tetap memenuhi standar keterbacaan (WCAG AA)
- Cek tema terang (`[data-theme="light"]`, baris 50–64) — variabel gold TIDAK
  didefinisikan ulang di sana, jadi otomatis ikut memakai nilai biru baru
  dari `:root`, tidak perlu diubah manual

---

## 2. Penyederhanaan Konten (berdasarkan struktur `data.js` & `main.js` saat ini)

### A. Hapus total fitur berikut

| Fitur | Lokasi di kode |
|---|---|
| Leaderboard | `LEADERBOARD_DATA` (data.js), `renderLeaderboard()`, `createLeaderboardRowHTML()`, elemen `#leaderboard-view`, nav link ke `#leaderboard` |
| Artikel/Berita | `NEWS_ARTICLES` (data.js), bagian render news grid di `renderHomepage()`, handler `nav-artikel`, `#section-news` |
| Kalkulator Win Rate | Modal `calc-modal`, handler `btn-calculate-wr`, fungsi perhitungan win rate, handler `nav-kalkulator`, hash route `#kalkulator` |
| Kode Promo | `PROMOS` (data.js), fungsi `applyPromo()`, input & tombol promo di ML/Valo (`ml-btn-apply-promo`, `valo-btn-apply-promo`), modal `promos-modal`, tombol `ml-btn-available-promos` / `valo-btn-available-promos` |
| Bagian "Butuh bantuan?" | Cari teks literal "Butuh bantuan" di HTML dan hapus blok tersebut |

### B. Ganti sistem "Hubungi Kami" & CS Chat

Saat ini ada simulasi chat CS palsu (`cs-chat-modal`, fungsi `sendMsg()` di
`setupModals()`) yang membalas otomatis dengan `setTimeout`. **Hapus simulasi
chat ini.** Ganti dengan tombol langsung:
- Tombol/link **WhatsApp** (`wa.me/...`)
- Tombol/link **Email** (`mailto:...`)

Tanpa formulir kontak, tanpa live chat palsu. Terapkan ini juga di halaman
"Hubungi Kami" dan di tombol CS mengambang (`floating-cs-btn`).

### C. Sederhanakan daftar game

`GAMES` di `data.js` saat ini berisi 15 game (MLBB, Magic Chess, PUBG, Free
Fire, Valorant, Blood Strike, CODM, Delta Force x2, Honor of Kings, Point
Blank, Joki x2, Roblox). **Potong array ini hingga hanya tersisa 2 entri: MLBB
dan Valorant.** Konsekuensinya:
- `CATEGORIES` tidak lagi relevan (isinya kategori seperti "Joki MLBB", "Pulsa
  & Data", dst) — hapus rendering tab kategori (`renderHomepage()` bagian
  `category-tabs-container`) karena hanya ada 1 kategori nyata sekarang
- `renderGamesGrid()` disederhanakan: tidak perlu filter kategori lagi,
  langsung render 2 game tadi
- Search bar (`global-search-input`) tetap boleh jalan, tapi otomatis cuma
  akan mencari di antara 2 game itu

### D. Mobile Legends — top up diamond langsung, tanpa bundling

`ML_NOMINALS` di `data.js` saat ini punya 5 kategori: `special` (Weekly
Diamond Pass), `first_topup` (double diamond promo), `weekly_monthly`,
`promo`, dan `topup_diamonds`. Sesuai instruksi **"Diamond ML langsung top up,
tanpa bundling"**:
- Hapus kategori `special`, `first_topup`, `weekly_monthly`, `promo`
- Sisakan HANYA `topup_diamonds` sebagai satu grid nominal diamond polos
- Sederhanakan `renderMLView()` supaya tidak lagi me-render banyak judul
  kategori (`🎁 Special Item`, dst) — cukup satu grid nominal diamond

### E. Valorant — region Indonesia saja, paket disamakan, tanpa jumlah pembelian

`VALO_REGIONS` di `data.js` saat ini punya 5 region (id, my, th, sg, ph).
- Potong jadi hanya `{ id: 'id', name: 'Region Indonesia' }`
- Hapus rendering tab region di `renderValoView()` (`valo-region-tabs`) karena
  hanya ada 1 pilihan
- `VALO_NOMINALS` disederhanakan jadi hanya array `id` (hapus `my`, `th`,
  `sg`, `ph`)
- **"Paket disamakan"**: samakan struktur/format card nominal Valorant dengan
  card nominal ML (pola nama & harga tampil konsisten satu gaya)
- **Hapus quantity selector Valorant**: hilangkan elemen `valo-qty-minus`,
  `valo-qty-plus`, `valo-qty-input`, dan bagian terkait di `setupCounters()`.
  Set `qty` Valorant selalu `1` secara tetap di `appState.valo.qty` dan di
  `handleCheckout('valo')`

### F. Payment — hanya QRIS

`PAYMENT_GROUPS` di `data.js` saat ini punya 4 grup: `oura_coin`,
`qris_ewallet`, `virtual_account`, `convenience_store`.
- **Sisakan hanya grup `qris_ewallet`** (QRIS + e-wallet: GoPay, DANA, OVO,
  ShopeePay, LinkAja — atau sederhanakan lagi jadi satu opsi "QRIS" polos
  jika mau benar-benar minimal)
- Hapus grup `oura_coin`, `virtual_account`, `convenience_store`
- `renderPaymentAccordion()` tetap bisa dipakai apa adanya karena sudah
  generic (loop dari `PAYMENT_GROUPS`), tidak perlu diubah strukturnya,
  cukup datanya yang dipangkas

### G. Footer disamakan

Pastikan footer/bagian bawah pada halaman Home, ML, dan Valorant memakai
markup & komponen yang identik: kontak (email + WhatsApp), tanpa bagian
legalitas.

### H. Nama toko

Ganti semua string "OURASTORE"/"Oura Store" di `data.js` dan `main.js`
(termasuk di `alert()`, judul modal auth, FAQ, dsb) menjadi **Dar'sstore**.

### I. Logo

Gunakan logo sederhana/placeholder dulu (teks "Dar'sstore" dengan font yang
sudah ada, atau ikon polos) — logo final akan saya buat menyusul sendiri.

---

## 3. Fitur Autentikasi (Login & Daftar) — Ganti dari Palsu ke Asli

Saat ini `auth-modal` di `main.js` (`btnLogin`, `btnRegister`, `authSubmit`)
hanya menampilkan `alert()` tanpa validasi atau backend sungguhan. Ganti
dengan sistem auth asli:

- `POST /api/auth/register` — buat akun baru (email/whatsapp + password)
- `POST /api/auth/login` — login, kembalikan token (JWT) yang disimpan di
  `localStorage`
- Tetap tampilkan modal yang sama (UI tidak berubah), hanya logic di baliknya
  yang terhubung ke API asli
- **Top up tetap bisa dilakukan tanpa login** (guest checkout tidak boleh
  diblokir)
- Jika user login (ada token valid) saat checkout berhasil, tambahkan
  **point** ke akunnya (rasio dikonfigurasi di satu tempat, contoh: setiap
  kelipatan Rp10.000 = 1 poin — mudah diubah)
- Poin cukup diakumulasi dan ditampilkan di halaman profil user (fitur
  redeem/tukar poin menyusul, tidak perlu dibuat sekarang)

---

## 4. Backend & Database (menggantikan localStorage & data dummy)

### Stack

- **Backend terpisah** dari Vite (karena ini proyek Vite murni tanpa API
  routes bawaan): Node.js + Express, atau Laravel jika lebih cocok
- **Database**: MySQL/PostgreSQL
- **Cache/Queue**: Redis

### Apa saja yang harus diganti dari sisi frontend (`main.js`)

Saat ini beberapa hal disimulasikan secara lokal dan **harus diganti** dengan
panggilan API asli:

1. **Transaksi** — `getStoredTransactions()` / `saveStoredTransaction()`
   memakai `localStorage`. Ganti jadi:
   - `POST /api/orders` saat checkout (`handleCheckout()`)
   - `GET /api/orders?invoice=...` untuk `searchInvoice()`
   - `GET /api/orders/history` untuk tabel realtime (`renderRealtimeTable()`)
2. **QR Pembayaran** — saat ini `handleCheckout()` men-generate QR palsu
   lewat `api.qrserver.com` yang cuma meng-encode nomor invoice sebagai teks
   (bukan QRIS asli). Ganti dengan QR/string QRIS asli yang dikembalikan oleh
   payment gateway setelah order dibuat
3. **Auth** — lihat bagian 3 di atas

### Skema database minimal

- `users` (id, nama, email, password_hash, whatsapp, points, created_at)
- `products` (id, game [mlbb/valorant], nama_item, nominal, harga, is_active)
- `orders` (id, user_id [nullable untuk guest], product_id, game_user_id,
  server_id [khusus ML], riot_id [khusus Valo], wa/email_guest, status,
  payment_method, payment_ref, total_harga, invoice_number, created_at,
  updated_at)
- `payment_logs` (id, order_id, gateway_ref, status, raw_response, created_at)
- `point_history` (id, user_id, order_id, points_earned, created_at)

### Integrasi wajib

1. **Payment Gateway (QRIS)** — Tripay atau Midtrans (disarankan karena mudah
   untuk QRIS). Sediakan endpoint webhook untuk callback status pembayaran
2. **API Provider Top Up Game** — Digiflazz (atau provider resmi lain) untuk
   memproses top up ML & Valorant otomatis setelah pembayaran terkonfirmasi

---

## 5. Logika Sistem / Algoritma

### Alur transaksi (state machine)

```
pending → paid → processing → success
                            → failed (retry manual/otomatis)
```

Format nomor invoice tetap gunakan pola yang sudah ada di kode:
`OS` + `YYYYMMDD` + 6 karakter random (lihat logic di `handleCheckout()`),
cukup sesuaikan prefix jika mau (misal `DS` untuk Dar'sstore).

### Antrian (Queue)

Setelah webhook pembayaran dikonfirmasi, **jangan proses top up secara
sinkron**. Masukkan ke antrian agar:
- Provider game yang lambat/down tidak memblokir transaksi user lain
- Bisa retry otomatis (maks 3x), lalu tandai `failed` untuk review manual

### Idempotency Pembayaran

Webhook bisa terkirim berkali-kali — cek status transaksi dulu sebelum
diproses ulang, pakai referensi unik transaksi untuk cegah top up dobel.

### Poin

Hitung poin hanya jika `user_id` tidak null **dan** status order = `success`.
Simpan riwayat di `point_history` untuk audit.

### Guest Checkout

Untuk transaksi tanpa login, wajib ada WhatsApp/email guest sebagai kontak
notifikasi status (karena tidak ada akun untuk dicek).

### Keamanan

- Validasi signature/token webhook payment gateway (jangan percaya payload
  mentah)
- Rate limiting di endpoint checkout (`POST /api/orders`) untuk cegah spam
- Hash password dengan bcrypt/argon2, jangan plain text

---

## 6. Rekomendasi Struktur Folder Proyek (Full-Stack)

Struktur saat ini (`dist/`, `node_modules/`, `public/`, `src/` dengan
`data.js`/`main.js`/`style.css` bercampur jadi satu, aset `.svg` diletakkan
di root) sudah cukup untuk proyek frontend-only, tapi begitu backend & data
asli ditambahkan, akan lebih rapi kalau dipisah jadi dua proyek terpisah
dalam satu folder induk (monorepo sederhana). **Memindahkan lokasi file itu
murni reorganisasi folder — TIDAK mengubah tampilan/layout sama sekali**,
jadi aman dilakukan.

```
darsstore/
├── frontend/                       ← proyek Vite yang sudah ada, dipindah ke sini
│   ├── public/
│   │   └── assets/
│   │       ├── games/              (poster ML & Valorant)
│   │       ├── icons/              (ikon diamond, VP, dll)
│   │       ├── payments/           (logo QRIS/e-wallet)
│   │       └── banners/            (gambar carousel)
│   ├── src/
│   │   ├── main.js
│   │   ├── style.css
│   │   ├── data/                   ← pecah data.js per-domain (opsional,
│   │   │   ├── games.js              tapi lebih rapi & mudah dirawat)
│   │   │   ├── nominals.js
│   │   │   └── payments.js
│   │   ├── api/                    ← kumpulan fungsi fetch ke backend
│   │   │   ├── client.js           (wrapper fetch + auto-attach token)
│   │   │   ├── auth.js
│   │   │   └── orders.js
│   │   └── utils/
│   │       └── format.js           (formatRupiah, dll)
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── backend/                        ← API server baru, terpisah dari Vite
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Order.js
│   │   │   └── Product.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── orders.routes.js
│   │   │   └── webhook.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   └── order.controller.js
│   │   ├── services/
│   │   │   ├── paymentGateway.js    (integrasi Tripay/Midtrans)
│   │   │   └── topupProvider.js     (integrasi Digiflazz)
│   │   ├── jobs/
│   │   │   └── processOrderQueue.js (worker antrian + retry)
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   └── rateLimit.middleware.js
│   │   └── app.js
│   ├── package.json
│   └── .env.example
│
└── README.md
```

Kalau reorganisasi sebesar ini terasa berlebihan untuk sekarang, versi minimal
yang tetap rapi: **biarkan folder Vite yang sekarang persis seperti posisinya
sekarang**, lalu cukup tambahkan folder `backend/` sejajar di sebelahnya
(bukan di dalam `src/`). Yang penting backend dan frontend tidak bercampur
dalam satu folder yang sama.

---

## Hasil Akhir yang Diharapkan

Website dengan tampilan **sama persis** seperti sekarang (hanya warna gold →
biru `#006199`, dan hitam disesuaikan senada), fokus hanya ke 2 game (ML &
Valorant) dengan struktur yang sudah disederhanakan sesuai poin 2, sistem
login/daftar asli dengan poin untuk user yang login, dan backend lengkap yang
memproses top up ML & Valorant otomatis dengan pembayaran QRIS asli
(menggantikan seluruh simulasi `localStorage` dan QR dummy yang ada sekarang).
