# Fix 404 Hosting Error & Peningkatan Buyer Experience

## Masalah 404: NOT_FOUND (Level Hosting)

### Analisis

Error `sin1::tx6rt-...` adalah error **server-side**, bukan React Router. Saat user mengakses URL langsung (misalnya `sadesa.site/auth` atau `sadesa.site/merchant/tokocake`), server mencari file fisik di path tersebut. Karena ini SPA (Single Page Application), semua request harus diarahkan ke `index.html`.

### Solusi

Tambahkan file `public/_redirects` untuk SPA fallback. File ini akan disertakan saat build dan memberitahu hosting server bahwa semua route harus diarahkan ke `index.html` dengan status 200.

**File baru: `public/_redirects**`

```
/*    /index.html   200
```

Sebagai backup, tambahkan juga `public/404.html` yang melakukan redirect otomatis ke halaman utama dengan hash routing fallback.

**File baru: `public/404.html**`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>
    // Redirect ke index.html dengan path sebagai query parameter
    var path = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace('/' + '?redirect=' + encodeURIComponent(path));
  </script>
</head>
<body></body>
</html>
```

Lalu di `src/App.tsx`, tambahkan handler untuk query parameter `redirect` agar user diarahkan ke halaman yang benar setelah redirect dari 404.html.

---

## Peningkatan Buyer Experience

### 1. Recently Viewed Products - Perbaikan Integrasi

**File:** `src/pages/buyer/RecentlyViewedPage.tsx`

Halaman sudah ada tapi tracking otomatis dari `ProductDetail.tsx` perlu diperkuat. Tambahkan localStorage-based tracking agar riwayat produk yang dilihat tersimpan meski tanpa login.

### 2. Quick Reorder dari Riwayat Pesanan

**File baru:** Tombol "Pesan Lagi" di `OrdersPage.tsx`

Untuk pesanan dengan status DONE, tambahkan tombol "Pesan Lagi" yang otomatis menambahkan semua item dari pesanan sebelumnya ke keranjang.

**Perubahan di `src/pages/OrdersPage.tsx`:**

- Tambah tombol "Pesan Lagi" untuk order dengan status DONE
- Handler yang menambahkan semua order_items ke cart via CartContext

### 3. Estimasi Waktu Pengiriman di Checkout

**File:** `src/pages/CheckoutPage.tsx`

Tampilkan estimasi waktu pengiriman berdasarkan jarak (sudah ada `etaCalculation.ts`). Integrasikan ke halaman checkout agar buyer tahu perkiraan kapan pesanan sampai.

### 4. Rating & Review Setelah Pesanan Selesai

**File:** `src/pages/OrdersPage.tsx`

Untuk pesanan DONE yang belum direview, tampilkan prompt/badge "Beri Rating" yang mengarahkan ke halaman review.

### 5. Notifikasi Status Pesanan Real-time

**File:** `src/pages/OrdersPage.tsx`

Tambahkan Supabase realtime subscription agar status pesanan di halaman buyer terupdate otomatis tanpa perlu refresh halaman.  
  
6. di profil ada alamat tersimpan, tolong integrasikan dengan halaman checkout.(pilih alamat/ada alamat default)

---

## Ringkasan Perubahan


| #   | File                          | Perubahan                                                 |
| --- | ----------------------------- | --------------------------------------------------------- |
| 1   | `public/_redirects` (baru)    | SPA fallback rule                                         |
| 2   | `public/404.html` (baru)      | Fallback redirect page                                    |
| 3   | `src/App.tsx`                 | Handle redirect query param dari 404.html                 |
| 4   | `src/pages/OrdersPage.tsx`    | Tombol "Pesan Lagi", prompt review, realtime subscription |
| 5   | `src/pages/CheckoutPage.tsx`  | Estimasi waktu pengiriman                                 |
| 6   | `src/pages/ProductDetail.tsx` | Perkuat tracking recently viewed via localStorage         |


**Total: 2 file baru + 4 file diubah**