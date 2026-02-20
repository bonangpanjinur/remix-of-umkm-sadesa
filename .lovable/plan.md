

# Analisis Lengkap: Bug, UI/UX, dan Fitur yang Kurang

## A. Bug yang Masih Ada

### Bug 1: React forwardRef Warning (Console)
**Lokasi**: `ProtectedRoute.tsx` di `App.tsx`
**Detail**: Warning "Function components cannot be given refs" muncul berulang kali. `ProtectedRoute` mengembalikan `Navigate` component yang memicu warning ini.
**Dampak**: Tidak crash, tapi memenuhi console dan bisa menutupi error asli.
**Solusi**: Wrap `ProtectedRoute` dengan `React.forwardRef` atau ubah cara Navigate digunakan.

### Bug 2: Chat Nama "Memuat..." Masih Bisa Muncul
**Lokasi**: `OrderChat.tsx` baris 230
**Detail**: Jika pesan baru masuk via realtime SEBELUM `senderNames` selesai di-fetch, label menampilkan "Memuat..." karena `senderNames[id]` belum ada. Fix sebelumnya memoize key tapi tidak menangani kasus realtime insert dari sender baru.
**Solusi**: Tambahkan fallback fetch saat sender ID baru muncul dari realtime event.

### Bug 3: Merchant Dashboard - Sequential Fetch
**Lokasi**: `MerchantDashboardPage.tsx` baris 57-88
**Detail**: Fetch merchant dan orders dilakukan secara sequential (await merchant, lalu await orders). Ini memperlambat loading.
**Solusi**: Gabungkan dengan `Promise.all` setelah merchant ID didapat, fetch orders + stats secara paralel.

### Bug 4: Cart Total Duplikat di CartPage
**Lokasi**: `CartPage.tsx` baris 159-169
**Detail**: Menampilkan "Subtotal Produk" dan "Subtotal" dengan nilai yang sama. Redundan dan membingungkan user.
**Solusi**: Hapus salah satu, atau tambahkan estimasi ongkir agar terlihat bedanya.

### Bug 5: Produk "low_stock_threshold" Tidak Settable per Merchant
**Lokasi**: Products table
**Detail**: Field `low_stock_threshold` ada di database tapi merchant tidak bisa mengaturnya via Settings. Default-nya mungkin null, sehingga StockAlerts tidak berfungsi optimal.
**Solusi**: Tambahkan input threshold di form produk atau settings merchant.

---

## B. Analisis UI/UX - Buyer (Pembeli)

### B1. Navigasi (Sudah Dibahas, Belum Diimplementasi)
| Masalah | Detail |
|---------|--------|
| Tab Toko hilang dari BottomNav | Chat menggantikan Toko -- pembeli tidak bisa browse toko dengan cepat |
| Tidak ada ikon Keranjang di header | Pembeli harus scroll ke FloatingCartButton atau masuk lewat ProductDetail |
| Chat tidak punya akses cepat | Setelah dipindah dari BottomNav, butuh shortcut di header atau AccountPage |

### B2. Halaman Produk Detail
| Masalah | Rekomendasi |
|---------|-------------|
| Tidak ada galeri foto (hanya 1 foto) | Tambahkan swipeable image gallery |
| Tidak ada informasi berat/ukuran | Tambahkan field spesifikasi produk |
| Tidak ada estimasi waktu pengiriman | Tampilkan ETA berdasarkan jarak |
| Quantity selector tidak ada batasan visual | Tampilkan warning saat mendekati stok habis |

### B3. Halaman Checkout
| Masalah | Rekomendasi |
|---------|-------------|
| Form alamat panjang tanpa auto-fill | Integrasikan dengan Alamat Tersimpan (saved_addresses) untuk auto-populate |
| Tidak ada ringkasan produk yang clear | Tampilkan thumbnail produk di summary |
| Tidak ada estimasi waktu sampai | Tampilkan ETA delivery |

### B4. Halaman Pesanan
| Masalah | Rekomendasi |
|---------|-------------|
| Progress bar ada tapi kecil (h-1.5) | Perbesar dan tambahkan step labels |
| Tidak ada fitur "Lacak Pengiriman" secara real-time di peta | Tambahkan peta tracking kurir |
| Tombol aksi (bayar/cancel/review) posisinya tidak konsisten | Standardisasi layout tombol aksi |

### B5. Fitur yang Kurang untuk Buyer
1. **Notifikasi Push** - Infrastruktur ada tapi belum ada prompt permission yang user-friendly
2. **Filter harga** di halaman Explore/Search - Belum bisa filter range harga
3. **Riwayat pencarian** - Hook `useSearchHistory` ada tapi belum ditampilkan di UI
4. **Voucher/Kupon** - Sistem ada tapi buyer tidak bisa melihat daftar voucher yang tersedia sebelum checkout
5. **Rating & Review dengan foto** - Sudah bisa upload tapi preview foto sebelum submit belum optimal

---

## C. Analisis UI/UX - Merchant (Penjual)

### C1. Dashboard
| Masalah | Rekomendasi |
|---------|-------------|
| Terlalu banyak card di halaman utama | Prioritaskan: Welcome + Pending Orders + Quick Stats, sisanya di tab |
| Chart revenue 14 hari terlalu padat di mobile | Gunakan 7 hari default, toggle ke 14/30 |
| Tidak ada ringkasan pendapatan hari ini yang prominent | Buat card pendapatan hari ini yang besar dan mencolok |

### C2. Manajemen Produk
| Masalah | Rekomendasi |
|---------|-------------|
| Form tambah produk hanya 1 gambar | Sudah ada `MultipleImageUpload` component tapi belum dipakai di form produk |
| Tidak ada fitur duplikasi produk | Tambahkan "Duplikat" di dropdown menu produk |
| Tidak ada preview produk sebelum publish | Tambahkan preview mode |
| Tidak ada bulk update harga/stok | DataTable ada BulkActions tapi belum untuk stok/harga |

### C3. Manajemen Pesanan
| Masalah | Rekomendasi |
|---------|-------------|
| Notifikasi sound ada tapi tidak ada visual alert yang persistent | Tambahkan banner sticky "X pesanan baru" |
| Tidak ada fitur print label pengiriman | Tambahkan generate label/resi |
| Self-delivery status tracking kurang detail | Tambahkan step-by-step status untuk self delivery |

### C4. Pengaturan Toko
| Masalah | Rekomendasi |
|---------|-------------|
| Form terlalu panjang (1 scroll tanpa section) | Sudah pakai Card sections -- OK tapi bisa collapsible |
| Tidak ada preview toko setelah edit | Tambahkan "Lihat Toko Saya" button yang prominent |
| Cover image tidak bisa diubah | Tambahkan upload cover image |
| Tidak ada pengaturan hari libur/off day | Tambahkan fitur jadwal tutup per hari |

### C5. Fitur yang Kurang untuk Merchant
1. **Analitik konversi** - Berapa view yang jadi order (conversion rate)
2. **Template pesan otomatis** - Auto-reply saat toko tutup atau pesanan diterima
3. **Pengaturan minimal order** - Minimum pembelian per transaksi
4. **Notifikasi stok habis** via push/email - Ada StockAlerts tapi hanya di dashboard
5. **Export laporan keuangan** ke PDF - SalesExport ada tapi hanya CSV
6. **Multi-image produk** - Component `MultipleImageUpload` sudah ada tapi belum terintegrasi di form produk

---

## D. Prioritas Perbaikan

### Tinggi (Harus segera)
1. Fix navigasi BottomNav (kembalikan Toko, pindahkan Chat ke header)
2. Tambahkan ikon Keranjang + Chat di Header
3. Fix chat sender name untuk realtime messages
4. Integrasikan saved_addresses di Checkout

### Sedang (Penting)
5. Merchant: multi-image produk
6. Merchant: parallel fetch di dashboard
7. Buyer: tampilkan riwayat pencarian
8. Buyer: filter harga di Explore
9. Fix CartPage subtotal duplikat

### Rendah (Nice to have)
10. Merchant: jadwal tutup per hari
11. Merchant: template auto-reply
12. Buyer: galeri foto produk swipeable
13. Fix React forwardRef warnings

---

## E. Rencana Implementasi Teknis

### File yang Perlu Dimodifikasi:

1. **`src/components/layout/BottomNav.tsx`**
   - Ganti Chat dengan Store/Toko
   - Gabungkan badge chat unread ke badge Pesanan

2. **`src/components/layout/Header.tsx`**
   - Tambahkan ikon ShoppingCart dengan badge dari `useCart()`
   - Tambahkan ikon MessageCircle dengan badge dari `useChatUnread()`

3. **`src/pages/AccountPage.tsx`**
   - Tambahkan quick access grid: Chat, Wishlist, Alamat, Bantuan

4. **`src/components/chat/OrderChat.tsx`**
   - Handle sender baru dari realtime event

5. **`src/pages/CartPage.tsx`**
   - Hapus duplikasi subtotal

6. **`src/pages/CheckoutPage.tsx`**
   - Auto-populate dari saved_addresses jika ada default

7. **`src/pages/merchant/MerchantDashboardPage.tsx`**
   - Parallel fetch dengan `Promise.all`

8. **`src/pages/merchant/MerchantProductsPage.tsx`**
   - Integrasikan `MultipleImageUpload` di form produk

### Tidak Ada Perubahan Database
Semua perbaikan ini murni frontend. Database sudah siap (saved_addresses, chat_messages, dll sudah ada).

