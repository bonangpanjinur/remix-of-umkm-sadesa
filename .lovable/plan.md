

# Perbaikan Chat & Pesanan: Info Produk dan Identitas Pengguna

## Masalah yang Ditemukan

Berdasarkan screenshot dan analisis kode:

1. **Chat tidak menampilkan info pesanan/produk** -- Saat membuka chat, tidak ada konteks produk apa yang dibicarakan. Hanya judul "Chat Pesanan" tanpa detail.
2. **Halaman Pesanan menampilkan "Produk" generik** -- Jika `products` relation gagal di-resolve, nama produk jatuh ke teks generik "Produk" dan menampilkan ikon placeholder, bukan foto asli.
3. **Chat menampilkan "Pengguna" bukan nama asli** -- Sender label menampilkan "Pengguna" jika profil belum dimuat. Perlu menampilkan nama yang jelas beserta role (Pembeli/Penjual/Kurir).

## Rencana Perubahan

### 1. OrderChat -- Tambah Kartu Info Pesanan di Atas Chat

**File**: `src/components/chat/OrderChat.tsx`

- Fetch `order_items` + `orders(merchant_id, merchants(name))` berdasarkan `orderId` saat chat dibuka
- Tampilkan kartu ringkas di bawah header berisi:
  - Thumbnail produk pertama (dari `products.image_url`)
  - Nama produk + jumlah item lainnya
  - Total harga pesanan
  - Order ID pendek
- Fetch data produk terpisah jika `order_items.product_id` tersedia untuk mendapatkan `image_url`
- Tampilkan nama pengirim dengan label role yang jelas:
  - Untuk `buyer_merchant`: Pembeli / Penjual
  - Untuk `buyer_courier`: Pembeli / Kurir
  - Untuk `merchant_courier`: Penjual / Kurir

### 2. OrdersPage -- Perbaiki Tampilan Produk

**File**: `src/pages/OrdersPage.tsx`

- Prioritaskan `product_name` dari `order_items` sebagai sumber utama (karena ini selalu tersimpan saat order dibuat)
- Ubah urutan fallback: `firstItem?.product_name || firstItem?.products?.name || "Produk"`
- Ini memastikan nama produk selalu tampil meskipun relasi `products` gagal

### 3. Chat Thread Lists -- Tambah Info Produk di Thread

**File**: `src/pages/buyer/BuyerChatPage.tsx`, `src/pages/merchant/MerchantChatPage.tsx`, `src/pages/courier/CourierChatPage.tsx`

- Setelah membangun thread map, fetch `order_items` untuk semua `orderId` yang unik
- Tampilkan nama produk pertama + thumbnail kecil di setiap card thread
- Tampilkan order ID pendek agar konteks lebih jelas

## Detail Teknis

```text
File yang diubah:

1. src/components/chat/OrderChat.tsx
   - Tambah state orderInfo (items, merchant name, total)
   - Tambah useEffect untuk fetch order_items + products
   - Tambah komponen OrderInfoCard di bawah header
   - Perbaiki sender name: tambah role label (Pembeli/Penjual/Kurir)

2. src/pages/OrdersPage.tsx
   - Baris 501: Ubah prioritas fallback nama produk

3. src/pages/buyer/BuyerChatPage.tsx
   - Fetch order_items per thread untuk tampilkan produk
   - Tambah thumbnail + product name di thread card

4. src/pages/merchant/MerchantChatPage.tsx
   - Sama seperti BuyerChatPage

5. src/pages/courier/CourierChatPage.tsx
   - Sama seperti BuyerChatPage

Total: 5 file
```

