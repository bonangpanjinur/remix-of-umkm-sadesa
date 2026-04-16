

# Audit Pre-Launch Komprehensif — Customer-Facing Focus

---

## STATUS: Apa yang Sudah Baik

| Area | Status |
|------|--------|
| Auth (Login/Register/Reset Password) | OK — Zod validation, email verification |
| Homepage (Produk, Wisata, Desa, Kategori, Banner) | OK — Cache, sort by proximity, "Lihat Lebih Banyak" |
| Cart + Checkout (COD/Transfer/Online, stok validasi, ongkir) | OK |
| Order Tracking (Realtime, ETA, Peta, Chat) | OK |
| Pesanan Saya (Realtime status update, Reorder, Cancel) | OK |
| Wishlist + Terakhir Dilihat + Review | OK |
| Search + Filter + Kategori | OK |
| Bottom Nav + Badge (orders, chat, notif) | OK |
| Empty States (ShopsPage, ExplorePage) | OK |
| Safe Navigation (safeGoBack di semua halaman) | OK |
| API Cache (60s TTL) | OK |
| ErrorBoundary global | OK |
| SEO dinamis per halaman | OK |
| PWA (manifest, offline indicator, install prompt) | OK |
| 404 Page | OK — desain kustom |

---

## YANG PERLU DIPERBAIKI SEBELUM LAUNCH

### A. BUG / STABILITY (4 item)

**A1. `.single()` Masih Ada di INSERT Queries (LOW-MEDIUM)**
Ada ~12 lokasi `.single()` pada INSERT `.select().single()`. Ini AMAN untuk insert (selalu 1 row), tapi berisiko jika insert gagal karena constraint. File: `CheckoutPage`, `RideBookingPage`, `RegisterVillagePage`, `MerchantPOSPage`, `AssignPackageDialog`, `VillageAddDialog`, `useSavedAddresses`. **Tidak blocking**, tapi best practice ganti `.maybeSingle()`.

**A2. Edge Functions `.single()` Tanpa Guard (MEDIUM)**
`xendit-payment/index.ts` dan `xendit-webhook/index.ts` pakai `.single()` saat fetch `payment_xendit` settings. Jika setting belum dikonfigurasi, function crash 500. Perlu `.maybeSingle()` + error response.

**A3. RLS "Always True" Masih Ada 1 (MEDIUM)**
Linter masih menemukan 1 policy permisif. Perlu identifikasi tabel mana dan perketat.

**A4. 12 Public Bucket Allows Listing (LOW)**
Semua bucket publik bisa di-list file-nya. Ini by-design untuk marketplace, tapi bucket `payment-proofs` dan `courier-documents` seharusnya TIDAK bisa di-list publik.

### B. FITUR CUSTOMER YANG KURANG (6 item)

**B1. Tidak Ada Google Sign-In (HIGH)**
AuthPage hanya punya email/password. Tidak ada tombol "Login dengan Google". Untuk marketplace consumer, ini sangat penting untuk mengurangi friction signup.

**B2. Tidak Ada Halaman Kebijakan Privasi & Syarat Ketentuan (MEDIUM)**
SettingsPage menampilkan "Kebijakan Privasi" dan "Syarat & Ketentuan" tapi disabled dengan label "Segera hadir". Sebelum launch, ini WAJIB ada — terutama jika ada pembayaran dan data pribadi.

**B3. Tidak Ada Loading Skeleton di ProductsPage, TourismPage, ShopsPage (LOW-MEDIUM)**
Saat data loading, halaman-halaman ini hanya blank/kosong. Homepage (`Index.tsx`) sudah punya skeleton yang bagus, tapi halaman lain belum.

**B4. HelpPage Menggunakan Nomor WA Default Hardcoded (MEDIUM)**
`const DEFAULT_WA = '6281234567890'` dan `DEFAULT_EMAIL = 'support@desamart.id'` — ini placeholder yang harus diganti dengan kontak real atau diambil dari `app_settings`.

**B5. Tidak Ada Konfirmasi Email Setelah Daftar yang User-Friendly (LOW)**
Setelah signup, hanya muncul toast singkat. Tidak ada halaman khusus "Cek email Anda" dengan instruksi lengkap dan tombol resend.

**B6. ProductsPage Tidak Ada Fitur Sort (LOW-MEDIUM)**
Tidak ada opsi sort (termurah, terbaru, rating tertinggi). Hanya filter kategori dan search. Untuk marketplace, sorting sangat penting.

### C. UX POLISH (4 item)

**C1. Checkout Tidak Ada Indikator "Toko Tutup" yang Jelas Sebelum Submit**
Meskipun ada validasi saat submit, pembeli bisa mengisi form panjang dulu baru ditolak. Perlu banner warning di awal jika ada merchant yang tutup.

**C2. Tidak Ada Konfirmasi Dialog Sebelum Keluar Checkout**
Jika user sudah isi data alamat lalu klik back, semua data hilang tanpa konfirmasi.

**C3. Cart Badge di Header Tidak Animasi Saat Berubah**
Saat add to cart, badge angka berubah tapi tidak ada visual feedback (bounce, pulse).

**C4. Notifications Page Tidak Ada Filter/Tabs**
Semua notifikasi ditampilkan dalam satu list tanpa pemisahan (Pesanan, Promo, System).

---

## RENCANA IMPLEMENTASI

### Fase 1 — Critical Pre-Launch (5 item, HIGH priority)
1. **Tambah Google Sign-In** di AuthPage — tombol "Masuk dengan Google" + konfigurasi OAuth
2. **Buat halaman Kebijakan Privasi & Syarat Ketentuan** — 2 halaman statis sederhana + link dari SettingsPage dan footer AuthPage
3. **Fix HelpPage kontak** — ambil WA/email dari `app_settings` bukan hardcoded
4. **Fix edge function `.single()`** — `xendit-payment` dan `xendit-webhook`
5. **Fix RLS policy always true** yang tersisa — identifikasi dan perketat

### Fase 2 — Customer UX (4 item, MEDIUM priority)
6. **Tambah loading skeleton** di ProductsPage, TourismPage, ShopsPage
7. **Tambah fitur Sort** di ProductsPage (Termurah, Termahal, Terbaru, Rating)
8. **Banner merchant tutup di checkout** — tampilkan warning di awal, bukan hanya saat submit
9. **Halaman "Cek Email"** setelah signup — dengan instruksi dan tombol resend

### Fase 3 — Polish (3 item, LOW priority)
10. **Animasi cart badge** — pulse/bounce saat item ditambah
11. **Tabs di NotificationsPage** — Semua / Pesanan / Promo
12. **Konfirmasi keluar checkout** — dialog "Yakin ingin kembali?"

**Total: ~14 file diubah/ditambah, 1 migrasi SQL (RLS fix), 1 konfigurasi auth (Google OAuth)**

