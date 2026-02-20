

# Perbaikan Komprehensif Dashboard Merchant

## 6 Masalah Utama & Solusi

---

### 1. Menu Pesanan: Pilihan Antar Sendiri vs Kurir Desa

**Masalah:** Saat pembeli memilih "Diantar", merchant langsung mengirim ke status SENT tanpa memilih metode pengiriman. Kolom `is_self_delivery` digunakan di kode (`OrderDetailsDialog.tsx`) tapi **tidak ada di database**.

**Solusi:**
- Tambah kolom `is_self_delivery` (boolean, default false) ke tabel `orders` via migrasi
- Modifikasi dialog detail pesanan di `MerchantOrdersPage.tsx`: saat status PROCESSED dan delivery_type = INTERNAL, tampilkan dialog pilihan "Antar Sendiri" atau "Kurir Desa"
- Jika antar sendiri: set `is_self_delivery = true`, status -> DELIVERING (status baru untuk self-delivery)
- Jika kurir desa: buka dialog assign kurir, status -> SENT
- Tambah status DELIVERING di status map merchant & buyer pages
- Merchant bisa update status: DELIVERING -> DELIVERED -> DONE

**File yang diubah:**
- Migrasi SQL: tambah kolom `is_self_delivery`
- `src/pages/merchant/MerchantOrdersPage.tsx`: tambah delivery choice dialog & status DELIVERING
- `src/hooks/useRealtimeOrders.ts`: tambah DELIVERING di status handling
- `src/pages/OrdersPage.tsx`: tambah DELIVERING di STATUS_CONFIG

---

### 2. URL `/merchant/pos/subscribe` Error 404

**Masalah:** Route sudah terdaftar di `App.tsx` (baris 528) dan komponen `MerchantPOSSubscribePage.tsx` sudah lengkap. Kemungkinan error karena nested route di bawah `ProtectedRoute` yang menolak akses (role belum terdaftar atau belum login).

**Solusi:**
- Verifikasi route ordering di `App.tsx` - pastikan `/merchant/pos/subscribe` didefinisikan SEBELUM `/merchant/pos` (route yang lebih spesifik harus di atas)
- Tambahkan route `/merchant/pos/settings` yang juga perlu diatas `/merchant/pos`
- Urutkan kembali route merchant di App.tsx

**File yang diubah:**
- `src/App.tsx`: reorder merchant routes

---

### 3. Handle 404 Error Pages

**Masalah:** Halaman 404 (`NotFound.tsx`) sudah ada dan terdaftar sebagai catch-all di App.tsx. Ini sudah berfungsi. Yang perlu diperbaiki adalah integrasi 404 di level merchant (slug not found sudah diperbaiki sebelumnya).

**Solusi:** Tidak perlu perubahan - sudah diimplementasi. Cukup pastikan MerchantSlugResolver (sudah diperbaiki sebelumnya) menangani kasus tidak ditemukan dengan benar.

---

### 4. Chat Pembeli-Pedagang di Sisi Pembeli

**Masalah:** Komponen `OrderChat` sudah ada dan berfungsi. Di sisi merchant sudah terintegrasi via `MerchantChatPage`. Di sisi buyer:
- `OrderDetailSheet.tsx` sudah ada tombol chat tapi hanya muncul jika order punya merchant user_id
- `OrdersPage.tsx` hanya mengarahkan ke WhatsApp (`handleContactSeller`), tidak ada chat in-app

**Solusi:**
- Di `OrdersPage.tsx`: ganti tombol "Hubungi Penjual" dari WhatsApp ke chat in-app menggunakan `OrderChat`
- Tambah state untuk chat: `chatOrderId`, `chatMerchantUserId`, `chatMerchantName`
- Klik "Hubungi Penjual" -> buka `OrderChat` modal
- Fallback ke WhatsApp jika merchant tidak punya `user_id` (data sudah ada via `merchants(name, phone)` - perlu tambah `user_id` di query)

**File yang diubah:**
- `src/pages/OrdersPage.tsx`: tambah import OrderChat, state chat, ubah handler, tambah query `merchants(name, phone, user_id)`

---

### 5. Voucher/Promo di Halaman Checkout

**Masalah:** Komponen `VoucherInput` sudah dibuat lengkap di `src/components/checkout/VoucherInput.tsx` dan fungsi database `apply_voucher` sudah ada. Tapi **tidak digunakan di CheckoutPage.tsx**.

**Solusi:**
- Import `VoucherInput` di `CheckoutPage.tsx`
- Tambah state untuk voucher: `appliedVoucher` (id, name, discount)
- Sisipkan komponen `VoucherInput` di antara ringkasan pesanan dan catatan
- Kurangi total dengan discount voucher
- Kirim `voucher_id` saat insert order (jika kolom tersedia)

**File yang diubah:**
- `src/pages/CheckoutPage.tsx`: import VoucherInput, tambah state & logic voucher, update total calculation

---

### 6. Integrasi Merchant-Buyer Lainnya

**Masalah yang ditemukan dari analisis:**

| Issue | Detail |
|-------|--------|
| Status DELIVERING tidak dikenali buyer | OrdersPage & OrderDetailSheet tidak punya mapping untuk DELIVERING |
| `order_items` query di buyer join products salah | Query join `products(name, image_url)` mungkin gagal jika product_id null |
| Merchant delivery badge salah label | Baris 513: selalu tampil "Diantar Kurir" padahal bisa "Antar Sendiri" |

**Solusi:**
- Tambah DELIVERING ke STATUS_CONFIG di `OrdersPage.tsx` dan `OrderDetailSheet.tsx`
- Perbaiki label delivery di `MerchantOrdersPage.tsx` baris 513 untuk membedakan self delivery vs kurir
- Update `OrderTrackingPage.tsx` jika perlu untuk menampilkan status DELIVERING

---

## Ringkasan Perubahan

| # | File | Perubahan |
|---|------|-----------|
| 1 | **Migrasi SQL** | Tambah kolom `is_self_delivery` boolean default false |
| 2 | `src/pages/merchant/MerchantOrdersPage.tsx` | Dialog pilihan pengiriman (antar sendiri/kurir), status DELIVERING, label delivery yang benar |
| 3 | `src/App.tsx` | Reorder routes merchant (pos/subscribe & pos/settings sebelum pos) |
| 4 | `src/pages/OrdersPage.tsx` | Chat in-app, status DELIVERING, query tambah user_id |
| 5 | `src/pages/CheckoutPage.tsx` | Integrasi VoucherInput |
| 6 | `src/hooks/useRealtimeOrders.ts` | Tidak perlu diubah (sudah handle semua status) |
| 7 | `src/components/order/OrderDetailSheet.tsx` | Tambah DELIVERING di statusTimeline |

**Total: 1 migrasi + 5 file diubah**

