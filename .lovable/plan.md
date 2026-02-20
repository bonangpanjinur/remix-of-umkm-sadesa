

# Rencana Pengembangan Sistem Chat Lengkap DesaMart

## Analisis Kondisi Saat Ini

Sistem chat saat ini **sangat terbatas**:
- Hanya ada 1 komponen `OrderChat` yang terikat ke `order_id`
- Hanya mendukung chat **Pembeli - Penjual** (via pesanan)
- Tidak ada chat Pembeli - Kurir
- Tidak ada chat Penjual - Kurir
- Tidak ada halaman chat khusus untuk Pembeli (hanya dialog kecil)
- Tidak ada halaman chat untuk Kurir
- Tabel `chat_messages` tidak memiliki kolom `chat_type` untuk membedakan jenis percakapan

## Peta Hubungan Chat yang Dibutuhkan

Berikut semua jalur komunikasi yang seharusnya ada:

```text
+----------+          +----------+          +----------+
|          |  Chat 1  |          |  Chat 2  |          |
|  PEMBELI | <------> | PENJUAL  | <------> |  KURIR   |
|          |          |          |          |          |
+----------+          +----------+          +----------+
      |                                          |
      |               Chat 3                     |
      +------------------------------------------+
```

| # | Jalur | Konteks | Kapan Aktif |
|---|-------|---------|-------------|
| 1 | Pembeli - Penjual | Tanya produk, negosiasi, komplain | Selama pesanan aktif (NEW sampai DONE) |
| 2 | Penjual - Kurir | Koordinasi pengambilan barang, alamat detail | Saat pesanan status ASSIGNED sampai DELIVERED |
| 3 | Pembeli - Kurir | Konfirmasi lokasi pengantaran, "sudah di mana?" | Saat pesanan status ASSIGNED sampai DELIVERED |

**Tambahan yang juga penting:**

| # | Jalur | Konteks |
|---|-------|---------|
| 4 | Admin - Penjual | Verifikasi dokumen, klarifikasi penolakan |
| 5 | Admin - Pembeli | Penanganan komplain/refund |
| 6 | Verifikator - Penjual | Koordinasi kas, pengumuman grup |

Untuk fase pertama, kita fokuskan pada **Chat 1, 2, dan 3** (Pembeli-Penjual, Penjual-Kurir, Pembeli-Kurir) karena ini yang paling berdampak pada pengalaman transaksi.

---

## Rencana Implementasi

### Fase 1: Upgrade Database

**Migrasi tabel `chat_messages`** -- tambah kolom baru tanpa merusak data lama:

- `chat_type TEXT DEFAULT 'buyer_merchant'` -- jenis chat: `buyer_merchant`, `buyer_courier`, `merchant_courier`
- `image_url TEXT` -- untuk kirim foto (bukti lokasi, foto barang)
- Semua data lama otomatis mendapat `chat_type = 'buyer_merchant'`

Update RLS policies agar kurir bisa mengakses chat yang relevan.

### Fase 2: Upgrade Komponen Chat

**Refactor `OrderChat.tsx`** agar mendukung multi-tipe:
- Tambah prop `chatType` untuk filter pesan berdasarkan tipe
- Tambah fitur kirim gambar (upload ke storage)
- Tampilkan label peran pengirim (Pembeli/Penjual/Kurir)
- Tambah quick reply template untuk penjual dan kurir

### Fase 3: Halaman Chat per Role

**3a. Halaman Chat Pembeli** (`src/pages/buyer/BuyerChatPage.tsx`)
- Daftar semua thread aktif (dengan penjual dan kurir)
- Tab: "Penjual" | "Kurir"
- Badge unread count
- Route: `/buyer/chat`

**3b. Upgrade Halaman Chat Penjual** (`src/pages/merchant/MerchantChatPage.tsx`)
- Tambah tab "Pembeli" | "Kurir"
- Thread dengan kurir muncul saat pesanan di-assign
- Notifikasi pesan baru

**3c. Halaman Chat Kurir** (`src/pages/courier/CourierChatPage.tsx`)
- Daftar thread dengan pembeli dan penjual per pesanan aktif
- Tab: "Pembeli" | "Penjual"
- Quick reply: "Sudah di lokasi", "Sedang menuju", "Barang sudah diambil"
- Route: `/courier/chat`

### Fase 4: Integrasi ke Halaman yang Ada

- **OrderTrackingPage** (Pembeli): Tambah tombol "Chat Kurir" saat status ASSIGNED/PICKED_UP/SENT
- **OrdersPage** (Pembeli): Tombol chat kurir di samping chat penjual
- **CourierDashboardPage** (Kurir): Tombol chat pembeli dan penjual per pesanan
- **MerchantOrdersPage** (Penjual): Tombol chat kurir saat pesanan sudah di-assign
- **Header/BottomNav**: Badge notifikasi unread chat global

### Fase 5: Fitur Pendukung

- **Unread count global**: Hook `useChatUnread()` yang subscribe realtime ke semua chat user
- **Notifikasi push**: Kirim push notification saat pesan baru (via edge function yang sudah ada)
- **Auto-delete**: Chat otomatis dihapus 7 hari setelah pesanan selesai (DONE)

---

## Detail Teknis

### File yang Dibuat Baru

| File | Deskripsi |
|------|-----------|
| `src/pages/buyer/BuyerChatPage.tsx` | Halaman daftar chat pembeli |
| `src/pages/courier/CourierChatPage.tsx` | Halaman daftar chat kurir |
| `src/hooks/useChatUnread.ts` | Hook global unread count |

### File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `supabase migration` | Tambah kolom `chat_type`, `image_url` ke `chat_messages` + RLS update |
| `src/components/chat/OrderChat.tsx` | Tambah prop `chatType`, filter berdasarkan tipe, label peran, kirim gambar |
| `src/pages/merchant/MerchantChatPage.tsx` | Tambah tab Kurir |
| `src/pages/OrdersPage.tsx` | Tambah tombol "Chat Kurir" |
| `src/pages/OrderTrackingPage.tsx` | Tambah tombol "Chat Kurir" |
| `src/pages/CourierDashboardPage.tsx` | Tambah tombol chat pembeli + penjual |
| `src/pages/merchant/MerchantOrdersPage.tsx` | Tambah tombol chat kurir |
| `src/App.tsx` | Tambah route `/buyer/chat` dan `/courier/chat` |
| `src/components/layout/BottomNav.tsx` | Badge unread chat |

### Skema Database (Migrasi)

```text
ALTER TABLE chat_messages
  ADD COLUMN chat_type TEXT DEFAULT 'buyer_merchant',
  ADD COLUMN image_url TEXT;

-- Update RLS: kurir bisa akses chat tipe buyer_courier dan merchant_courier
-- pada pesanan yang di-assign ke mereka
```

### Estimasi

- **Fase 1 (Database)**: Migrasi SQL sederhana
- **Fase 2-3 (Komponen + Halaman)**: Perubahan utama
- **Fase 4-5 (Integrasi + Polish)**: Finishing touches

Total: 3 file baru, 9 file dimodifikasi, 1 migrasi database

