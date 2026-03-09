

# Rencana Perbaikan: Ojek Desa UI + Homepage Integration

## Perubahan yang Akan Dilakukan

### 1. Homepage — Ojek Desa jadi icon kategori (bukan card besar)
**File**: `src/pages/Index.tsx`
- Hapus block `<Link to="/ride">` card besar Ojek Desa (baris 116-125)
- Tambahkan Ojek Desa sebagai item icon kategori di baris yang sama dengan Kuliner, Fashion, dll
- Ukuran sama: `w-12 h-12` rounded icon + label di bawah, menggunakan `Bike` icon
- Warna: `bg-emerald-100 text-emerald-700 border-emerald-200`

### 2. Homepage — Tambah section "Driver Terdekat" dengan peta mini
**File**: `src/pages/Index.tsx`
- Tambah section baru setelah categories yang menampilkan peta kecil dengan marker driver/kurir terdekat yang sedang online (data dari tabel `couriers` yang `is_available=true` dan punya `current_lat/lng`)
- Peta menggunakan `CourierMap` dengan `showAllCouriers={true}` dan height kecil (`180px`)
- Label: "Driver Terdekat" dengan badge jumlah driver aktif
- Ini murni GPS-based — tidak simpan lokasi user, hanya query posisi kurir yang sudah di-broadcast/checkpoint oleh `CourierLocationUpdater`

### 3. Ojek Desa — Redesign halaman booking (modern, single-page)
**File**: `src/pages/ride/RideBookingPage.tsx` — rewrite total
- Layout baru: **Peta fullscreen** sebagai background utama (seperti Grab/Gojek)
- Bottom sheet / overlay card untuk input:
  - Dua input field stacked: "Titik Jemput" (auto-fill GPS) dan "Titik Tujuan" (tap peta)
  - Mode toggle: sedang pilih jemput atau tujuan
  - Saat kedua titik terpilih, otomatis tampilkan estimasi jarak + tarif di bottom card
  - Tombol "Pesan Ojek" di bottom
- Peta menampilkan:
  - Marker hijau (jemput) + marker merah (tujuan)
  - Garis dashed antara keduanya
  - Marker motor untuk driver terdekat yang online (query `couriers` yang `is_available`)
- Tidak ada multi-step wizard lagi — semua dalam 1 layar
- Mobile-first, menggunakan `mobile-shell` wrapper

### 4. Tidak ada penyimpanan lokasi user di database
- Konfirmasi: Semua lokasi berbasis GPS real-time
- `CourierLocationUpdater` sudah benar: broadcast via WebSocket, checkpoint ke DB tiap 30 detik (ini lokasi kurir, bukan user)
- Lokasi penumpang hanya dikirim saat submit `ride_requests` (pickup_lat/lng) — tidak disimpan permanen

## Detail Teknis

### Index.tsx — Perubahan categories section
```text
Sebelum: [Kuliner] [Fashion] [Kriya] [Wisata]
         ┌─────────────────────────────┐
         │ 🏍 Ojek Desa                │  ← card besar, dihapus
         │ Pesan ojek antar lokasi   > │
         └─────────────────────────────┘

Sesudah: [Kuliner] [Fashion] [Kriya] [Wisata] [Ojek]  ← icon kecil sejajar
         
         ┌─ Driver Terdekat ──────────┐
         │ [peta mini 180px]          │  ← section baru
         │ 🟢 3 driver aktif          │
         └────────────────────────────┘
```

### RideBookingPage.tsx — Layout baru
```text
┌──────────────────────────┐
│  ← Ojek Desa        [GPS]│  ← header compact
│                           │
│   ┌─────────────────┐    │
│   │                 │    │
│   │   PETA BESAR    │    │
│   │  🟢jemput       │    │
│   │       ---- 🔴tujuan  │
│   │  🏍 🏍 (driver) │    │
│   │                 │    │
│   └─────────────────┘    │
│                           │
│ ┌───────────────────────┐│
│ │ 📍 Lokasi saya        ││ ← bottom card
│ │ 📌 Pilih tujuan...    ││
│ │                       ││
│ │ Jarak: 3.2 km         ││
│ │ Estimasi: Rp 14.600   ││
│ │ [  🏍 Pesan Ojek    ] ││
│ └───────────────────────┘│
└──────────────────────────┘
```

### File yang diubah:
1. `src/pages/Index.tsx` — Ojek jadi icon kategori + section driver terdekat
2. `src/pages/ride/RideBookingPage.tsx` — Redesign total single-page map-first

