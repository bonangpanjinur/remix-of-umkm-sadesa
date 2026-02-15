
# Rencana Perbaikan OrdersPage.tsx

## Masalah yang Ditemukan

Ada **5 kategori error** yang harus diperbaiki:

### 1. `formatCurrency` tidak ada di `utils.ts`
- File `src/lib/utils.ts` hanya punya `formatPrice`, bukan `formatCurrency`
- **Solusi**: Ganti `formatCurrency` menjadi `formatPrice`

### 2. `useRealtimeOrders()` dipanggil tanpa argumen
- Hook ini membutuhkan parameter `{ merchantId }` (untuk pedagang), tapi halaman ini untuk **pembeli**
- Hook ini salah dipakai -- seharusnya halaman pembeli fetch pesanan berdasarkan `buyer_id`, bukan `merchant_id`
- **Solusi**: Buat query baru langsung di OrdersPage yang fetch orders berdasarkan `auth.uid()` sebagai buyer, termasuk join ke `merchants(name)` dan `order_items(*, products(name, image_url))`

### 3. `order.merchant` seharusnya `order.merchants`
- Supabase join menghasilkan key `merchants` (nama tabel), bukan `merchant`
- **Solusi**: Ganti `order.merchant?.name` menjadi `order.merchants?.name`

### 4. `order.items` tidak ada di `OrderRow`
- Data `order_items` tidak di-fetch oleh hook yang ada
- **Solusi**: Fetch `order_items` beserta `products` di query baru, dan tambahkan ke tipe data

### 5. `order.total_amount` seharusnya `order.total`
- Field di `OrderRow` adalah `total`, bukan `total_amount`
- **Solusi**: Ganti `order.total_amount` menjadi `order.total`

---

## Perubahan yang Akan Dilakukan

### File: `src/pages/OrdersPage.tsx` (tulis ulang logika data)

1. **Hapus import `useRealtimeOrders`** -- hook ini untuk merchant, bukan buyer
2. **Hapus import `formatCurrency`** -- ganti dengan `formatPrice` dari `@/lib/utils`
3. **Buat fetch orders inline** menggunakan `useAuth` + `supabase` query:
   ```
   SELECT *, merchants(name), order_items(*, products(name, image_url))
   FROM orders
   WHERE buyer_id = auth.uid()
   ORDER BY created_at DESC
   ```
4. **Definisikan interface `BuyerOrder`** yang mencakup `merchants`, `order_items`, dan `total`
5. **Perbaiki semua referensi**:
   - `order.merchant?.name` -> `order.merchants?.name`
   - `order.items` -> `order.order_items`
   - `order.total_amount` -> `order.total`
   - `formatCurrency` -> `formatPrice`
6. **Kembalikan import ke `@/` alias** (bukan relative path) agar konsisten dengan seluruh proyek
7. **Tambahkan skeleton loader** untuk loading state yang lebih baik
8. **Tambahkan state untuk user belum login** -- tampilkan pesan dan tombol login

### Tidak ada perubahan di file lain
- `useRealtimeOrders.ts` tetap utuh (digunakan oleh halaman merchant)
- `utils.ts` tetap utuh (sudah punya `formatPrice`)
