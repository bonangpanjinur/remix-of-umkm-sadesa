# 🗺️ DesaMart — Roadmap Prioritas Fitur

> **Terakhir diperbarui:** Mei 2026  
> **Metode prioritas:** Dampak × Urgensi × Keterkaitan Antar Role  
> **Skala:** 🔴 Kritis · 🟠 Tinggi · 🟡 Sedang · 🟢 Rendah

---

## 📊 Ringkasan Prioritas

| Fase | Nama | Estimasi | Status |
|------|------|----------|--------|
| **P1** | Pondasi Integrasi Antar Role | 2–3 minggu | 🔴 Segera |
| **P2** | Pengalaman Pembeli & Toko | 2–3 minggu | 🟠 Tinggi |
| **P3** | Admin Desa & Ekosistem Wisata | 2 minggu | 🟠 Tinggi |
| **P4** | Super Admin & Keuangan Platform | 2 minggu | 🟡 Sedang |
| **P5** | POS Lanjutan & Kurir | 2–3 minggu | 🟡 Sedang |
| **P6** | Fitur Diferensiasi & Monetisasi | Ongoing | 🟢 Rendah |

---

## 🔴 FASE P1 — Pondasi Integrasi Antar Role
> *Tanpa ini, semua fitur lain tidak terhubung. Kerjakan pertama.*

### 1.1 Sinkronisasi POS ↔ Marketplace (Stok & Produk)
- **Role terdampak:** Merchant, Buyer, Admin
- **Masalah saat ini:** Endpoint `/api/pos/sync-stock` mengembalikan 501 (belum diimplementasi). Jika merchant jual di kasir POS, stok di marketplace tidak berkurang.
- **Yang perlu dibuat:**
  - [ ] Endpoint `POST /api/pos/sync-stock` — kurangi stok marketplace saat ada transaksi POS
  - [ ] Endpoint `POST /api/pos/sync-product` — sinkron produk POS → listing marketplace
  - [ ] Tampilan status sinkronisasi di halaman `POSIntegrasiPage`
  - [ ] Toggle per-produk: "Tampilkan di Marketplace"
- **Tabel terkait:** `pos_marketplace_sync`, `pos_marketplace_orders`, `products`, `pos_stock`

### 1.2 Notifikasi Real-time ke Semua Role (Push + In-app)
- **Role terdampak:** Buyer, Merchant, Kurir, Admin Desa, Super Admin
- **Masalah saat ini:** Tabel `push_subscriptions` & `notifications` ada, SSE tersedia, tapi notif tidak terkirim ke semua titik perubahan status.
- **Yang perlu dibuat:**
  - [ ] Kirim notif otomatis saat: pesanan dibuat → merchant, dikonfirmasi → buyer, dijemput kurir → buyer, tiba → buyer
  - [ ] Kirim notif ke kurir saat ada pesanan baru di area mereka
  - [ ] Kirim notif ke admin desa saat merchant baru mendaftar di wilayahnya
  - [ ] Badge notifikasi di bottom nav buyer & sidebar merchant
- **Tabel terkait:** `notifications`, `push_subscriptions`

### 1.3 Lacak Pesanan Real-time di Peta (Buyer)
- **Role terdampak:** Buyer, Kurir
- **Masalah saat ini:** Buyer hanya bisa lihat status teks, tidak tahu di mana kurirnya.
- **Yang perlu dibuat:**
  - [ ] Halaman `OrderTrackingPage` dengan peta Leaflet
  - [ ] Titik merah = posisi kurir (update via SSE)
  - [ ] Titik hijau = alamat tujuan pembeli
  - [ ] Perkiraan waktu tiba berdasarkan jarak haversine
  - [ ] Kurir update lokasi setiap 30 detik via `CourierLocationUpdater`
- **Tabel terkait:** `couriers.current_lat/lng`, `orders`, `ride_requests`

### 1.4 Verifikasi Merchant oleh Admin Desa
- **Role terdampak:** Admin Desa, Merchant, Super Admin
- **Masalah saat ini:** Merchant didaftarkan tapi admin desa tidak bisa approve/reject merchant di wilayahnya.
- **Yang perlu dibuat:**
  - [ ] Halaman `DesaMerchantPage` — daftar merchant di wilayah desa ini
  - [ ] Tombol Approve / Reject dengan catatan
  - [ ] Filter merchant: Pending, Aktif, Ditangguhkan
  - [ ] Notif ke merchant saat diapprove/reject oleh admin desa
  - [ ] Super Admin bisa override keputusan admin desa
- **Tabel terkait:** `merchants`, `user_villages`, `villages`, `notifications`

---

## 🟠 FASE P2 — Pengalaman Pembeli & Toko
> *Fitur yang langsung dirasakan pengguna akhir & meningkatkan konversi.*

### 2.1 Profil Toko Lengkap (Galeri, Halal, Jam Buka)
- **Role terdampak:** Merchant, Buyer
- **Yang perlu dibuat:**
  - [ ] UI upload galeri foto toko (`merchant_gallery`) di pengaturan merchant
  - [ ] Tampil galeri di halaman publik toko
  - [ ] Badge "Halal Bersertifikat" jika `halal_certificates` aktif
  - [ ] Tampil jam buka/tutup (`merchant_operating_hours`) di halaman toko
  - [ ] Status "Buka Sekarang" / "Tutup" otomatis berdasarkan jam
- **Tabel terkait:** `merchant_gallery`, `halal_certificates`, `merchant_operating_hours`

### 2.2 Manajemen Stok dengan Alert
- **Role terdampak:** Merchant
- **Yang perlu dibuat:**
  - [ ] Banner peringatan di dashboard merchant jika stok < ambang batas
  - [ ] Pengaturan ambang batas stok per produk
  - [ ] Riwayat pergerakan stok (masuk/keluar/terjual)
  - [ ] Notifikasi WA otomatis ke merchant saat stok kritis
  - [ ] Laporan stok — export Excel
- **Tabel terkait:** `products.stock`, `notifications`, `order_items`

### 2.3 Multi Alamat Pengiriman (Buyer)
- **Role terdampak:** Buyer
- **Yang perlu dibuat:**
  - [ ] Halaman `AddressesPage` — tambah, edit, hapus, pilih default
  - [ ] Pilih alamat saat checkout dari daftar tersimpan
  - [ ] Label alamat: Rumah, Kantor, Lainnya
  - [ ] Validasi wilayah via API emsifa
- **Tabel terkait:** `saved_addresses`

### 2.4 Beli Lagi 1-Klik & Riwayat Lengkap (Buyer)
- **Role terdampak:** Buyer
- **Yang perlu dibuat:**
  - [ ] Tombol "Beli Lagi" di riwayat pesanan → langsung masuk cart
  - [ ] Filter riwayat: Semua, Diproses, Selesai, Dibatalkan
  - [ ] Download invoice PDF per pesanan
  - [ ] Riwayat pencarian (simpan 10 terakhir di localStorage)
- **Tabel terkait:** `orders`, `order_items`

### 2.5 Dispute / Komplain Terstruktur
- **Role terdampak:** Buyer, Merchant, Admin
- **Yang perlu dibuat:**
  - [ ] Buyer bisa ajukan komplain per pesanan dengan foto bukti
  - [ ] Merchant bisa respons komplain
  - [ ] Admin bisa mediasi & putuskan resolusi (refund/tolak)
  - [ ] Timeline status: Diajukan → Direspons → Dalam Mediasi → Selesai
  - [ ] Tabel `refund_requests` sudah ada — perlu diperluas
- **Tabel terkait:** `refund_requests`, `notifications`

### 2.6 Balas Ulasan oleh Merchant
- **Role terdampak:** Merchant, Buyer
- **Yang perlu dibuat:**
  - [ ] Merchant bisa tambahkan balasan ke setiap review
  - [ ] Balasan tampil di bawah ulasan di halaman publik produk/toko
  - [ ] Notif ke buyer saat ulasannya dibalas
- **Tabel terkait:** `reviews` (tambah kolom `merchant_reply`, `replied_at`)

### 2.7 Laporan Keuangan Merchant (Laba Rugi Sederhana)
- **Role terdampak:** Merchant
- **Yang perlu dibuat:**
  - [ ] Rekap omzet bulanan vs biaya platform vs pendapatan bersih
  - [ ] Grafik tren penjualan 6 bulan
  - [ ] Export PDF/Excel untuk laporan pajak
  - [ ] Perbandingan bulan ini vs bulan lalu
- **Tabel terkait:** `orders`, `order_items`, `platform_fees`, `merchant_subscriptions`

---

## 🟠 FASE P3 — Admin Desa & Ekosistem Wisata
> *Membuka potensi monetisasi desa dan mengikat merchant lokal.*

### 3.1 Profil & Galeri Desa Lengkap
- **Role terdampak:** Admin Desa, Buyer (publik)
- **Yang perlu dibuat:**
  - [ ] Form edit profil desa: nama, deskripsi, kontak, media sosial, koordinat
  - [ ] Upload foto utama desa & galeri tambahan
  - [ ] Halaman publik desa yang lebih kaya (stats, galeri, merchant, wisata)
  - [ ] QR code desa untuk promosi offline
- **Tabel terkait:** `villages`, `merchant_gallery` (dipakai ulang untuk desa)

### 3.2 Paket Wisata & Booking Online
- **Role terdampak:** Admin Desa, Buyer
- **Yang perlu dibuat:**
  - [ ] Admin desa buat paket wisata (akomodasi + kuliner + aktivitas)
  - [ ] Buyer bisa pilih tanggal & pesan paket
  - [ ] Sistem pembayaran terintegrasi (Xendit)
  - [ ] Konfirmasi booking via WhatsApp ke admin desa & buyer
  - [ ] Halaman `TourismBookingPage` untuk buyer
- **Tabel terkait:** `tourism`, `orders` (type wisata)

### 3.3 Laporan Keuangan & Pendapatan Desa
- **Role terdampak:** Admin Desa, Super Admin
- **Yang perlu dibuat:**
  - [ ] Dashboard: total transaksi merchant se-desa, komisi masuk ke kas desa
  - [ ] Grafik pendapatan bulanan dari wisata
  - [ ] Laporan kunjungan wisatawan (jumlah, asal daerah, rating)
  - [ ] Export laporan untuk laporan ke Pemdes
- **Tabel terkait:** `orders`, `tourism`, `villages`, `commission_rules`

### 3.4 Jadwal & Pemandu Wisata
- **Role terdampak:** Admin Desa, Buyer
- **Yang perlu dibuat:**
  - [ ] Daftar pemandu wisata desa: nama, ketersediaan, nomor WA, spesialisasi
  - [ ] Kalender ketersediaan pemandu
  - [ ] Buyer bisa request pemandu saat booking wisata
- **Tabel terkait:** Tabel baru `tourism_guides`

---

## 🟡 FASE P4 — Super Admin & Keuangan Platform
> *Kelengkapan operasional platform agar bisa dikelola tim secara profesional.*

### 4.1 Manajemen Paket Langganan Platform
- **Role terdampak:** Super Admin, Merchant, POS Tenant
- **Yang perlu dibuat:**
  - [ ] Halaman CRUD paket: nama, harga, fitur per tier, kuota transaksi
  - [ ] Assign paket ke merchant/POS tenant secara manual
  - [ ] Histori upgrade/downgrade paket
  - [ ] Perpanjangan otomatis & pengingat expired
- **Tabel terkait:** `pos_packages`, `pos_subscriptions`, `merchant_subscriptions`, `transaction_packages`

### 4.2 Dashboard Realtime Platform
- **Role terdampak:** Super Admin
- **Yang perlu dibuat:**
  - [ ] Transaksi per jam (grafik live via SSE)
  - [ ] User aktif saat ini
  - [ ] Pesanan sedang diproses: berapa, oleh siapa
  - [ ] Alert otomatis jika ada spike error atau transaksi gagal
  - [ ] Monitor uptime server & respons API
- **Tabel terkait:** `orders`, `sessions`, `admin_audit_logs`

### 4.3 Komisi Dinamis per Kategori & Desa
- **Role terdampak:** Super Admin, Merchant, Admin Desa
- **Yang perlu dibuat:**
  - [ ] Atur komisi berbeda per kategori produk (kuliner 3%, kriya 5%, dll)
  - [ ] Atur komisi per desa (desa tertentu dapat insentif lebih kecil)
  - [ ] Histori perubahan komisi
  - [ ] Preview dampak perubahan komisi ke pendapatan platform
- **Tabel terkait:** `commission_rules`

### 4.4 Laporan Keuangan Platform (P&L)
- **Role terdampak:** Super Admin
- **Yang perlu dibuat:**
  - [ ] Pendapatan dari komisi marketplace
  - [ ] Pendapatan dari langganan POS
  - [ ] Pendapatan dari iklan merchant
  - [ ] Biaya operasional (estimasi)
  - [ ] Rekap pajak (PPN, PPh)
  - [ ] Export PDF/Excel bulanan
- **Tabel terkait:** `orders`, `platform_fees`, `merchant_subscriptions`, `merchant_ads`

### 4.5 Sistem Tiket Support Internal
- **Role terdampak:** Super Admin, Merchant, Buyer, Kurir
- **Yang perlu dibuat:**
  - [ ] User ajukan tiket bantuan dari app
  - [ ] Admin balas & close tiket
  - [ ] Kategori tiket: Pesanan, Pembayaran, Akun, Teknis
  - [ ] SLA otomatis: tiket belum dibalas > 24 jam → eskalasi
- **Tabel terkait:** Tabel baru `support_tickets`

### 4.6 Manajemen SEO & Konten Halaman Publik
- **Role terdampak:** Super Admin
- **Yang perlu dibuat:**
  - [ ] Edit meta title, description, OG image per halaman
  - [ ] Halaman landing yang bisa dikustomisasi dari admin
  - [ ] Sitemap otomatis untuk SEO
- **Tabel terkait:** `seo_settings`, `app_settings`

---

## 🟡 FASE P5 — POS Lanjutan & Kurir
> *Penguatan dua modul yang sudah cukup lengkap tapi perlu penyempurnaan.*

### 5.1 Struk Digital via WhatsApp / Email (POS)
- **Role terdampak:** POS Kasir, Buyer offline
- **Yang perlu dibuat:**
  - [ ] Setelah transaksi POS, pilih "Kirim Struk via WA"
  - [ ] Generate PDF struk → kirim via API WhatsApp
  - [ ] Riwayat pengiriman struk per transaksi
- **Tabel terkait:** `pos_sales`, `pos_customers`

### 5.2 QR Pay (Buyer bayar di kasir POS)
- **Role terdampak:** Buyer, POS Kasir, Merchant
- **Yang perlu dibuat:**
  - [ ] Buyer generate QR dari app → kasir scan → transaksi selesai
  - [ ] Atau kasir tampilkan QR → buyer scan → konfirmasi di app
  - [ ] Saldo cashback otomatis dikreditkan
- **Tabel terkait:** `pos_sales`, `orders`, `cashback_transactions`

### 5.3 Navigasi & Batch Pengiriman (Kurir)
- **Role terdampak:** Kurir
- **Yang perlu dibuat:**
  - [ ] Tombol "Buka di Google Maps" dengan alamat tujuan terisi
  - [ ] Batch mode: kurir ambil 2–3 pesanan dari merchant sama sekaligus
  - [ ] Urutan pengiriman optimal berdasarkan jarak
- **Tabel terkait:** `orders`, `couriers`

### 5.4 Laporan Penghasilan Kurir (PDF)
- **Role terdampak:** Kurir
- **Yang perlu dibuat:**
  - [ ] Slip penghasilan mingguan/bulanan bisa di-download
  - [ ] Rincian: jumlah antar, bonus, potongan, total bersih
- **Tabel terkait:** `courier_earnings`, `courier_balance_logs`

### 5.5 Menu Digital QR untuk Restoran
- **Role terdampak:** Merchant (Restoran), Buyer
- **Yang perlu dibuat:**
  - [ ] Merchant generate QR code toko
  - [ ] Tamu scan QR → tampil menu digital tanpa install app
  - [ ] Bisa langsung pesan dari halaman menu (integrasi ke POS meja)
- **Tabel terkait:** `products`, `merchants`, `pos_sales`

---

## 🟢 FASE P6 — Fitur Diferensiasi & Monetisasi
> *Fitur inovatif jangka panjang yang membedakan DesaMart dari kompetitor.*

### 6.1 Pre-order & Reservasi Meja (Restoran)
- Pelanggan bisa pesan tempat & menu sebelum datang
- Admin restoran konfirmasi via app
- Deposit di awal sebagai jaminan

### 6.2 Bundle Produk (Merchant)
- Merchant buat paket: "Beli A+B+C lebih murah"
- Tampil di halaman toko & homepage sebagai promo
- Stok bundle terhitung otomatis

### 6.3 Program Loyalitas Multi-level
- Buyer naik tier (Silver/Gold/Platinum) berdasarkan total belanja
- Merchant dapat badge "Terpercaya", "Terlaris", "Halal Verified"
- Kurir dapat badge "Terbaik" berdasarkan rating

### 6.4 Marketplace B2B (Grosir Antar Merchant)
- Merchant bisa jual dalam jumlah besar ke merchant lain
- Harga grosir berbeda dari harga retail

### 6.5 Laporan Pajak Otomatis (Merchant & Platform)
- Rekap PKP/non-PKP, total omzet, estimasi PPh final 0.5%
- Format siap upload ke e-SPT

### 6.6 Fitur Donasi & Crowdfunding Desa
- Pembeli bisa donasi ke program desa saat checkout
- Admin desa kelola campaign, target, laporan penggunaan dana

### 6.7 Affiliate & Influencer Marketing
- Kode referral merchant yang bisa dibagikan ke influencer
- Komisi per transaksi dari kode referral
- Dashboard performa per influencer

---

## 🔗 Matriks Integrasi Antar Role

| Integrasi | Dari | Ke | Prioritas | Status |
|-----------|------|----|-----------|--------|
| Sync stok saat transaksi POS | POS Kasir | Marketplace Buyer | 🔴 P1 | ❌ Belum |
| Notif otomatis perubahan status pesanan | Merchant/Kurir | Buyer | 🔴 P1 | ⚠️ Parsial |
| Lacak kurir di peta live | Kurir | Buyer | 🔴 P1 | ❌ Belum |
| Verifikasi merchant oleh admin desa | Admin Desa | Merchant | 🔴 P1 | ❌ Belum |
| Galeri & profil toko di halaman publik | Merchant | Buyer | 🟠 P2 | ⚠️ Parsial |
| Booking wisata dari app | Buyer | Admin Desa | 🟠 P3 | ❌ Belum |
| Komisi desa dari transaksi merchant | Merchant/Order | Admin Desa | 🟠 P3 | ❌ Belum |
| Struk digital via WA setelah kasir | POS | Buyer offline | 🟡 P5 | ❌ Belum |
| QR Pay di kasir dari app buyer | Buyer | POS Kasir | 🟡 P5 | ❌ Belum |
| Admin super pantau POS tenant | Super Admin | POS | 🟡 P4 | ⚠️ Parsial |
| Laporan berjenjang admin → desa → super | Admin Desa | Super Admin | 🟡 P4 | ❌ Belum |

---

## 📋 Checklist Per Sprint (2 Minggu)

### Sprint 1 (P1 — Integrasi Inti)
- [ ] POS ↔ Marketplace sync stok
- [ ] Notifikasi real-time semua role
- [ ] Lacak pesanan di peta (buyer)
- [ ] Verifikasi merchant oleh admin desa

### Sprint 2 (P2 — Pengalaman Toko & Pembeli)
- [ ] Galeri toko, halal badge, jam buka
- [ ] Alert stok rendah merchant
- [ ] Multi alamat buyer
- [ ] Beli lagi 1-klik
- [ ] Dispute/komplain terstruktur

### Sprint 3 (P2 lanjutan + P3)
- [ ] Balas ulasan oleh merchant
- [ ] Laporan keuangan merchant sederhana
- [ ] Profil & galeri desa
- [ ] Paket wisata & booking online

### Sprint 4 (P3 lanjutan + P4)
- [ ] Laporan keuangan desa
- [ ] Jadwal pemandu wisata
- [ ] Dashboard realtime super admin
- [ ] Manajemen paket langganan

### Sprint 5 (P4 lanjutan + P5)
- [ ] Komisi dinamis per kategori
- [ ] Laporan keuangan platform P&L
- [ ] Struk digital via WA (POS)
- [ ] Navigasi kurir + batch delivery

### Sprint 6 (P5 lanjutan + P6)
- [ ] QR Pay buyer ↔ kasir
- [ ] Menu digital QR restoran
- [ ] Laporan penghasilan kurir PDF
- [ ] Mulai P6: pre-order, bundle produk

---

## 📌 Catatan Teknis

- **Database:** Semua tabel utama sudah tersedia. Fitur P1–P3 mayoritas tinggal membuat UI dan API endpoint, tidak perlu migrasi schema besar.
- **Realtime:** SSE sudah aktif — manfaatkan untuk lacak kurir, notif pesanan, dan sync stok.
- **WhatsApp:** API WA sudah terintegrasi di server — tinggal perluas ke lebih banyak trigger.
- **POS Sync:** Endpoint `/api/pos/sync-stock` sudah ada tapi masih 501 — ini prioritas utama.
- **Leaflet Maps:** Sudah di-install dan digunakan di beberapa komponen — bisa langsung dipakai untuk tracking.
