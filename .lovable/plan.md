
# Analisis Bug Pesanan Kosong dan Perbaikan UX Checkout

## A. Bug Halaman "Pesanan Saya" Kosong

### Temuan
Database **benar-benar kosong** -- 0 pesanan di tabel `orders`. Ini bukan bug RLS atau bug kode. Query dan RLS policy sudah benar (`buyer_id = auth.uid()`).

**Penyebab yang paling mungkin:** Pesanan gagal dibuat saat checkout, atau user belum pernah berhasil checkout.

### Masalah Terkait: Empty State Kurang Informatif
Saat ini jika tidak ada pesanan, halaman hanya menampilkan area kosong tanpa pesan yang jelas. Ini membuat user bingung apakah ada bug atau memang belum ada pesanan.

**Solusi**: Tambahkan empty state yang informatif di halaman OrdersPage dengan pesan "Belum ada pesanan" dan tombol "Mulai Belanja".

---

## B. Analisis UX Checkout dan Rencana Perbaikan

### B1. Masalah yang Ditemukan

| No | Masalah | Dampak |
|----|---------|--------|
| 1 | **Tidak ada ringkasan jumlah item di header** | User tidak tahu berapa item yang di-checkout |
| 2 | **Form alamat muncul sebelum ringkasan produk** | User harus scroll jauh ke bawah untuk melihat apa yang mereka beli |
| 3 | **Alamat tersimpan tersembunyi di balik accordion** | User mungkin tidak sadar ada fitur ini |
| 4 | **Peta wajib diisi meski pilih "Ambil Sendiri"** | Validasi memaksa titik lokasi padahal tidak relevan untuk pickup |
| 5 | **Bottom fixed summary menutupi konten** | `pb-56` di form, tapi summary bar cukup tinggi dan bisa menutupi catatan/voucher |
| 6 | **Tidak ada loading indicator saat auto-populate alamat** | Form terlihat kosong sesaat sebelum data profil dimuat |
| 7 | **Error message generik** | "Data belum lengkap" tanpa menunjukkan field mana yang salah (scroll ke error) |

### B2. Rencana Perbaikan

#### Perbaikan 1: Empty State di OrdersPage
**File**: `src/pages/OrdersPage.tsx`
- Cek blok `filteredOrders.length === 0` (sudah ada tapi perlu dipastikan ada untuk tab "Semua")
- Tambahkan ilustrasi, pesan "Belum ada pesanan", dan tombol "Mulai Belanja"

#### Perbaikan 2: Reorder Seksi Checkout -- Ringkasan Produk di Atas
**File**: `src/pages/CheckoutPage.tsx`
- Pindahkan "Ringkasan Pesanan" (saat ini di baris 938-966) ke posisi PERTAMA sebelum alamat
- User langsung melihat apa yang mereka beli

#### Perbaikan 3: Sembunyikan Peta Saat "Ambil Sendiri"
**File**: `src/pages/CheckoutPage.tsx`
- Pass prop `deliveryType` ke `CheckoutAddressForm`
- Sembunyikan `LocationPicker` jika `deliveryType === 'PICKUP'`
- Skip validasi lokasi jika pickup

#### Perbaikan 4: Loading State Saat Auto-Populate
**File**: `src/components/checkout/CheckoutAddressForm.tsx`
- Tampilkan skeleton/spinner saat `!profileLoaded`
- Beri feedback visual bahwa data sedang dimuat

#### Perbaikan 5: Scroll ke Error Field
**File**: `src/pages/CheckoutPage.tsx`
- Setelah `validateForm()` gagal, scroll ke field pertama yang error menggunakan `document.querySelector`

#### Perbaikan 6: Tambahkan Jumlah Item di Header Checkout
**File**: `src/pages/CheckoutPage.tsx`
- Tambahkan badge jumlah item di header: "Checkout (3 item)"

### Detail Teknis Perubahan

**`src/pages/OrdersPage.tsx`**
- Di blok `filteredOrders.length === 0` (setelah loading selesai), pastikan ada empty state dengan ikon, teks, dan tombol CTA

**`src/pages/CheckoutPage.tsx`**
- Pindahkan blok "Ringkasan Pesanan" ke atas, sebelum blok "Alamat Pengiriman"
- Header: tambahkan `({items.length} item)` di samping "Checkout"
- Validasi: skip cek lokasi jika `deliveryType === 'PICKUP'`
- Setelah `validateForm()` return false: `document.querySelector('.text-destructive')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`

**`src/components/checkout/CheckoutAddressForm.tsx`**
- Tambahkan prop `hideMap?: boolean`
- Jika `hideMap` true, sembunyikan section LocationPicker
- Tambahkan loading skeleton sebelum `profileLoaded`

### Tidak Ada Perubahan Database
Semua perbaikan ini murni frontend.
