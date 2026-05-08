# DesaMart Platform — Progress Aktual

> Terakhir diperbarui: berdasarkan analisis kode aktual
> Platform: React 18 + TypeScript + Vite + Supabase
> Diverifikasi dengan memeriksa file `.tsx` di `src/pages/`, routes di `App.tsx`, dan migration SQL di `supabase/migrations/`

---

## Ringkasan Status Keseluruhan

| Modul | Status |
|-------|--------|
| Marketplace Core (Produk, Keranjang, Checkout, Order) | ✅ Selesai |
| Registrasi (Desa, Merchant, Kurir) | ✅ Selesai |
| Sistem Kurir & Pengiriman | ✅ Selesai |
| Ojek Desa (Ride-sharing) | ✅ Selesai |
| Chat (Buyer, Merchant, Kurir) | ✅ Selesai |
| Ulasan & Rating | ✅ Selesai |
| Halal Sertifikasi | ✅ Selesai |
| Sistem Kuota & Paket Merchant | ✅ Selesai |
| Promosi Marketplace (Flash Sale, Voucher, Cashback) | ✅ Selesai |
| Referral & Loyalty Buyer | ✅ Selesai |
| Kelompok Usaha / Trade Groups | ✅ Selesai |
| Verifikator (Referral, Komisi, Kas) | ✅ Selesai |
| Admin Desa (Panel Desa Wisata) | ✅ Selesai |
| Admin Platform (Full Suite) | ✅ Selesai |
| POS SaaS Phase 1 (Core + Master Data + Stok) | ✅ Selesai |
| POS SaaS Phase 2 (Pembelian & Kas Harian) | ✅ Selesai |
| POS SaaS Phase 3 (Laporan Lanjutan & Analitik) | ✅ Selesai |
| POS SaaS Phase 4 (Multi-outlet & Audit Trail) | ✅ Selesai |
| POS SaaS Phase 5 (Loyalty & Promosi) | ✅ Selesai |
| POS SaaS Phase 6 (Integrasi Marketplace) | ✅ Selesai |
| POS Bonus: Cashflow, Analitik Produk, Kiosk, Akuntansi | ✅ Selesai |

---

## MARKETPLACE

### Halaman Publik
- [x] `/` — Homepage (HeroCarousel, TourismCarousel, kategori, produk)
- [x] `/products` — Daftar semua produk
- [x] `/product/:id` — Detail produk + ulasan + rekomendasi
- [x] `/tourism` — Daftar wisata desa
- [x] `/tourism/:id` — Detail wisata desa
- [x] `/village/:id` — Detail desa wisata
- [x] `/merchant/:slugOrId` — Profil toko merchant (via slug atau ID)
- [x] `/s/:slug` — Custom link toko merchant
- [x] `/shops` — Daftar semua toko
- [x] `/explore` — Jelajah produk & wisata
- [x] `/search` — Hasil pencarian produk
- [x] `/flash-sale` — Halaman flash sale aktif
- [x] `/compare` — Perbandingan produk
- [x] `/vouchers` — Daftar voucher publik
- [x] `/rekomendasi` — Rekomendasi produk personal

### Autentikasi
- [x] `/auth` — Login & Register
- [x] `/register` — Pilih tipe akun
- [x] `/register/village` — Daftarkan desa wisata
- [x] `/register/merchant` — Daftarkan toko/merchant
- [x] `/register/courier` — Daftarkan kurir
- [x] `/forgot-password` — Lupa password
- [x] `/reset-password` — Reset password
- [x] `/email-confirmation` — Konfirmasi email

### Buyer (Pembeli)
- [x] `/cart` — Keranjang belanja
- [x] `/checkout` — Proses checkout (pilih alamat, kurir, pembayaran)
- [x] `/payment/:orderId` — Upload bukti pembayaran
- [x] `/orders` — Riwayat pesanan + tracking status
- [x] `/orders/:orderId/tracking` — Tracking pesanan real-time
- [x] `/orders/:orderId/review` — Beri ulasan setelah pesanan selesai
- [x] `/account` — Profil akun
- [x] `/settings` — Pengaturan akun
- [x] `/addresses` — Kelola alamat tersimpan
- [x] `/wishlist` — Daftar wishlist
- [x] `/reviews/mine` — Ulasan yang sudah ditulis
- [x] `/recently-viewed` — Produk yang baru dilihat
- [x] `/buyer/chat` — Chat dengan merchant
- [x] `/loyalty` — Program poin loyalitas buyer
- [x] `/cashback` — Cashback & riwayat cashback
- [x] `/referral` — Kode referral & komisi
- [x] `/langganan` — Langganan premium buyer
- [x] `/notifications` — Pusat notifikasi

### Kurir
- [x] `/courier` — Dashboard kurir + status online/offline
- [x] `/courier/earnings` — Penghasilan & saldo kurir
- [x] `/courier/history` — Riwayat pengiriman
- [x] `/courier/withdrawal` — Penarikan saldo
- [x] `/courier/deposit` — Setor deposit (jaminan COD)
- [x] `/courier/performa` — Performa & statistik kurir
- [x] `/courier/chat` — Chat dengan buyer/merchant
- [x] `/courier/rides` — Terima order Ojek Desa

### Ojek Desa (Ride-sharing)
- [x] `/ride` — Pesan Ojek Desa (pilih lokasi, estimasi tarif)
- [x] `/ride/:id` — Tracking ride real-time
- [x] `/ride/history` — Riwayat ride passenger

### Merchant
- [x] `/merchant` — Dashboard merchant
- [x] `/merchant/products` — Kelola produk
- [x] `/merchant/products/:productId` — Detail/edit produk
- [x] `/merchant/orders` — Kelola pesanan masuk
- [x] `/merchant/settings` — Pengaturan toko
- [x] `/merchant/analytics` — Analitik penjualan
- [x] `/merchant/reviews` — Ulasan dari pembeli
- [x] `/merchant/promo` — Kelola promosi & diskon
- [x] `/merchant/withdrawal` — Penarikan pendapatan
- [x] `/merchant/refunds` — Kelola permintaan refund
- [x] `/merchant/subscription` — Paket kuota transaksi
- [x] `/merchant/flash-sale` — Kelola flash sale
- [x] `/merchant/vouchers` — Kelola voucher toko
- [x] `/merchant/scheduled-promo` — Jadwal promosi otomatis
- [x] `/merchant/visitor-stats` — Statistik pengunjung toko
- [x] `/merchant/chat` — Chat dengan buyer
- [x] `/merchant/pos` — Info & akses POS SaaS
- [x] `/merchant/pos/subscribe` — Berlangganan POS SaaS
- [x] `/merchant/pos/settings` — Pengaturan integrasi POS
- [x] `/merchant/dues` — Iuran kelompok usaha

### Verifikator
- [x] `/verifikator` — Dashboard verifikator (approve merchant & desa)
- [x] `/verifikator/merchants` — Kelola merchant di wilayah
- [x] `/verifikator/earnings` — Komisi & penghasilan verifikator
- [x] `/verifikator/kas-report` — Laporan kas kelompok usaha
- [x] `/verifikator/ekonomi` — Data ekonomi wilayah
- [x] `/verifikator/event-desa` — Event & kegiatan desa

### Admin Desa (admin_desa)
- [x] `/desa` — Dashboard desa
- [x] `/desa/tourism` — Kelola objek wisata
- [x] `/desa/ekonomi` — Data ekonomi desa
- [x] `/desa/event` — Kelola event desa
- [x] `/desa/keanggotaan` — Manajemen keanggotaan
- [x] `/desa/broadcast` — Broadcast pesan ke warga/merchant
- [x] `/desa/peta` — Peta desa interaktif
- [x] `/desa/laporan-wisata` — Laporan statistik wisata

### Admin Platform
- [x] `/admin` — Dashboard admin (statistik real-time)
- [x] `/admin/merchants` — Kelola semua merchant
- [x] `/admin/merchants/:id` — Detail merchant
- [x] `/admin/villages` — Kelola semua desa
- [x] `/admin/villages/:id` — Detail desa
- [x] `/admin/couriers` — Kelola kurir
- [x] `/admin/orders` — Semua pesanan
- [x] `/admin/users` — Kelola pengguna & role
- [x] `/admin/reports` — Laporan platform
- [x] `/admin/refunds` — Kelola refund
- [x] `/admin/withdrawals` — Penarikan saldo merchant/kurir
- [x] `/admin/promotions` — Kelola promosi marketplace
- [x] `/admin/codes` — Kode referral verifikator
- [x] `/admin/transaction-quota` — Kelola paket kuota
- [x] `/admin/verifikator-commissions` — Komisi verifikator
- [x] `/admin/verifikator-withdrawals` — Penarikan verifikator
- [x] `/admin/finance` — Laporan keuangan platform
- [x] `/admin/banners` — Kelola banner hero
- [x] `/admin/broadcast` — Broadcast notifikasi
- [x] `/admin/roles` — Manajemen role pengguna
- [x] `/admin/backup` — Backup & restore data
- [x] `/admin/categories` — Kelola kategori produk
- [x] `/admin/halal` — Manajemen sertifikasi halal
- [x] `/admin/halal-regulation` — Regulasi halal
- [x] `/admin/logs` — Log aktivitas sistem
- [x] `/admin/audit-log` — Audit trail aktivitas admin
- [x] `/admin/settings` — Pengaturan platform
- [x] `/admin/pos` — Kelola subscriber POS SaaS
- [x] `/admin/rides` — Kelola Ojek Desa
- [x] `/admin/komisi` — Laporan komisi platform
- [x] `/admin/system-health` — Kesehatan sistem
- [x] `/admin/whatsapp` — Integrasi WhatsApp notifikasi
- [x] `/admin/api-keys` — Kelola API keys
- [x] `/admin/cashback` — Kelola program cashback

---

## POS SaaS (`/pos/*`)

### Phase 1 — Core + Master Data + Stok Dasar ✅
- [x] `/pos/setup` — Wizard setup usaha (nama, jenis, mata uang, outlet pertama)
- [x] `/pos` — Dashboard (KPI harian, grafik 7 hari, stok menipis)
- [x] `/pos/kasir` — Point of Sale (grid produk, barcode, cart, payment, struk)
- [x] `/pos/transaksi` — Riwayat transaksi + filter + export CSV
- [x] `/pos/retur` — Retur penjualan + restock otomatis
- [x] `/pos/produk` — CRUD produk (SKU, barcode, varian, margin, HPP)
- [x] `/pos/kategori` — CRUD kategori & sub-kategori
- [x] `/pos/customer` — CRUD pelanggan + statistik
- [x] `/pos/supplier` — CRUD supplier
- [x] `/pos/stok` — Stok per outlet + penyesuaian + mutasi
- [x] `/pos/laporan` — Laporan penjualan dasar
- [x] `/pos/pengguna` — 7 role pengguna + PIN kasir
- [x] `/pos/pengaturan` — Pengaturan usaha & outlet

### Phase 2 — Pembelian & Kas Harian ✅
- [x] `/pos/pembelian` — Purchase Order ke supplier (flow lengkap + penerimaan barang)
- [x] `/pos/kas` — Sesi kasir (buka/tutup shift, mutasi kas manual, selisih)

### Phase 3 — Laporan Lanjutan & Analitik Pelanggan ✅
- [x] `/pos/laporan/laba-rugi` — Statement laba rugi + grafik omzet vs HPP
- [x] `/pos/laporan/kasir` — Performa kasir + jam sibuk + riwayat sesi
- [x] `/pos/laporan/stok` — Alert stok + mutasi + top produk laku
- [x] `/pos/analitik` — Analitik pelanggan RFM 6 segmen + pie chart

### Phase 4 — Multi-outlet & Audit Trail ✅
- [x] `/pos/transfer-stok` — Transfer stok antar outlet (flow approve + selesai)
- [x] `/pos/laporan/outlet` — Perbandingan performa antar outlet
- [x] `/pos/audit` — Audit trail aktivitas + mutasi stok
- [x] `/pos/akses` — Manajemen akses user per outlet + 7 role

### Phase 5 — Loyalty & Promosi ✅
- [x] `/pos/promosi` — Kelola promosi (%, nominal, beli X gratis Y, bundle, happy hour) + voucher
- [x] `/pos/loyalty` — Program poin pelanggan (earn/redeem, tier Gold/Silver/Bronze, expiry)

### Phase 6 — Integrasi Marketplace ✅
- [x] `/pos/integrasi` — Sinkronisasi produk & stok POS ↔ Marketplace, import order marketplace

### Bonus (Tidak Terdokumentasi Sebelumnya) ✅
- [x] `/pos/laporan/cashflow` — Laporan cashflow (masuk/keluar/net + grafik area)
- [x] `/pos/analitik-produk` — Analitik produk (fast/slow/dead moving, margin, turnover)
- [x] `/pos/kiosk` — Mode self-service kiosk (tampilan full-screen untuk customer)
- [x] `/pos/akuntansi` — Jurnal akuntansi double-entry (penjualan, HPP, retur, kas)

---

## Database & Migrasi

### Marketplace (supabase/migrations_backup/)
- [x] Profiles, user_roles, villages, merchants, products, categories
- [x] Orders, order_items, couriers, deliveries
- [x] Reviews + trigger update rating merchant otomatis
- [x] Halal certification (halal_certifications, halal_regulations)
- [x] Quota system (quota_tiers, merchant_subscriptions, paket transaksi)
- [x] Trade groups (kelompok_usaha, group_members, kas_payments)
- [x] Verifikator referral codes & commissions
- [x] COD security (trust_score, cod_enabled, cod_fail_count di profiles)
- [x] Ojek Desa (ride_requests + accept_ride() atomic function)
- [x] Courier deposits & balance logs
- [x] Merchant favorites
- [x] Notifications, chat_messages
- [x] Flash sales, vouchers, cashback, promotions

### POS SaaS (supabase/migrations/)
- [x] Phase 1: pos_tenants, pos_outlets, pos_users, pos_categories, pos_brands, pos_products, pos_product_variants, pos_stock, pos_stock_mutations, pos_customers, pos_suppliers, pos_sales, pos_sale_items, pos_held_bills, pos_sale_returns, pos_sale_return_items
- [x] Phase 2: pos_purchase_orders, pos_purchase_order_items, pos_purchase_returns, pos_purchase_return_items, pos_cash_sessions, pos_cash_mutations
- [x] Phase 4: pos_stock_transfers, pos_stock_transfer_items, pos_audit_logs, pos_notifications, pos_user_outlet_access
- [x] Phase 5: pos_promotions, pos_vouchers, pos_loyalty_programs, pos_loyalty_points, pos_point_transactions
- [x] Phase 6: pos_marketplace_sync, pos_sync_logs, pos_marketplace_orders, pos_integration_settings

---

## Bug yang Terdokumentasi (BUG_ANALYSIS_AND_FIXES.md)

- [ ] **Bug #1**: Foto & nama produk tidak muncul di halaman Pesanan (OrdersPage) — L2/L3/L4 query tidak include `product_id`
- [ ] **Bug #2**: Tombol "Pesan Lagi" tidak berfungsi — `addToCart()` dipanggil tanpa properti `isAvailable`
