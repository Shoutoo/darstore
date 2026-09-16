# PROMPT REVISI UNTUK ANTIGRAVITY — Warna: Background Tetap, Hanya Aksen Gold → Biru

## KONTEKS

Ini **revisi** dari prompt warna sebelumnya. Kalau prompt warna yang lama
sudah sempat mengubah warna background (`--bg-primary`, `--bg-card`, dst)
jadi nuansa navy, **kembalikan dulu warna background itu ke nilai aslinya di
pondasi** (sebelum ada perubahan warna apa pun). Fokus revisi ini HANYA di
warna aksen yang sebelumnya bernuansa gold — ganti ke biru yang serasi dan
tidak bentrok dengan background abu-gelap netral yang sudah ada di pondasi.

> **Background TIDAK diubah sama sekali.** Yang diubah hanya variabel warna
> aksen (gold → biru) di `style.css`.

---

## 1. Kembalikan Warna Background ke Nilai Asli Pondasi

Pastikan variabel berikut di `:root` pada `style.css` bernilai PERSIS seperti
ini (nilai asli sebelum ada perubahan warna apa pun):

```css
--bg-primary: #262727;
--bg-secondary: #212121;
--bg-card: #313438;
--bg-card-subtle: #2b2e32;
--bg-card-hover: #383c41;
--bg-input: #373b3f;
--bg-input-focus: #3d4247;
--border-subtle: #3c4045;
--border-card: #43474d;
```

Kalau nilai-nilai ini masih dalam kondisi sudah diubah ke navy dari revisi
sebelumnya, kembalikan ke angka di atas. Kalau belum sempat diubah sama
sekali, biarkan seperti apa adanya sekarang (tidak perlu disentuh).

---

## 2. Ganti HANYA Variabel Aksen Gold → Biru

Variabel-variabel ini yang menyimpan seluruh nuansa gold di seluruh situs
(dipanggil dari `style.css` maupun `main.js` lewat `var(--accent-gold)`, dst)
— **cukup ganti nilainya**, jangan ganti nama variabelnya:

| Variabel | Nilai lama (gold) | Ganti jadi (biru) |
|---|---|---|
| `--accent-gold` | `#a58c6f` | `#006199` |
| `--accent-gold-hover` | `#ba9e7d` | `#1479b3` |
| `--accent-gold-light` | `#fff1be` | `#5ec8f2` |
| `--accent-gold-glow` | `rgba(165, 140, 111, 0.35)` | `rgba(0, 97, 153, 0.35)` |
| `--border-focus` | `#a58c6f` | `#006199` |
| `--shadow-glow` | `... rgba(165, 140, 111, 0.25)` | `... rgba(0, 97, 153, 0.25)` |

Nilai biru di atas sudah dipilih supaya kontras dan serasi dengan background
abu-gelap netral (`#262727`, `#313438`, dst) yang **tetap dipertahankan**,
tidak perlu background ikut berubah warna supaya biru ini terlihat cocok.

> Variabel lain seperti `--badge-green`, `--badge-yellow`, `--badge-red`,
> `--text-primary`, `--text-secondary`, `--text-muted` **tidak disentuh sama
> sekali** — itu bukan bagian dari nuansa gold.

---

## 3. Hex Hardcode (Bukan Variabel) — Tetap Perlu Ditangani

Beberapa tempat di `style.css` menulis warna teks langsung (bukan lewat
variabel) yang dipasangkan dengan tombol/badge ber-background
`var(--accent-gold)`, contoh pola:

```css
background: var(--accent-gold);
color: #1a1a1a;   /* atau #17181a */
```

Karena gold lama itu warna terang (cocok dengan teks gelap `#1a1a1a`),
sedangkan biru `#006199` itu **lebih gelap**, teks gelap di atasnya jadi
tidak terbaca. **Ganti teks `#1a1a1a`/`#17181a` ini jadi putih (`#ffffff`)**
di setiap tempat yang dipasangkan dengan `background: var(--accent-gold)`.

Hex hitam lain yang dipakai sebagai **background panel berdiri sendiri**
(bukan pasangan tombol gold, misal gradient modal/chat bubble) — ini **tidak
perlu diubah**, biarkan seperti aslinya karena termasuk bagian dari
background yang dipertahankan sesuai poin 1.

---

## 4. Pengecekan Akhir

- Pastikan semua tombol, border aktif, badge, dan teks yang sebelumnya
  berwarna gold sekarang tampil biru `#006199` dan turunannya
- Pastikan warna background di seluruh halaman (Home, ML, Valorant, Cek
  Transaksi, dll) tetap sama seperti pondasi awal — tidak ikut berubah
- Cek kontras teks putih baru di atas tombol biru (poin 3) sudah cukup
  terbaca (kontras minimal setara WCAG AA)
- Cek tema terang (`[data-theme="light"]`) — karena variabel gold tidak
  didefinisikan ulang di sana, otomatis ikut memakai biru baru dari `:root`,
  tidak perlu diubah manual

---

## Hasil Akhir yang Diharapkan

Background situs tetap persis seperti pondasi awal (abu-gelap netral, tidak
digeser ke navy), sementara seluruh elemen yang sebelumnya bernuansa gold
(tombol, border aktif, badge, teks highlight, glow/shadow) berubah jadi biru
`#006199` beserta turunannya, dengan kontras yang tetap terjaga dan tidak
bentrok secara visual dengan background yang dipertahankan.
