

# Redesign UI Halaman Profil Merchant (Tampilan Publik)

## Masalah

Dari screenshot, terlihat bahwa halaman merchant menampilkan terlalu banyak section terpisah (Info Toko, Tentang Toko, Alamat) sebelum pembeli bisa melihat produk. Padahal tujuan utama pembeli adalah **melihat dan membeli produk**.

## Konsep Baru

Ringkas informasi merchant menjadi **header compact** + **tab system** agar produk langsung terlihat tanpa scroll jauh.

### Layout Baru:

```text
+----------------------------------+
|  [<-]  Hero Image / Gradient [Share] |
+----------------------------------+
|  Nama Toko  [HALAL] [Badge]     |
|  * 4.5 (23 ulasan) . Raksasari  |
|  @ 05.00-20.00 . Buka           |
+----------------------------------+
|  [Produk (12)] [Info] [Ulasan]   |  <-- 3 tabs
+----------------------------------+
|                                  |
|  TAB PRODUK: grid produk         |
|  TAB INFO: deskripsi + alamat    |
|  TAB ULASAN: list review         |
|                                  |
+----------------------------------+
|  [Chat Penjual]                  |
+----------------------------------+
```

## Perubahan Detail

### File: `src/pages/MerchantProfilePage.tsx`

**1. Header Compact (menggantikan 3 card terpisah)**
- Gabungkan nama, rating, lokasi, jam operasi, dan status buka/tutup menjadi **satu section** tepat di bawah hero image
- Semua info penting (jam, lokasi, status) ditampilkan dalam 1 baris menggunakan separator dot (.)
- Hapus card "Tentang Toko" dan "Alamat" yang terpisah

**2. Tab System 3 tab (menggantikan 2 tab)**
- **Produk** (default, langsung aktif) -- grid produk seperti sekarang
- **Info** -- berisi deskripsi toko, alamat lengkap, desa wisata, klasifikasi harga
- **Ulasan** -- list review seperti sekarang

Gunakan komponen `Tabs` dari Radix UI yang sudah ada di project (`src/components/ui/tabs.tsx`).

**3. Tab default = Produk**
- Saat halaman dibuka, tab Produk langsung aktif
- Pembeli langsung melihat produk tanpa perlu scroll

**4. Banner "Toko Tutup" dipindah**
- Jika merchant tutup/tidak ada kuota, banner muncul di atas grid produk (di dalam tab Produk), bukan di luar tab

**5. Tidak ada perubahan logic**
- Semua data fetching, chat logic, dan halal modal tetap sama
- Hanya perubahan layout/struktur JSX

### Ringkasan Perubahan

| Sebelum | Sesudah |
|---------|---------|
| 3 card terpisah (info, deskripsi, alamat) | 1 header compact |
| 2 tab (Produk, Ulasan) | 3 tab (Produk, Info, Ulasan) |
| Scroll jauh sebelum lihat produk | Produk langsung terlihat |
| Info toko memakan banyak ruang | Info ringkas, detail di tab "Info" |

### File yang diubah:
- `src/pages/MerchantProfilePage.tsx` -- satu-satunya file yang berubah

