
# Perbaikan Fitur Chat di Halaman Pesanan

## Masalah
1. **Double modal**: Komponen `OrderChat` sudah memiliki overlay full-screen sendiri, tapi dibungkus lagi dalam `Dialog` -- ini menyebabkan tampilan chat bermasalah (overlay ganda).
2. **Tombol chat hilang**: Pada fallback level 2+, kolom `merchants.user_id` tidak di-fetch, sehingga tombol "Hubungi Penjual" tidak muncul karena kondisi `order.merchants?.user_id` bernilai undefined.

## Rencana Perbaikan

### 1. Hapus pembungkus Dialog, gunakan OrderChat langsung
Komponen `OrderChat` sudah memiliki overlay dan modal sendiri (fixed inset-0). Cukup render `OrderChat` langsung tanpa `Dialog`/`DialogContent`.

### 2. Fetch merchant user_id secara terpisah jika tidak tersedia
Pada fallback level 2-4, tambahkan query terpisah untuk mengambil `user_id` dari tabel `merchants` berdasarkan `merchant_id` yang ada di pesanan. Ini memastikan tombol chat selalu muncul.

### 3. Pastikan tombol "Hubungi Penjual" muncul di semua pesanan aktif
Ubah kondisi tampil tombol agar tetap muncul meskipun `user_id` belum tersedia (akan di-fetch saat klik).

## Detail Teknis

```text
File: src/pages/OrdersPage.tsx

Perubahan:
1. Hapus blok Dialog (baris 609-629), ganti dengan render OrderChat langsung:
   {chatOrder && (
     <OrderChat
       orderId={chatOrder.orderId}
       otherUserId={chatOrder.merchantUserId}
       otherUserName={chatOrder.merchantName}
       isOpen={!!chatOrder}
       onClose={() => setChatOrder(null)}
     />
   )}

2. Setelah fetch orders (setelah image recovery), tambahkan fetch merchant user_id:
   - Kumpulkan merchant_id yang merchants-nya tidak punya user_id
   - Query merchants table untuk ambil user_id
   - Map kembali ke data orders

3. Update handleContactSeller:
   - Jika user_id belum ada, fetch dari merchants table saat klik
   - Baru buka chat setelah user_id didapat

4. Ubah kondisi tampil tombol dari:
   (order.merchants?.user_id || order.merchants?.phone)
   menjadi:
   (order.merchant_id || order.merchants?.phone)
   agar tombol selalu muncul untuk pesanan aktif
```
