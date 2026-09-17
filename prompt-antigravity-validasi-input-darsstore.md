# PROMPT LANJUTAN UNTUK ANTIGRAVITY — Validasi Input User ID/Zone ID (ML) & Riot ID (Valorant)

## KONTEKS

Sudah saya cek `handleCheckout()` di `main.js` (baris 646–671). Validasi
input saat ini sangat minim: cuma cek field tidak kosong (`ml-userid`,
`ml-server`) dan Riot ID (`valo-riotid`) sekadar mengandung karakter `#`.
Perkuat validasi ini sesuai format asli tiap game, supaya user tidak asal
memasukkan angka/teks yang jelas-jelas salah format sebelum transaksi
diproses. **Jangan ubah tampilan form** — ini murni menambah logic validasi
sebelum data dikirim.

> **Catatan penting soal batasan validasi Riot ID:** Riot ID (format
> `Nama#Tag`) **tidak menyimpan informasi region/server di dalam teksnya
> sendiri** — beda dengan Mobile Legends yang region-nya eksplisit lewat
> Zone ID. Jadi validasi "pastikan ini akun server Indonesia" **tidak bisa
> dipastikan 100% hanya dari format teks** yang diketik user. Yang bisa dan
> harus dilakukan di sini: validasi **format** Riot ID benar (mencegah salah
> ketik/format ngaco). Verifikasi apakah akun itu betul terdaftar di region
> Indonesia baru benar-benar diketahui saat API provider (Digiflazz)
> memproses top up-nya — kalau ternyata beda region, transaksi akan gagal di
> tahap itu, dan sistem tetap harus menangani status `failed` dengan baik
> (lihat bagian 4).

---

## 1. Validasi Mobile Legends — User ID & Zone ID

Berdasarkan format resmi Mobile Legends: **User ID** adalah angka panjang
(umumnya 8–9 digit, kadang bisa 6–10 digit tergantung usia akun), dan
**Zone ID/Server** adalah angka pendek dalam kurung di game (umumnya 4
digit, kadang 3–5 digit).

### Aturan validasi

- **User ID** (`#ml-userid`): HANYA angka, minimal 6 digit, maksimal 10 digit
- **Zone ID / Server** (`#ml-server`): HANYA angka, minimal 3 digit,
  maksimal 5 digit

### Implementasi di `handleCheckout()` (ganti bagian validasi ML)

```js
if (gameKey === 'ml') {
  const uid = document.getElementById('ml-userid').value.trim();
  const srv = document.getElementById('ml-server').value.trim();

  const uidRegex = /^\d{6,10}$/;
  const srvRegex = /^\d{3,5}$/;

  if (!uid || !srv) {
    alert('Silakan masukkan User ID dan Server Mobile Legends Anda!');
    document.getElementById('ml-userid').focus();
    return;
  }

  if (!uidRegex.test(uid)) {
    alert('User ID tidak valid! User ID Mobile Legends hanya berupa angka (6-10 digit). Contoh: 123456789');
    document.getElementById('ml-userid').focus();
    return;
  }

  if (!srvRegex.test(srv)) {
    alert('Zone ID/Server tidak valid! Zone ID hanya berupa angka (3-5 digit), lihat angka di dalam kurung pada profil ML Anda. Contoh: 2114');
    document.getElementById('ml-server').focus();
    return;
  }

  state.userId = uid;
  state.server = srv;
}
```

### Cegah input karakter selain angka SAAT MENGETIK (bukan cuma saat submit)

Supaya user tidak bisa memasukkan huruf/simbol sama sekali sejak awal
(bukan cuma dikasih tahu setelah klik tombol beli), tambahkan filter
langsung di event `input` pada kedua field ini (di bagian setup event
listener/`setupCounters()` atau sejenisnya):

```js
function restrictToNumeric(inputEl, maxLength) {
  inputEl.addEventListener('input', () => {
    inputEl.value = inputEl.value.replace(/\D/g, '').slice(0, maxLength);
  });
}

restrictToNumeric(document.getElementById('ml-userid'), 10);
restrictToNumeric(document.getElementById('ml-server'), 5);
```

Ini bikin pengalaman user lebih baik — karakter non-angka otomatis
terblokir/terhapus saat diketik, bukan baru ketahuan salah setelah klik
tombol beli.

### Tambahan opsional (kalau field-nya menerima format gabungan)

Kalau ke depannya form ML diubah supaya user bisa paste format gabungan
langsung dari game (`12345678(2114)`) ke satu kolom, tambahkan fungsi parse
terpisah untuk memecahnya otomatis jadi User ID & Zone ID — tapi ini
perubahan tampilan/UX form, jadi HANYA dilakukan kalau memang diminta secara
terpisah, bukan bagian dari prompt validasi ini.

---

## 2. Validasi Valorant — Riot ID

Format resmi Riot ID: `NamaPengguna#Tagline`, dipisah tanda pagar (`#`).
- **NamaPengguna**: 3–16 karakter (aturan resmi Riot), boleh huruf, angka,
  spasi, dan beberapa simbol
- **Tagline**: secara default berupa 3–5 digit angka (meski Riot sekarang
  juga mengizinkan huruf di tagline, sesuai instruksi kamu tagline **wajib
  angka saja** untuk toko ini)

### Aturan validasi

- Wajib mengandung tepat satu tanda `#`
- Bagian nama: minimal 3, maksimal 16 karakter, tidak boleh kosong
- Bagian tagline (setelah `#`): HANYA angka, minimal 3, maksimal 5 digit

### Implementasi di `handleCheckout()` (ganti bagian validasi Valorant)

```js
} else if (gameKey === 'valo') {
  const riotId = document.getElementById('valo-riotid').value.trim();

  if (!riotId || !riotId.includes('#')) {
    alert('Silakan masukkan Riot ID yang valid dengan Tagline! (Contoh: Player#1234)');
    document.getElementById('valo-riotid').focus();
    return;
  }

  const parts = riotId.split('#');
  if (parts.length !== 2) {
    alert('Format Riot ID salah! Pastikan hanya ada satu tanda # . Contoh: Player#1234');
    document.getElementById('valo-riotid').focus();
    return;
  }

  const [namaPart, tagPart] = parts;
  const namaRegex = /^.{3,16}$/;
  const tagRegex = /^\d{3,5}$/;

  if (!namaRegex.test(namaPart.trim())) {
    alert('Nama pada Riot ID harus 3-16 karakter! Contoh: Player#1234');
    document.getElementById('valo-riotid').focus();
    return;
  }

  if (!tagRegex.test(tagPart.trim())) {
    alert('Tagline Riot ID harus berupa angka saja (3-5 digit) untuk Region Indonesia! Contoh: Player#1234');
    document.getElementById('valo-riotid').focus();
    return;
  }

  state.riotId = `${namaPart.trim()}#${tagPart.trim()}`;
}
```

### Validasi saat mengetik (real-time, opsional tapi disarankan)

Tambahkan indikator visual kecil di bawah input (misal teks kecil hijau/
merah) yang langsung menunjukkan valid/tidaknya format Riot ID begitu user
selesai mengetik (event `blur` atau `input` dengan debounce), supaya user
tahu kesalahan sebelum klik tombol beli:

```js
const riotIdInput = document.getElementById('valo-riotid');
riotIdInput.addEventListener('blur', () => {
  const value = riotIdInput.value.trim();
  const isValid = /^.{3,16}#\d{3,5}$/.test(value);
  riotIdInput.style.borderColor = value === ''
    ? ''
    : (isValid ? 'var(--badge-green)' : '#e74c3c');
});
```

---

## 3. Tampilkan Petunjuk Format di Bawah Field (UI kecil, bukan redesign)

Tanpa mengubah layout form, tambahkan teks kecil/placeholder di bawah tiap
input supaya user paham formatnya sebelum salah ketik:

- `ml-userid` → placeholder atau helper text: *"Contoh: 123456789 (hanya angka)"*
- `ml-server` → placeholder atau helper text: *"Contoh: 2114 (lihat angka dalam kurung)"*
- `valo-riotid` → placeholder atau helper text: *"Contoh: Player#1234 (tagline harus angka)"*

Ini elemen kecil (placeholder/small text), bukan perubahan struktur layout,
jadi aman ditambahkan tanpa melanggar aturan "jangan ubah layout".

---

## 4. Tetap Siapkan Penanganan Kalau Region Ternyata Salah (Sisi Backend)

Karena—seperti dijelaskan di bagian konteks—format Riot ID yang valid TIDAK
menjamin akun itu benar-benar terdaftar di region Indonesia, pastikan alur
backend (dari prompt-prompt sebelumnya) sudah menangani skenario ini dengan
baik:

- Kalau API Digiflazz menolak/gagal karena region tidak sesuai, order harus
  otomatis berubah status jadi `failed` (bukan menggantung selamanya di
  `processing`)
- Tampilkan pesan yang jelas ke user di halaman "Cek Transaksi" kalau
  transaksinya gagal karena alasan ini (kalau response dari Digiflazz
  memberi keterangan errornya, tampilkan keterangan itu, jangan cuma
  "Gagal" tanpa penjelasan)
- Pertimbangkan menambahkan catatan kecil di form Valorant: *"Pastikan akun
  Anda terdaftar di Region Indonesia sebelum melakukan top up"* — ini bukan
  validasi teknis, tapi mengingatkan user secara manual karena sistem tidak
  bisa memastikannya otomatis dari teks Riot ID saja

---

## Hasil Akhir yang Diharapkan

User tidak bisa lagi mengetik huruf/simbol di field User ID dan Zone ID
Mobile Legends (otomatis terblokir + tervalidasi panjang digitnya), dan Riot
ID Valorant harus mengikuti format `Nama#Tag` yang benar dengan tagline
berupa angka 3–5 digit, lengkap dengan pesan error yang jelas kalau formatnya
salah — tanpa mengubah tampilan form yang sudah ada.
