# DesaMart — Progress Fitur

> Terakhir diperbarui: 8 Mei 2026 (setelah Sprint 1 selesai)
> Platform: React 18 + TypeScript + Vite + Supabase + Express API
> Jalur POS: `/pos/*` | Jalur Marketplace: `/`, `/merchant/*`, `/admin/*`, dll.

---

## Legenda

| Simbol | Arti |
|--------|------|
| ✅ | Selesai & siap digunakan |
| 🔄 | Sebagian selesai / perlu penyempurnaan |
| ❌ | Belum dikerjakan |
| 🔴 | Prioritas tinggi |
| 🟡 | Prioritas sedang |
| 🟢 | Prioritas rendah / nice-to-have |

---

## 🏁 Sprint 1 — SELESAI ✅

> Dikerjakan: 8 Mei 2026 | Semua 5 fitur + 2 quick wins selesai

| Kode | Fitur | Status | File/Route |
|------|-------|--------|------------|
| S1-01 | Laporan Cashflow POS (bar/area chart, filter periode, CSV export) | ✅ | `POSLaporanCashflowPage.tsx` · `/pos/laporan/cashflow` |
| S1-02 | Kartu member digital QR code (visual, download PNG) | ✅ | `POSCustomerPage.tsx` |
| S1-03 | Notifikasi expiry poin di dashboard loyalty + tab khusus | ✅ | `POSLoyaltyPage.tsx` |
| S1-04 | Auto-sync stok berkala setiap 5 menit (Express cron) | ✅ | `server/index.ts` · `POST /api/pos/sync-stock` |
| S1-05 | Webhook order marketplace → import ke POS + kurangi stok | ✅ | `server/index.ts` · `POST /api/webhook/marketplace-order` |
| QW-1 | GPS navigasi kurir (tombol buka Google Maps dari order) | ✅ | `CourierDashboardPage.tsx` |
| QW-2 | Toggle online/offline kurir | ✅ | `CourierDashboardPage.tsx` |

---

## 🏪 POS SaaS (Point of Sale)

### PHASE 1 — Core Kasir & Master Data (100% ✅)
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 1.1 | Setup wizard usaha baru | ✅ | `/pos/setup` |
| 1.2 | Dashboard ringkasan (KPI, grafik 7 hari, stok menipis) | ✅ | `/pos` |
| 1.3 | Kasir / POS terminal — grid produk, add to cart, diskon per item | ✅ | `/pos/kasir` |
| 1.4 | Barcode scanner kamera (real-time) | ✅ | `/pos/kasir` |
| 1.5 | Multi metode pembayaran (Tunai, QRIS, Transfer, Debit) | ✅ | `/pos/kasir` |
| 1.6 | Hitung kembalian & quick amount buttons | ✅ | `/pos/kasir` |
| 1.7 | Hold bill (tahan & lanjutkan transaksi) | ✅ | `/pos/kasir` |
| 1.8 | Pilih varian produk saat checkout | ✅ | `/pos/kasir` |
| 1.9 | Manajemen produk (CRUD, SKU, barcode, foto, margin HPP) | ✅ | `/pos/produk` |
| 1.10 | Kategori produk + sub-kategori | ✅ | `/pos/kategori` |
| 1.11 | Riwayat transaksi + filter tanggal | ✅ | `/pos/transaksi` |
| 1.12 | Retur penjualan (restock otomatis) | ✅ | `/pos/retur` |
| 1.13 | Manajemen stok (lihat, sesuaikan, riwayat mutasi) | ✅ | `/pos/stok` |
| 1.14 | Data pelanggan (CRUD, statistik belanja) | ✅ | `/pos/customer` |
| 1.15 | Data supplier | ✅ | `/pos/supplier` |
| 1.16 | Laporan penjualan dasar | ✅ | `/pos/laporan` |
| 1.17 | Manajemen pengguna POS (7 role + PIN kasir) | ✅ | `/pos/pengguna` |
| 1.18 | Pengaturan usaha & outlet | ✅ | `/pos/pengaturan` |

### PHASE 2 — Pembelian & Kas Harian (100% ✅)
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 2.1 | Purchase Order ke supplier (buat, terima barang, update stok otomatis) | ✅ | `/pos/pembelian` |
| 2.2 | Hutang dagang & status PO (Draft → Diterima → Selesai) | ✅ | `/pos/pembelian` |
| 2.3 | Retur barang ke supplier | ✅ | `/pos/pembelian` |
| 2.4 | Sesi kasir buka/tutup shift | ✅ | `/pos/kas` |
| 2.5 | Mutasi kas manual (tambah/kurangi kas) | ✅ | `/pos/kas` |
| 2.6 | Selisih saldo & laporan sesi | ✅ | `/pos/kas` |

### PHASE 3 — Laporan Lanjutan & Analitik (100% ✅)
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 3.1 | Laporan Laba Rugi (statement akuntansi, margin, grafik) | ✅ | `/pos/laporan/laba-rugi` |
| 3.2 | Laporan per Kasir (ranking, jam sibuk, performa sesi) | ✅ | `/pos/laporan/kasir` |
| 3.3 | Laporan Stok (alert menipis, mutasi, grafik terlaris) | ✅ | `/pos/laporan/stok` |
| 3.4 | Analitik RFM Pelanggan (6 segmen, top 20, tren) | ✅ | `/pos/analitik` |
| 3.5 | **Laporan Cashflow** (arus kas masuk/keluar, grafik bulanan) | ✅ **S1-01** | `/pos/laporan/cashflow` |

### PHASE 4 — Multi-outlet & Audit Trail (100% ✅)
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 4.1 | Transfer stok antar outlet (Draft → Approve → Selesai) | ✅ | `/pos/transfer-stok` |
| 4.2 | Laporan perbandingan outlet (grafik harian, kontribusi %) | ✅ | `/pos/laporan/outlet` |
| 4.3 | Audit trail aktivitas pengguna (log old/new values) | ✅ | `/pos/audit` |
| 4.4 | Manajemen akses granular per outlet | ✅ | `/pos/akses` |

### PHASE 5 — Loyalty, Promosi & Diskon (100% ✅)
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 5.1 | CRUD promosi (5 tipe: %, nominal, beli X dapat Y, bundling, happy hour) | ✅ | `/pos/promosi` |
| 5.2 | Voucher / kode kupon (auto-generate, batas pakai, salin) | ✅ | `/pos/promosi` |
| 5.3 | Status promosi otomatis (Aktif, Belum Mulai, Kedaluwarsa, Habis) | ✅ | `/pos/promosi` |
| 5.4 | Export CSV promosi & voucher | ✅ | `/pos/promosi` |
| 5.5 | Program loyalty poin (earn rate, redeem rate, expiry) | ✅ | `/pos/loyalty` |
| 5.6 | 4 tier member (Bronze → Silver → Gold → Platinum) | ✅ | `/pos/loyalty` |
| 5.7 | Penyesuaian poin manual per pelanggan | ✅ | `/pos/loyalty` |
| 5.8 | Riwayat transaksi poin (earn/redeem/adjust/expire) | ✅ | `/pos/loyalty` |
| 5.9 | Integrasi loyalty di Kasir — tampil saldo poin + tier badge | ✅ | `/pos/kasir` |
| 5.10 | Tukar poin sebagai diskon saat checkout di kasir | ✅ | `/pos/kasir` |
| 5.11 | Auto-apply promosi terbaik di kasir | ✅ | `/pos/kasir` |
| 5.12 | Input & validasi kode voucher di kasir | ✅ | `/pos/kasir` |
| 5.13 | Estimasi poin diperoleh sebelum bayar | ✅ | `/pos/kasir` |
| 5.14 | Success dialog: ringkasan poin earned/redeemed/saldo baru | ✅ | `/pos/kasir` |
| 5.15 | Update saldo poin & tier otomatis setelah transaksi | ✅ | `/pos/kasir` |
| 5.16 | **Kartu member digital** (QR code untuk di-scan kasir, download PNG) | ✅ **S1-02** | `/pos/customer` |
| 5.17 | **Notifikasi expiry poin** ke pelanggan (banner + tab alert) | ✅ **S1-03** | `/pos/loyalty` |

### PHASE 6 — Integrasi Marketplace & API (89%)
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 6.1 | Tautkan produk POS ↔ produk marketplace | ✅ | `/pos/integrasi` |
| 6.2 | Sinkronisasi stok POS → marketplace | ✅ | `/pos/integrasi` |
| 6.3 | Toggle sinkron stok/harga per produk | ✅ | `/pos/integrasi` |
| 6.4 | Import order marketplace ke POS | ✅ | `/pos/integrasi` |
| 6.5 | Log sinkronisasi (berhasil/sebagian/gagal, durasi) | ✅ | `/pos/integrasi` |
| 6.6 | Pengaturan integrasi (toko, auto-sync, interval) | ✅ | `/pos/integrasi` |
| 6.7 | **Auto-sync stok berkala** (cron 5 menit, per-tenant) | ✅ **S1-04** | `server/index.ts` |
| 6.8 | **Webhook order marketplace** (real-time push, idempotent) | ✅ **S1-05** | `server/index.ts` |
| 6.9 | API publik untuk third-party (REST + API Key) | ❌ 🟢 | — |

### PHASE 7 — Sprint 2 & Roadmap Lanjutan (0% — Belum Dikerjakan)
| No | Fitur | Sprint | Prioritas |
|----|-------|--------|-----------|
| 7.1 | **Printer thermal** (ESC/POS via Web Serial API) | Sprint 2 | 🔴 |
| 7.2 | **Split payment** (sebagian tunai + sebagian QRIS/transfer) | Sprint 2 | 🔴 |
| 7.3 | **Cetak label produk** dengan barcode dari halaman Produk | Sprint 2 | 🟡 |
| 7.4 | **Auto-reorder point** (notif otomatis saat stok < threshold) | Sprint 2 | 🔴 |
| 7.5 | **Analitik produk** (slow-moving, dead stock, turnover rate) | Sprint 2 | 🟡 |
| 7.6 | Notifikasi WhatsApp (struk digital, promo, poin) | Sprint 6 | 🔴 |
| 7.7 | PWA offline-capable (IndexedDB sync) | Sprint 7 | 🔴 |
| 7.8 | Mode kiosk / self-checkout | Sprint 7 | 🟢 |
| 7.9 | Integrasi akuntansi (export jurnal umum, MYOB, Accurate) | Sprint 7 | 🟢 |
| 7.10 | Dashboard multi-brand / multi-toko | Sprint 7 | 🟢 |

---

## 🛒 Marketplace DesaMart

### Pembeli (role: `buyer`) — 52% (12/23)
| No | Fitur | Status |
|----|-------|--------|
| B.1 | Beranda + produk & toko rekomendasi | ✅ |
| B.2 | Pencarian produk, toko, kategori | ✅ |
| B.3 | Halaman detail produk + foto + deskripsi | ✅ |
| B.4 | Keranjang belanja | ✅ |
| B.5 | Checkout multi-metode bayar (Xendit) | ✅ |
| B.6 | Riwayat pesanan & status tracking | ✅ |
| B.7 | Review & rating produk + toko | ✅ |
| B.8 | Wishlist / Favorit produk | ✅ |
| B.9 | Profil & manajemen alamat | ✅ |
| B.10 | Notifikasi status pesanan | ✅ |
| B.11 | Chat dengan merchant | ✅ |
| B.12 | Jelajahi desa wisata | ✅ |
| B.13 | Program poin / loyalitas pembeli marketplace | ❌ 🔴 Sprint 3 |
| B.14 | Kupon & voucher platform (kode diskon dari platform) | ❌ 🔴 Sprint 3 |
| B.15 | Flash sale & limited-time deals (countdown timer) | ❌ 🔴 Sprint 3 |
| B.16 | Rekomendasi produk personal ("Orang juga membeli…") | ❌ 🔴 Sprint 3 |
| B.17 | Lacak kurir live (real-time GPS) | ❌ 🟡 Sprint 4 |
| B.18 | Notifikasi restok produk favorit/wishlist | ❌ 🟡 Sprint 3 |
| B.19 | Perbandingan produk berdampingan (maks 3 produk) | ❌ 🟡 Sprint 3 |
| B.20 | Cashback & reward program | ❌ 🟡 Sprint 7 |
| B.21 | Struk digital (QR / link) | ❌ 🟢 |
| B.22 | Layanan langganan produk rutin (subscribe & save) | ❌ 🟢 Sprint 7 |
| B.23 | Program afiliasi / referral (kode unik, komisi) | ❌ 🟢 Sprint 7 |

### Merchant / Pemilik Toko (role: `merchant`) — 67% (10/15)
| No | Fitur | Status |
|----|-------|--------|
| M.1 | Manajemen produk (CRUD, foto, varian) | ✅ |
| M.2 | Manajemen order (terima, proses, kirim) | ✅ |
| M.3 | Laporan penjualan dasar | ✅ |
| M.4 | Pengaturan toko (slug, banner, deskripsi) | ✅ |
| M.5 | Chat dengan pembeli | ✅ |
| M.6 | Review & rating produk | ✅ |
| M.7 | Voucher & promosi toko | ✅ |
| M.8 | Manajemen kurir/ekspedisi | ✅ |
| M.9 | Statistik pengunjung toko | ✅ |
| M.10 | Paket berlangganan POS SaaS | ✅ |
| M.11 | Export laporan ke PDF / Excel | ❌ 🔴 Sprint 6 |
| M.12 | Notifikasi WhatsApp ke pelanggan | ❌ 🔴 Sprint 6 |
| M.13 | Flash sale / promo waktu terbatas di toko | ❌ 🔴 Sprint 6 |
| M.14 | Auto-reorder point stok | ❌ 🟡 Sprint 2 |
| M.15 | Cetak label produk | ❌ 🟡 Sprint 2 |

### Kurir (role: `courier`) — 56% (9/16)
| No | Fitur | Status |
|----|-------|--------|
| K.1 | Dashboard kurir | ✅ |
| K.2 | Daftar order yang perlu diantarkan | ✅ |
| K.3 | Update status pengiriman | ✅ |
| K.4 | Riwayat pengiriman & pendapatan | ✅ |
| K.5 | Ojek Desa — ride hailing lokal | ✅ |
| K.6 | Notifikasi order baru | ✅ |
| K.7 | Auto-assign kurir terdekat (Edge Function) | ✅ |
| K.8 | **Navigasi GPS** (buka Google Maps dari order) | ✅ **QW-1** |
| K.9 | Bukti kirim foto (upload saat selesai antar) | ❌ 🔴 Sprint 4 |
| K.10 | Rating kurir oleh pembeli | ❌ 🔴 Sprint 4 |
| K.11 | Rekap pendapatan harian/mingguan | ❌ 🔴 Sprint 4 |
| K.12 | **Toggle online/offline** kurir | ✅ **QW-2** |
| K.13 | Chat dengan pembeli saat pengiriman | ❌ 🟡 Sprint 4 |
| K.14 | Multi-order batching | ❌ 🟡 Sprint 4 |
| K.15 | Laporan performa kurir (tepat waktu %, jarak, rating) | ❌ 🟡 Sprint 4 |
| K.16 | Sistem insentif & bonus target | ❌ 🟢 |

### Verifikator (role: `verifikator`) — 60% (3/5)
| No | Fitur | Status |
|----|-------|--------|
| V.1 | Dashboard verifikator | ✅ |
| V.2 | Approve/reject merchant baru | ✅ |
| V.3 | Monitoring merchant di desa | ✅ |
| V.4 | Laporan ekonomi desa | ❌ 🔴 Sprint 5 |
| V.5 | Manajemen event desa | ❌ 🔴 Sprint 5 |

### Admin Desa (role: `admin_desa`) — 40% (4/10)
| No | Fitur | Status |
|----|-------|--------|
| AD.1 | Dashboard desa | ✅ |
| AD.2 | Manajemen destinasi wisata desa | ✅ |
| AD.3 | Profil desa (nama, foto, deskripsi) | ✅ |
| AD.4 | Lihat merchant yang terdaftar di desa | ✅ |
| AD.5 | Laporan ekonomi desa (total omzet UMKM, grafik) | ❌ 🔴 Sprint 5 |
| AD.6 | Manajemen event desa (pasar malam, festival, jadwal) | ❌ 🔴 Sprint 5 |
| AD.7 | Keanggotaan UMKM (daftar, verifikasi, sertifikat digital) | ❌ 🔴 Sprint 5 |
| AD.8 | Peta interaktif lokasi merchant & wisata di desa | ❌ 🟡 Sprint 5 |
| AD.9 | Broadcast pengumuman ke semua merchant desa | ❌ 🟡 Sprint 5 |
| AD.10 | Laporan kunjungan wisatawan (traffic, rating destinasi) | ❌ 🟡 Sprint 5 |

### Super Admin (role: `admin`) — 56% (9/16)
| No | Fitur | Status |
|----|-------|--------|
| SA.1 | Dashboard admin dengan KPI platform | ✅ |
| SA.2 | Manajemen merchant (CRUD, approve/reject) | ✅ |
| SA.3 | Manajemen order lintas merchant | ✅ |
| SA.4 | Manajemen verifikator & assignment desa | ✅ |
| SA.5 | Manajemen kurir & tracking | ✅ |
| SA.6 | Paket berlangganan POS SaaS | ✅ |
| SA.7 | Laporan keuangan platform | ✅ |
| SA.8 | Manajemen review & rating | ✅ |
| SA.9 | Manajemen kategori & konten | ✅ |
| SA.10 | Dashboard analitik real-time (GMV, transaksi/jam, funnel) | ❌ 🔴 Sprint 6 |
| SA.11 | Manajemen komisi & fee per kategori/merchant | ❌ 🔴 Sprint 6 |
| SA.12 | Broadcast notifikasi ke semua user / segmen | ❌ 🔴 Sprint 6 |
| SA.13 | Audit log platform (siapa ubah apa, kapan) | ❌ 🟡 Sprint 6 |
| SA.14 | Manajemen banner & promosi platform (slot iklan) | ❌ 🟡 Sprint 6 |
| SA.15 | Export laporan ke PDF/Excel (POS + marketplace) | ❌ 🟡 Sprint 6 |
| SA.16 | Manajemen API key third-party | ❌ 🟢 Sprint 7 |

---

## 📊 Ringkasan Progress (Update Pasca Sprint 1)

### POS SaaS

| Phase | Total Fitur | ✅ Selesai | ❌ Belum | % Selesai |
|-------|------------|-----------|---------|----------|
| Phase 1 — Core Kasir | 18 | 18 | 0 | **100%** |
| Phase 2 — Pembelian & Kas | 6 | 6 | 0 | **100%** |
| Phase 3 — Laporan Lanjutan | 5 | 5 | 0 | **100%** ↑ dari 80% |
| Phase 4 — Multi-outlet & Audit | 4 | 4 | 0 | **100%** |
| Phase 5 — Loyalty & Promosi | 17 | 17 | 0 | **100%** ↑ dari 88% |
| Phase 6 — Integrasi Marketplace | 9 | 8 | 1 | **89%** ↑ dari 67% |
| Phase 7 — Sprint 2+ Roadmap | 10 | 0 | 10 | **0%** |
| **TOTAL POS** | **69** | **58** | **11** | **84%** ↑ dari 75% |

### Marketplace DesaMart

| Role | Total Fitur | ✅ Selesai | ❌ Belum | % Selesai |
|------|------------|-----------|---------|----------|
| Pembeli | 23 | 12 | 11 | **52%** |
| Merchant | 15 | 10 | 5 | **67%** |
| Kurir | 16 | 9 | 7 | **56%** ↑ dari 44% |
| Verifikator | 5 | 3 | 2 | **60%** |
| Admin Desa | 10 | 4 | 6 | **40%** |
| Super Admin | 16 | 9 | 7 | **56%** |
| **TOTAL Marketplace** | **85** | **47** | **38** | **55%** ↑ dari 53% |

### Overall Platform
| | Sebelum Sprint 1 | Sesudah Sprint 1 |
|--|--|--|
| Total fitur selesai | 98/156 | 105/154 |
| Persentase | **63%** | **68%** |

---

## 🚀 Fitur Belum Dikerjakan — Per Sprint

### Sprint 2 — POS Toko Fisik (7–10 hari kerja)
> Prioritas berikutnya. Membuat POS benar-benar siap dipakai di toko fisik sehari-hari.

| Kode | Fitur | Dampak | File Target |
|------|-------|--------|-------------|
| S2-01 | Printer thermal struk (ESC/POS via Web Serial API) | ⭐⭐⭐ | `POSKasirPage.tsx` |
| S2-02 | Split payment (sebagian tunai + sebagian QRIS/transfer) | ⭐⭐⭐ | `POSKasirPage.tsx` |
| S2-03 | Cetak label produk dengan barcode dari halaman Produk | ⭐⭐ | `POSProdukPage.tsx` |
| S2-04 | Auto-reorder point — notifikasi otomatis saat stok < threshold | ⭐⭐⭐ | `POSStokPage.tsx` + `server/index.ts` |
| S2-05 | Analitik produk — slow-moving, dead stock, turnover rate | ⭐⭐ | `POSAnalitikProdukPage.tsx` (baru) |

### Sprint 3 — Pengalaman Pembeli Marketplace (7–12 hari kerja)
> Meningkatkan konversi dan retensi pembeli.

| Kode | Fitur | Dampak | Bergantung pada |
|------|-------|--------|----------------|
| S3-01 | Flash sale & limited-time deals (countdown timer) | ⭐⭐⭐ | — |
| S3-02 | Kupon & voucher kode di marketplace | ⭐⭐⭐ | — |
| S3-03 | Program poin loyalitas pembeli marketplace | ⭐⭐⭐ | S3-02 |
| S3-04 | Rekomendasi produk personal ("Orang juga membeli…") | ⭐⭐⭐ | Data riwayat order ✅ |
| S3-05 | Notifikasi restok produk favorit/wishlist | ⭐⭐ | Wishlist ✅ |
| S3-06 | Perbandingan produk berdampingan (maks 3 produk) | ⭐⭐ | — |

### Sprint 4 — Pengalaman Kurir (5–8 hari kerja)
> Dapat dikerjakan paralel dengan Sprint 3.

| Kode | Fitur | Dampak | File Target |
|------|-------|--------|-------------|
| S4-01 | Bukti kirim foto — upload foto selesai antar | ⭐⭐⭐ | `CourierDashboardPage.tsx` + Supabase Storage |
| S4-02 | Rekap pendapatan harian/mingguan kurir | ⭐⭐⭐ | `CourierEarningsPage.tsx` (perkuat) |
| S4-03 | Rating kurir oleh pembeli setelah pesanan tiba | ⭐⭐ | S4-01 |
| S4-04 | Chat dengan pembeli saat pengiriman | ⭐⭐ | — |
| S4-05 | Laporan performa kurir (tepat waktu %, jarak, rating) | ⭐⭐ | S4-02 + S4-03 |
| S4-06 | Multi-order batching (gabung 2+ order 1 kurir) | ⭐⭐ | — |

### Sprint 5 — Admin Desa & Verifikator (5–8 hari kerja)

| Kode | Fitur | Dampak | File Target |
|------|-------|--------|-------------|
| S5-01 | Laporan ekonomi desa (omzet UMKM, jumlah transaksi, grafik) | ⭐⭐⭐ | Halaman baru `desa/` |
| S5-02 | Manajemen event desa (pasar malam, festival, jadwal) | ⭐⭐⭐ | Halaman baru `desa/` |
| S5-03 | Keanggotaan UMKM (daftar, verifikasi, sertifikat digital) | ⭐⭐⭐ | Halaman baru `desa/` |
| S5-04 | Broadcast pengumuman ke semua merchant desa | ⭐⭐ | `DesaDashboardPage.tsx` |
| S5-05 | Peta interaktif lokasi merchant & wisata di desa | ⭐⭐ | Halaman baru + Leaflet/Maps |
| S5-06 | Laporan kunjungan wisatawan (traffic, rating destinasi) | ⭐⭐ | `DesaTourismPage.tsx` |

### Sprint 6 — Super Admin & Merchant Lanjutan (7–10 hari kerja)

| Kode | Fitur | Dampak | File Target |
|------|-------|--------|-------------|
| S6-01 | Dashboard analitik platform real-time (GMV, transaksi/jam) | ⭐⭐⭐ | `AdminDashboardPage.tsx` |
| S6-02 | Manajemen komisi & fee per kategori/merchant | ⭐⭐⭐ | Halaman admin baru |
| S6-03 | Broadcast notifikasi ke semua user / segmen | ⭐⭐⭐ | `AdminBroadcastPage.tsx` |
| S6-04 | Export laporan ke PDF/Excel (POS + marketplace) | ⭐⭐⭐ | Semua halaman laporan |
| S6-05 | Flash sale / promo waktu terbatas di halaman merchant | ⭐⭐⭐ | `MerchantFlashSalePage.tsx` |
| S6-06 | Manajemen banner & promosi platform (slot iklan) | ⭐⭐ | `AdminBannersPage.tsx` |
| S6-07 | Audit log platform (siapa ubah apa, kapan) | ⭐⭐ | Halaman admin baru |
| S6-08 | Notifikasi WhatsApp ke pelanggan (struk, promo, poin) | ⭐⭐⭐ | API WhatsApp + server |

### Sprint 7 — Infrastruktur & Ekosistem (14–21 hari kerja)

| Kode | Fitur | Dampak | Catatan |
|------|-------|--------|---------|
| S7-01 | PWA offline-capable (IndexedDB + background sync) | ⭐⭐⭐ | Butuh service worker |
| S7-02 | API publik REST + API Key management | ⭐⭐ | server/index.ts + tabel api_keys |
| S7-03 | Integrasi akuntansi (export jurnal ke Accurate/MYOB) | ⭐⭐ | Bergantung pada laporan ✅ |
| S7-04 | Cashback & reward program marketplace | ⭐⭐ | Bergantung S3-03 |
| S7-05 | Program afiliasi / referral (kode unik, komisi) | ⭐⭐ | — |
| S7-06 | Layanan langganan produk rutin (subscribe & save) | ⭐⭐ | — |
| S7-07 | Mode kiosk / self-checkout | ⭐ | — |
| S7-08 | Dashboard multi-brand / multi-toko | ⭐ | Multi-outlet ✅ |

---

## 📋 Daftar Ringkas Fitur Belum Dikerjakan

> Total: **49 fitur** tersisa di 7 sprint

```
POS SaaS (11 fitur):
  Sprint 2: Printer thermal, Split payment, Label produk, Auto-reorder, Analitik produk
  Sprint 6: Notif WhatsApp
  Sprint 7: PWA offline, Mode kiosk, Integrasi akuntansi, API publik, Multi-brand dashboard

Marketplace — Pembeli (11 fitur):
  Sprint 3: Program poin, Kupon platform, Flash sale, Rekomendasi, Notif restok, Perbandingan produk
  Sprint 4: Lacak kurir live
  Sprint 7: Cashback, Afiliasi, Langganan, Struk digital

Marketplace — Merchant (5 fitur):
  Sprint 2: Auto-reorder, Cetak label
  Sprint 6: Export PDF/Excel, Notif WhatsApp, Flash sale toko

Kurir (7 fitur):
  Sprint 4: Bukti foto, Rating, Rekap pendapatan, Chat, Laporan performa, Multi-batching
  Sprint lain: Insentif bonus

Admin Desa + Verifikator (8 fitur):
  Sprint 5: Laporan ekonomi, Event desa, Keanggotaan UMKM, Broadcast, Peta, Laporan wisatawan
  Sprint 5: Laporan ekonomi desa (verifikator), Event desa (verifikator)

Super Admin (7 fitur):
  Sprint 6: Dashboard GMV, Komisi, Broadcast, Audit log, Banner, Export laporan, API Key
```

---

## 🗺️ Halaman & Route Lengkap

### POS SaaS (`/pos/*`)
| Route | Halaman | Status |
|-------|---------|--------|
| `/pos` | Dashboard | ✅ |
| `/pos/kasir` | Kasir + Loyalty + Promosi + Voucher | ✅ |
| `/pos/transaksi` | Riwayat Transaksi | ✅ |
| `/pos/retur` | Retur Penjualan | ✅ |
| `/pos/produk` | Manajemen Produk | ✅ |
| `/pos/kategori` | Kategori | ✅ |
| `/pos/customer` | Data Pelanggan + Kartu QR Member | ✅ |
| `/pos/supplier` | Data Supplier | ✅ |
| `/pos/stok` | Manajemen Stok | ✅ |
| `/pos/laporan` | Laporan Dasar | ✅ |
| `/pos/pengguna` | Pengguna POS | ✅ |
| `/pos/pengaturan` | Pengaturan Usaha | ✅ |
| `/pos/pembelian` | Purchase Order | ✅ |
| `/pos/kas` | Kas Harian | ✅ |
| `/pos/laporan/laba-rugi` | Laporan Laba Rugi | ✅ |
| `/pos/laporan/kasir` | Laporan per Kasir | ✅ |
| `/pos/laporan/stok` | Laporan Stok | ✅ |
| `/pos/laporan/cashflow` | Laporan Cashflow | ✅ **S1-01** |
| `/pos/analitik` | Analitik RFM Pelanggan | ✅ |
| `/pos/transfer-stok` | Transfer Stok | ✅ |
| `/pos/laporan/outlet` | Laporan Outlet | ✅ |
| `/pos/audit` | Audit Trail | ✅ |
| `/pos/akses` | Manajemen Akses | ✅ |
| `/pos/promosi` | Promosi & Voucher | ✅ |
| `/pos/loyalty` | Program Loyalty + Notif Expiry | ✅ |
| `/pos/integrasi` | Integrasi Marketplace | ✅ |
| `/pos/analitik-produk` | Analitik Produk (slow/dead/turnover) | ❌ Sprint 2 |

### Server API Endpoints (`/api/*`)
| Endpoint | Fungsi | Status |
|----------|--------|--------|
| `GET /api/wilayah` | Proxy data wilayah Indonesia | ✅ |
| `POST /api/assign-courier` | Auto-assign kurir terdekat | ✅ |
| `POST /api/xendit/create-invoice` | Buat invoice pembayaran | ✅ |
| `GET /api/xendit/check-status` | Cek status pembayaran | ✅ |
| `POST /api/xendit/webhook` | Terima notif pembayaran | ✅ |
| `POST /api/webhook/marketplace-order` | Import order ke POS | ✅ **S1-05** |
| `POST /api/pos/sync-stock` | Trigger sync stok manual | ✅ **S1-04** |

---

## 🗄️ Database Migrations

| File | Fase | Status |
|------|------|--------|
| `20260508000000_phase1_pos_saas.sql` | Phase 1 — Core | ✅ Dibuat |
| `20260509000000_phase2_pos_purchase_kas.sql` | Phase 2 — Pembelian & Kas | ✅ Dibuat |
| `20260510000000_phase4_multioutlet_audit.sql` | Phase 4 — Multi-outlet | ✅ Dibuat |
| `20260511000000_phase5_loyalty_promosi.sql` | Phase 5 — Loyalty & Promo | ✅ Dibuat |
| `20260512000000_phase6_marketplace_integration.sql` | Phase 6 — Integrasi | ✅ Dibuat |

> **Penting:** Jalankan semua migration secara berurutan di **Supabase Dashboard → SQL Editor**.

---

*Diperbarui: 8 Mei 2026 — setelah Sprint 1 (5 fitur + 2 quick wins) selesai dikerjakan.*
