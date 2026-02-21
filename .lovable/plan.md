
# Analisis Bug Menu Pesanan & Pesanan Saya

## Bug yang Ditemukan

### Bug 1: Tombol "Batalkan" muncul untuk status PENDING_PAYMENT tapi OrderCancelDialog hanya mengizinkan status NEW dan PENDING_CONFIRMATION
- **File**: `OrdersPage.tsx` baris 65 vs `OrderCancelDialog.tsx` baris 71
- **Masalah**: `PENDING_STATUSES` di OrdersPage mencakup `["NEW", "PENDING_PAYMENT", "PENDING_CONFIRMATION"]`, sehingga tombol "Batalkan" muncul untuk pesanan PENDING_PAYMENT. Namun `OrderCancelDialog` hanya mengizinkan cancel untuk `.in('status', ['NEW', 'PENDING_CONFIRMATION'])`. Artinya user klik Batalkan pada pesanan PENDING_PAYMENT, dialog muncul, tapi update ke database gagal tanpa error yang jelas (RLS/query mengembalikan 0 rows updated tanpa error).
- **Perbaikan**: Sinkronkan status yang diizinkan -- tambahkan `PENDING_PAYMENT` ke `OrderCancelDialog` atau hapus tombol Batalkan untuk status tersebut.

### Bug 2: Stale closure pada realtime di OrderTrackingPage
- **File**: `OrderTrackingPage.tsx` baris 82
- **Masalah**: Di dalam callback realtime, `courier` diakses dari closure tapi `courier` tidak ada di dependency array useEffect (baris 95). Kondisi `!courier` selalu `true` pada saat subscription dibuat, sehingga setiap update akan memicu `fetchCourierInfo` ulang meskipun courier sudah di-load.
- **Perbaikan**: Gunakan ref atau functional state update untuk mengecek courier.

### Bug 3: OrderTrackingPage tidak menampilkan daftar item pesanan
- **File**: `OrderTrackingPage.tsx`
- **Masalah**: Halaman tracking hanya menampilkan status, kurir, alamat, dan ringkasan harga. Tidak ada daftar produk yang dipesan. Buyer harus kembali ke halaman sebelumnya untuk melihat apa yang mereka pesan. Ini UX yang kurang lengkap.
- **Perbaikan**: Tambahkan fetch `order_items` dan tampilkan daftar produk.

### Bug 4: DeliveryStatusCard tidak menangani status PROCESSED dan READY
- **File**: `DeliveryStatusCard.tsx` baris 6, 19
- **Masalah**: Status `PROCESSED` dan `READY` ada di database constraint tapi tidak ada di `statusSteps`. Ketika pesanan dalam status PROCESSED, step "Pesanan Dibuat" sudah selesai tapi tidak ada step "Diproses" -- langsung ke "Kurir Ditugaskan". Timeline terlihat loncat.
- **Perbaikan**: Tambahkan step "Sedang Diproses" di antara "Pesanan Dibuat" dan "Kurir Ditugaskan".

### Bug 5: Tombol "Bayar Sekarang" muncul untuk semua PENDING_STATUSES termasuk PENDING_CONFIRMATION
- **File**: `OrdersPage.tsx` baris 590-606
- **Masalah**: Untuk pesanan status PENDING_CONFIRMATION (menunggu konfirmasi penjual), tombol "Bayar Sekarang" tetap muncul. Seharusnya bayar hanya relevan untuk NEW atau PENDING_PAYMENT, bukan saat menunggu konfirmasi merchant.
- **Perbaikan**: Tampilkan "Bayar Sekarang" hanya untuk `NEW` dan `PENDING_PAYMENT`. Untuk `PENDING_CONFIRMATION`, tampilkan label "Menunggu Konfirmasi" saja.

### Bug 6: Console warning -- Header dan BottomNav tidak mendukung ref
- **File**: `AccountPage.tsx`
- **Masalah**: Console menunjukkan "Function components cannot be given refs" untuk `Header` dan `BottomNav`. Ini terjadi karena komponen ini digunakan di dalam konteks yang mencoba memberi ref tapi komponen belum menggunakan `forwardRef`.
- **Perbaikan**: Wrap `Header` dan `BottomNav` dengan `React.forwardRef` atau pastikan tidak ada ref yang dicoba diberikan.

### Bug 7: OrderTrackingPage tidak memverifikasi kepemilikan pesanan
- **File**: `OrderTrackingPage.tsx` baris 102-106
- **Masalah**: Query `orders` hanya filter `.eq('id', orderId)` tanpa `.eq('buyer_id', user.id)`. Siapapun yang tahu order ID bisa melihat detail pesanan orang lain (RLS di database mungkin sudah mencegah ini, tapi lebih aman menambahkan filter eksplisit).
- **Perbaikan**: Tambahkan `.eq('buyer_id', user.id)` pada query.

---

## Rencana Perbaikan

### Prioritas 1 -- Bug Kritis
1. **Sinkronisasi status cancel** -- Tambahkan `PENDING_PAYMENT` ke query cancel dialog, atau pisahkan tombol Batalkan dan Bayar berdasarkan status yang tepat
2. **Fix stale closure tracking page** -- Gunakan ref untuk courier state di realtime callback
3. **Verifikasi kepemilikan pesanan** -- Tambah filter `buyer_id` di OrderTrackingPage query

### Prioritas 2 -- UX Improvement
4. **Pisahkan aksi per status**:
   - `NEW` / `PENDING_PAYMENT`: Tampilkan "Bayar Sekarang" + "Batalkan"
   - `PENDING_CONFIRMATION`: Tampilkan "Menunggu Konfirmasi" (tanpa tombol bayar) + "Batalkan"
5. **Tambah step PROCESSED di DeliveryStatusCard** -- Agar timeline tidak loncat
6. **Tambah daftar item di OrderTrackingPage** -- Fetch dan tampilkan order_items

### Prioritas 3 -- Minor Fix
7. **Fix console warning ref** -- Wrap Header/BottomNav dengan forwardRef atau hapus ref usage

---

## Detail Teknis

```text
File yang perlu diubah:

1. src/components/order/OrderCancelDialog.tsx
   - Baris 71: Tambah 'PENDING_PAYMENT' ke .in('status', [...])

2. src/pages/OrdersPage.tsx
   - Baris 590-607: Pisahkan logika tombol:
     * status NEW/PENDING_PAYMENT -> "Bayar Sekarang" + "Batalkan"
     * status PENDING_CONFIRMATION -> "Menunggu Konfirmasi" + "Batalkan"

3. src/pages/OrderTrackingPage.tsx
   - Baris 82: Fix stale closure courier dengan useRef
   - Baris 102-106: Tambah .eq('buyer_id', user.id)
   - Tambah fetch order_items dan section daftar produk

4. src/components/courier/DeliveryStatusCard.tsx
   - Baris 19-24: Tambah step { key: 'PROCESSED', label: 'Sedang Diproses', icon: Package }
   - Baris 6: Tambah 'PROCESSED' ke interface union type

5. src/components/layout/Header.tsx
   - Wrap dengan React.forwardRef untuk mengatasi console warning

6. src/components/layout/BottomNav.tsx
   - Wrap dengan React.forwardRef untuk mengatasi console warning

Total: 6 file, ~8 perbaikan
```
