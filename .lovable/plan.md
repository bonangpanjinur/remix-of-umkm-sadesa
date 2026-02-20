
# Perbaikan Halaman "Pesanan Saya" - Query Error 400

## Masalah

Halaman pesanan gagal memuat data karena query ke database mengembalikan error **400 Bad Request**. Ini terjadi karena query meminta kolom atau relasi yang tidak ada di skema database eksternal Anda:

- Kolom `is_self_delivery` dan `has_review` pada tabel `orders` mungkin belum ada
- Relasi nested `order_items -> products(name, image_url)` mungkin belum dikonfigurasi
- Kolom `product_id` pada `order_items` mungkin tidak memiliki FK ke `products`

Mekanisme fallback yang sudah ada masih gagal karena semua 3 level tetap meminta kolom yang bermasalah.

## Analisis Tabel Database

Berdasarkan skema yang didefinisikan:

**Tabel `orders`** -- kolom inti yang pasti ada:
- `id`, `buyer_id`, `merchant_id`, `courier_id`, `status`, `delivery_type`, `delivery_name`, `delivery_phone`, `delivery_address`, `subtotal`, `shipping_cost`, `total`, `notes`, `payment_method`, `payment_status`, `created_at`

**Kolom yang mungkin belum ada di DB eksternal:**
- `is_self_delivery`, `has_review` (ditambahkan belakangan)

**Tabel `order_items`** -- kolom inti:
- `id`, `order_id`, `product_id`, `product_name`, `product_price`, `quantity`, `subtotal`

**Tabel `merchants`** -- relasi:
- `name`, `phone` pasti ada; `user_id` mungkin ada

## Rencana Perbaikan

### 1. Perbaiki mekanisme fallback di `OrdersPage.tsx`

Ubah strategi fetch menjadi 4 level fallback yang lebih defensif:

- **Level 1**: Query lengkap (semua kolom + relasi merchants, order_items, products)
- **Level 2**: Tanpa nested `products`, tanpa `is_self_delivery`/`has_review`/`user_id`
- **Level 3**: Hanya orders + merchants(name, phone) tanpa order_items
- **Level 4**: Hanya kolom dasar orders (id, status, total, created_at, merchant_id) tanpa relasi apapun

### 2. Tambahkan penanganan data null yang lebih aman

Pastikan UI tidak crash ketika `is_self_delivery`, `has_review`, `order_items`, atau `merchants` bernilai null/undefined -- gunakan optional chaining dan default values di semua tempat.

### 3. Tambahkan retry limiter

Hapus retry loop tak terbatas yang menyebabkan ratusan request berulang saat error.

## Detail Teknis

```text
Perubahan file:
  src/pages/OrdersPage.tsx
    - Refactor fetchOrders() dengan fallback chain yang lebih robust
    - Level 4 fallback hanya pakai kolom dasar tanpa is_self_delivery/has_review
    - Tambah error state agar tidak retry terus-menerus
    - Pastikan semua akses data di UI menggunakan optional chaining
```

Perubahan hanya di 1 file: `src/pages/OrdersPage.tsx`. Tidak ada perubahan database diperlukan karena ini murni perbaikan di sisi frontend agar kompatibel dengan berbagai versi skema database.
