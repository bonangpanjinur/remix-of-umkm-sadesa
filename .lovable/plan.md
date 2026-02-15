
# Perbaikan Sinkronisasi Tab Pesanan & UI/UX

## Masalah Utama

Halaman pesanan pembeli (`OrdersPage.tsx`) menggunakan nama status **lowercase** (`pending`, `processing`, `shipped`, `completed`, `cancelled`) untuk filter tab, tetapi database menyimpan status **UPPERCASE** yang berbeda (`NEW`, `PENDING_PAYMENT`, `PROCESSED`, `SENT`, `DONE`, `CANCELLED`).

Akibatnya: tab "Semua" menampilkan semua pesanan, tetapi tab lain kosong karena tidak ada status yang cocok.

## Perbandingan Status

```text
Database (aktual)         Buyer Page (sekarang)     Yang seharusnya
---------------------     --------------------      ----------------
NEW                       (tidak ada)               Tab "Belum Bayar"
PENDING_PAYMENT           pending                   Tab "Belum Bayar"
PENDING_CONFIRMATION      (tidak ada)               Tab "Belum Bayar"
CONFIRMED                 confirmed                 Tab "Diproses"
PROCESSED                 processing                Tab "Diproses"
SENT                      shipped                   Tab "Dikirim"
DELIVERED                 (tidak ada)               Tab "Dikirim"
DONE                      completed                 Tab "Selesai"
CANCELLED / CANCELED      cancelled                 Tab "Dibatalkan"
```

## Perubahan yang Diperlukan

### File: `src/pages/OrdersPage.tsx`

**1. Perbaiki STATUS_CONFIG** -- Ganti key lowercase menjadi status database yang sebenarnya:

```text
Lama: pending, confirmed, processing, shipped, ...
Baru: NEW, PENDING_PAYMENT, PENDING_CONFIRMATION, CONFIRMED, PROCESSED, SENT, DELIVERED, DONE, CANCELLED, CANCELED
```

Setiap status database mendapat label, ikon, dan warna yang sesuai.

**2. Perbaiki filter tab** -- Ubah logika filtering agar sesuai dengan status database:

- "Belum Bayar": `NEW`, `PENDING_PAYMENT`, `PENDING_CONFIRMATION`
- "Diproses": `CONFIRMED`, `PROCESSED`
- "Dikirim": `SENT`, `DELIVERED`
- "Selesai": `DONE`
- "Dibatalkan": `CANCELLED`, `CANCELED`

**3. Perbaiki hitungan pesanan aktif** -- Gunakan status database yang benar untuk menghitung pesanan aktif (semua kecuali `DONE`, `CANCELLED`, `CANCELED`).

**4. Perbaiki tombol aksi kontekstual** -- Ganti pengecekan status di bagian tombol aksi (Bayar Sekarang, Lacak Pesanan, dll.) agar menggunakan status database uppercase.

**5. Fix ref warning** -- Console error menunjukkan `Skeleton` dan `BottomNav` tidak mendukung ref. Tambahkan `React.forwardRef` pada komponen `Skeleton` jika diperlukan, atau bungkus dengan div.

### Ringkasan Perubahan

- Hanya **1 file** yang diubah: `src/pages/OrdersPage.tsx`
- Mungkin juga perlu fix minor di `src/components/ui/skeleton.tsx` untuk warning ref
- Tidak ada perubahan database
- Tidak ada perubahan dependensi
