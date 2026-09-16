# PROMPT LANJUTAN UNTUK ANTIGRAVITY — Setup Database "Dar'sstore"

## KONTEKS

Prompt sebelumnya (penyesuaian warna, penyederhanaan konten, kerangka
backend, dan fitur auth) sudah dijalankan. Sekarang fokus HANYA pada
implementasi database asli, menggantikan `localStorage` dan data dummy yang
masih tersisa. **Jangan ubah tampilan/layout apa pun** — ini murni pekerjaan
backend/data.

---

## 1. Setup Database

- **Database**: PostgreSQL
- **Hosting**: Supabase (rekomendasi utama, karena ada auth bawaan) atau
  Railway sebagai alternatif
- **ORM**: Prisma

### Langkah setup

1. Buat project baru di [supabase.com](https://supabase.com) (atau Railway)
2. Ambil connection string `DATABASE_URL` dari dashboard project, taruh di
   file `.env` pada folder backend:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/darsstore?schema=public"
   ```
3. Install Prisma di backend: `npm install prisma @prisma/client`
4. Inisialisasi: `npx prisma init` (kalau belum ada folder `prisma/`)
5. Tempel skema di `prisma/schema.prisma` (lihat bagian 2 di bawah)
6. Jalankan migrasi: `npx prisma migrate dev --name init` — ini otomatis
   membuat semua tabel di database sesuai skema
7. Generate Prisma Client: `npx prisma generate` (biasanya otomatis jalan
   setelah migrate)

---

## 2. Skema Database (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum GameType {
  mlbb
  valorant
}

enum OrderStatus {
  pending
  paid
  processing
  success
  failed
}

model User {
  id            Int       @id @default(autoincrement())
  nama          String
  email         String    @unique
  passwordHash  String    @map("password_hash")
  whatsapp      String?
  points        Int       @default(0)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  orders        Order[]
  pointHistory  PointHistory[]

  @@map("users")
}

model Product {
  id        Int      @id @default(autoincrement())
  game      GameType
  namaItem  String   @map("nama_item")
  nominal   String?
  harga     Int
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  orders    Order[]

  @@map("products")
}

model Order {
  id             Int         @id @default(autoincrement())
  invoiceNumber  String      @unique @map("invoice_number")
  userId         Int?        @map("user_id")
  productId      Int         @map("product_id")
  gameUserId     String?     @map("game_user_id")
  serverId       String?     @map("server_id")
  riotId         String?     @map("riot_id")
  contactWa      String?     @map("contact_wa")
  contactEmail   String?     @map("contact_email")
  status         OrderStatus @default(pending)
  paymentMethod  String?     @map("payment_method")
  paymentRef     String?     @map("payment_ref")
  totalHarga     Int         @map("total_harga")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  user           User?           @relation(fields: [userId], references: [id])
  product        Product         @relation(fields: [productId], references: [id])
  paymentLogs    PaymentLog[]
  pointHistory   PointHistory[]

  @@index([invoiceNumber])
  @@index([status])
  @@map("orders")
}

model PaymentLog {
  id           Int      @id @default(autoincrement())
  orderId      Int      @map("order_id")
  gatewayRef   String?  @map("gateway_ref")
  status       String?
  rawResponse  Json?    @map("raw_response")
  createdAt    DateTime @default(now()) @map("created_at")

  order        Order    @relation(fields: [orderId], references: [id])

  @@map("payment_logs")
}

model PointHistory {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  orderId       Int      @map("order_id")
  pointsEarned  Int      @map("points_earned")
  createdAt     DateTime @default(now()) @map("created_at")

  user          User     @relation(fields: [userId], references: [id])
  order         Order    @relation(fields: [orderId], references: [id])

  @@map("point_history")
}
```

---

## 3. Seed Data Awal (Produk)

Setelah tabel terbentuk, isi tabel `products` dengan data nominal ML &
Valorant yang saat ini masih hardcode di `data.js` (`ML_NOMINALS.topup_diamonds`
dan `VALO_NOMINALS.id`). Buat script seed di `prisma/seed.ts` (atau `.js`)
yang membaca nominal-nominal tersebut dan memasukkannya ke tabel `products`
lewat `prisma.product.createMany()`, supaya data produk sekarang benar-benar
berasal dari database, bukan dari file statis.

Jalankan dengan: `npx prisma db seed` (daftarkan script ini di `package.json`
bagian `"prisma": { "seed": "..." }`).

---

## 4. Ganti Fungsi di `main.js` yang Masih Pakai localStorage/Dummy

Sambungkan ke endpoint backend yang sudah dibuat pada prompt sebelumnya, agar
benar-benar membaca/menulis dari database Postgres, bukan lagi simulasi:

| Fungsi lama di `main.js` | Ganti jadi |
|---|---|
| `getStoredTransactions()` (baca `localStorage`) | `GET /api/orders/history` → query `prisma.order.findMany()` |
| `saveStoredTransaction(tx)` (tulis `localStorage`) | `POST /api/orders` → `prisma.order.create()` |
| `searchInvoice(query)` (cari di array lokal + fallback dummy) | `GET /api/orders/:invoiceNumber` → `prisma.order.findUnique({ where: { invoiceNumber } })` |
| QR dummy dari `api.qrserver.com` | QR/string QRIS asli dari response payment gateway, disimpan sementara di `paymentRef` order terkait |
| Data nominal ML/Valo hardcode dari `ML_NOMINALS`/`VALO_NOMINALS` di `data.js` | `GET /api/products?game=mlbb` / `GET /api/products?game=valorant` → `prisma.product.findMany({ where: { game, isActive: true } })` |

Pastikan **tampilan/HTML yang dihasilkan tetap identik** — hanya sumber
datanya yang berubah dari lokal/dummy menjadi hasil `fetch()` ke API asli.

---

## 5. Alur Data End-to-End (memastikan semua tersambung)

1. User pilih nominal → data diambil dari `GET /api/products` (bukan
   `data.js` lagi)
2. User checkout → `POST /api/orders` membuat baris baru di tabel `orders`
   dengan status `pending`, lalu memanggil payment gateway untuk membuat
   QRIS asli
3. Webhook dari payment gateway masuk ke endpoint webhook → update `status`
   order jadi `paid`, catat di `payment_logs`
4. Job antrian (`processOrderQueue.js`) mengambil order berstatus `paid`,
   memanggil API provider top up (Digiflazz), lalu update status jadi
   `success`/`failed`
5. Jika `order.userId` tidak null dan status `success` → insert baris baru
   ke `point_history` dan tambahkan `points` di tabel `users`
6. Halaman "Cek Transaksi" & tabel realtime membaca langsung dari tabel
   `orders` via API, bukan `localStorage` lagi

---

## Hasil Akhir yang Diharapkan

Seluruh data (produk, transaksi, user, poin) benar-benar tersimpan permanen
di PostgreSQL (Supabase/Railway), bisa diakses ulang kapan saja, tidak hilang
saat cache browser dibersihkan atau dibuka dari device lain — menggantikan
seluruh simulasi `localStorage` dan data hardcode yang sebelumnya ada di
`data.js` dan `main.js`. Tampilan tetap sama persis seperti sekarang.
