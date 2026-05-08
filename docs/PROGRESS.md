# DesaMart — Progress Fitur

> Terakhir diperbarui: 8 Mei 2026
> Platform: React 18 + TypeScript + Vite + Supabase
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

## 🏪 POS SaaS (Point of Sale)

### PHASE 1 — Core Kasir & Master Data
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 1.1 | Setup wizard usaha baru | ✅ | `/pos/setup` |
| 1.2 | Dashboard ringkasan (KPI, grafik 7 hari, stok menipis) | ✅ | `/pos` |
| 1.3 | **Kasir / POS terminal** — grid produk, add to cart, diskon per item | ✅ | `/pos/kasir` |
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

### PHASE 2 — Pembelian & Kas Harian
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 2.1 | Purchase Order ke supplier (buat, terima barang, update stok otomatis) | ✅ | `/pos/pembelian` |
| 2.2 | Hutang dagang & status PO (Draft → Diterima → Selesai) | ✅ | `/pos/pembelian` |
| 2.3 | Retur barang ke supplier | ✅ | `/pos/pembelian` |
| 2.4 | Sesi kasir buka/tutup shift | ✅ | `/pos/kas` |
| 2.5 | Mutasi kas manual (tambah/kurangi kas) | ✅ | `/pos/kas` |
| 2.6 | Selisih saldo & laporan sesi | ✅ | `/pos/kas` |

### PHASE 3 — Laporan Lanjutan & Analitik
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 3.1 | Laporan Laba Rugi (statement akuntansi, margin, grafik) | ✅ | `/pos/laporan/laba-rugi` |
| 3.2 | Laporan per Kasir (ranking, jam sibuk, performa sesi) | ✅ | `/pos/laporan/kasir` |
| 3.3 | Laporan Stok (alert menipis, mutasi, grafik terlaris) | ✅ | `/pos/laporan/stok` |
| 3.4 | Analitik RFM Pelanggan (6 segmen, top 20, tren) | ✅ | `/pos/analitik` |
| 3.5 | Laporan Cashflow (arus kas masuk/keluar, grafik bulanan) | ❌ 🔴 | `/pos/laporan/cashflow` |

### PHASE 4 — Multi-outlet & Audit Trail
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 4.1 | Transfer stok antar outlet (Draft → Approve → Selesai) | ✅ | `/pos/transfer-stok` |
| 4.2 | Laporan perbandingan outlet (grafik harian, kontribusi %) | ✅ | `/pos/laporan/outlet` |
| 4.3 | Audit trail aktivitas pengguna (log old/new values) | ✅ | `/pos/audit` |
| 4.4 | Manajemen akses granular per outlet | ✅ | `/pos/akses` |

### PHASE 5 — Loyalty, Promosi & Diskon
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
| 5.9 | **Integrasi loyalty di Kasir** — tampil saldo poin + tier badge | ✅ | `/pos/kasir` |
| 5.10 | **Tukar poin sebagai diskon** saat checkout di kasir | ✅ | `/pos/kasir` |
| 5.11 | **Auto-apply promosi terbaik** di kasir | ✅ | `/pos/kasir` |
| 5.12 | **Input & validasi kode voucher** di kasir | ✅ | `/pos/kasir` |
| 5.13 | Estimasi poin diperoleh sebelum bayar | ✅ | `/pos/kasir` |
| 5.14 | Success dialog: ringkasan poin earned/redeemed/saldo baru | ✅ | `/pos/kasir` |
| 5.15 | Update saldo poin & tier otomatis setelah transaksi | ✅ | `/pos/kasir` |
| 5.16 | Kartu member digital (QR code untuk di-scan kasir) | ❌ 🟡 | — |
| 5.17 | Notifikasi expiry poin ke pelanggan | ❌ 🟡 | — |

### PHASE 6 — Integrasi Marketplace & API
| No | Fitur | Status | Rute |
|----|-------|--------|------|
| 6.1 | Tautkan produk POS ↔ produk marketplace | ✅ | `/pos/integrasi` |
| 6.2 | Sinkronisasi stok POS → marketplace | ✅ | `/pos/integrasi` |
| 6.3 | Toggle sinkron stok/harga per produk | ✅ | `/pos/integrasi` |
| 6.4 | Import order marketplace ke POS | ✅ | `/pos/integrasi` |
| 6.5 | Log sinkronisasi (berhasil/sebagian/gagal, durasi) | ✅ | `/pos/integrasi` |
| 6.6 | Pengaturan integrasi (toko, auto-sync, interval) | ✅ | `/pos/integrasi` |
| 6.7 | Auto-sync stok berkala (cron/scheduled) | ❌ 🟡 | — |
| 6.8 | Webhook order marketplace (real-time push) | ❌ 🟡 | — |
| 6.9 | API publik untuk third-party (REST + API Key) | ❌ 🟢 | — |

### PHASE 7 — Belum Dikerjakan (Roadmap)
| No | Fitur | Status | Prioritas |
|----|-------|--------|-----------|
| 7.1 | Laporan cashflow bulanan otomatis | ❌ | 🔴 |
| 7.2 | Printer thermal (ESC/POS via Web Serial API) | ❌ | 🔴 |
| 7.3 | Notifikasi WhatsApp (struk digital, promo, poin) | ❌ | 🔴 |
| 7.4 | PWA offline-capable (IndexedDB sync) | ❌ | 🔴 |
| 7.5 | Auto-reorder point (notif stok < threshold) | ❌ | 🟡 |
| 7.6 | Split payment (sebagian tunai + sebagian QRIS) | ❌ | 🟡 |
| 7.7 | Cetak label produk dengan barcode | ❌ | 🟡 |
| 7.8 | Analitik produk (slow-moving, dead stock, turnover) | ❌ | 🟡 |
| 7.9 | Mode kiosk / self-checkout | ❌ | 🟢 |
| 7.10 | Integrasi akuntansi (export jurnal umum, MYOB, Accurate) | ❌ | 🟢 |
| 7.11 | Kartu member digital (QR code member) | ❌ | 🟡 |
| 7.12 | Dashboard multi-brand / multi-toko | ❌ | 🟢 |

---

## 🛒 Marketplace DesaMart

### Pembeli (role: `buyer`)
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
| B.13 | Program poin / loyalitas pembeli marketplace | ❌ 🔴 |
| B.14 | Kupon & voucher platform (kode diskon dari platform) | ❌ 🔴 |
| B.15 | Flash sale & limited-time deals | ❌ 🔴 |
| B.16 | Rekomendasi produk personal | ❌ 🔴 |
| B.17 | Lacak kurir live (real-time GPS) | ❌ 🟡 |
| B.18 | Notifikasi restok produk favorit | ❌ 🟡 |
| B.19 | Perbandingan produk berdampingan | ❌ 🟡 |
| B.20 | Cashback & reward program | ❌ 🟡 |
| B.21 | Struk digital (QR / link) | ❌ 🟢 |
| B.22 | Layanan langganan produk rutin | ❌ 🟢 |
| B.23 | Program afiliasi / referral | ❌ 🟢 |

### Merchant / Pemilik Toko (role: `merchant`)
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
| M.11 | Export laporan ke PDF / Excel | ❌ 🔴 |
| M.12 | Notifikasi WhatsApp ke pelanggan | ❌ 🔴 |
| M.13 | Flash sale / promo waktu terbatas di toko | ❌ 🔴 |
| M.14 | Auto-reorder point stok | ❌ 🟡 |
| M.15 | Cetak label produk | ❌ 🟡 |

### Kurir (role: `courier`)
| No | Fitur | Status |
|----|-------|--------|
| K.1 | Dashboard kurir | ✅ |
| K.2 | Daftar order yang perlu diantarkan | ✅ |
| K.3 | Update status pengiriman | ✅ |
| K.4 | Riwayat pengiriman & pendapatan | ✅ |
| K.5 | Ojek Desa — ride hailing lokal | ✅ |
| K.6 | Notifikasi order baru | ✅ |
| K.7 | Auto-assign kurir terdekat (Edge Function) | ✅ |
| K.8 | Navigasi GPS (buka Google Maps dari order) | ❌ 🔴 |
| K.9 | Bukti kirim foto (upload saat selesai antar) | ❌ 🔴 |
| K.10 | Rating kurir oleh pembeli | ❌ 🔴 |
| K.11 | Rekap pendapatan harian/mingguan | ❌ 🔴 |
| K.12 | Toggle online/offline kurir | ❌ 🟡 |
| K.13 | Chat dengan pembeli saat pengiriman | ❌ 🟡 |
| K.14 | Multi-order batching | ❌ 🟡 |
| K.15 | Laporan performa kurir | ❌ 🟡 |
| K.16 | Sistem insentif & bonus target | ❌ 🟢 |

### Verifikator (role: `verifikator`)
| No | Fitur | Status |
|----|-------|--------|
| V.1 | Dashboard verifikator | ✅ |
| V.2 | Approve/reject merchant baru | ✅ |
| V.3 | Monitoring merchant di desa | ✅ |
| V.4 | Laporan ekonomi desa | ❌ 🔴 |
| V.5 | Manajemen event desa | ❌ 🔴 |

### Admin Desa (role: `admin_desa`)
| No | Fitur | Status |
|----|-------|--------|
| AD.1 | Dashboard desa | ✅ |
| AD.2 | Manajemen destinasi wisata desa | ✅ |
| AD.3 | Profil desa (nama, foto, deskripsi) | ✅ |
| AD.4 | Lihat merchant yang terdaftar di desa | ✅ |
| AD.5 | Laporan ekonomi desa (total omzet UMKM) | ❌ 🔴 |
| AD.6 | Manajemen event desa (pasar malam, festival) | ❌ 🔴 |
| AD.7 | Keanggotaan UMKM (daftar, verifikasi, sertifikat) | ❌ 🔴 |
| AD.8 | Peta interaktif lokasi merchant & wisata | ❌ 🟡 |
| AD.9 | Broadcast pengumuman ke merchant desa | ❌ 🟡 |
| AD.10 | Laporan kunjungan wisatawan | ❌ 🟡 |

### Super Admin (role: `admin`)
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
| SA.10 | Dashboard analitik real-time (GMV, konversi) | ❌ 🔴 |
| SA.11 | Manajemen komisi & fee per kategori | ❌ 🔴 |
| SA.12 | Broadcast notifikasi ke semua user | ❌ 🔴 |
| SA.13 | Audit log platform | ❌ 🟡 |
| SA.14 | Manajemen banner & promosi platform | ❌ 🟡 |
| SA.15 | Export laporan ke PDF/Excel | ❌ 🟡 |
| SA.16 | Manajemen API key third-party | ❌ 🟢 |

---

## 📊 Ringkasan Progress

### POS SaaS

| Phase | Total Fitur | ✅ Selesai | ❌ Belum | % Selesai |
|-------|------------|-----------|---------|----------|
| Phase 1 — Core Kasir | 18 | 18 | 0 | **100%** |
| Phase 2 — Pembelian & Kas | 6 | 6 | 0 | **100%** |
| Phase 3 — Laporan Lanjutan | 5 | 4 | 1 | **80%** |
| Phase 4 — Multi-outlet & Audit | 4 | 4 | 0 | **100%** |
| Phase 5 — Loyalty & Promosi | 17 | 15 | 2 | **88%** |
| Phase 6 — Integrasi Marketplace | 9 | 6 | 3 | **67%** |
| Phase 7 — Roadmap Lanjutan | 12 | 0 | 12 | **0%** |
| **TOTAL POS** | **71** | **53** | **18** | **75%** |

### Marketplace DesaMart

| Role | Total Fitur | ✅ Selesai | ❌ Belum | % Selesai |
|------|------------|-----------|---------|----------|
| Pembeli | 23 | 12 | 11 | **52%** |
| Merchant | 15 | 10 | 5 | **67%** |
| Kurir | 16 | 7 | 9 | **44%** |
| Verifikator | 5 | 3 | 2 | **60%** |
| Admin Desa | 10 | 4 | 6 | **40%** |
| Super Admin | 16 | 9 | 7 | **56%** |
| **TOTAL Marketplace** | **85** | **45** | **40** | **53%** |

---

## 🗄️ Database Migrations

| File | Fase | Status |
|------|------|--------|
| `20260508000000_phase1_pos_saas.sql` | Phase 1 — Core | ✅ Dibuat, perlu dijalankan di Supabase |
| `20260509000000_phase2_pos_purchase_kas.sql` | Phase 2 — Pembelian & Kas | ✅ Dibuat, perlu dijalankan di Supabase |
| `20260510000000_phase4_multioutlet_audit.sql` | Phase 4 — Multi-outlet | ✅ Dibuat, perlu dijalankan di Supabase |
| `20260511000000_phase5_loyalty_promosi.sql` | Phase 5 — Loyalty & Promo | ✅ Dibuat, perlu dijalankan di Supabase |
| `20260512000000_phase6_marketplace_integration.sql` | Phase 6 — Integrasi | ✅ Dibuat, perlu dijalankan di Supabase |

> **Penting:** Jalankan semua migration secara berurutan di **Supabase Dashboard → SQL Editor**.

---

## 🗺️ Halaman & Route Lengkap

### POS SaaS (`/pos/*`)

| Route | Halaman | Phase | Status |
|-------|---------|-------|--------|
| `/pos` | Dashboard | 1 | ✅ |
| `/pos/kasir` | Kasir + Loyalty + Promosi + Voucher | 1 + 5 | ✅ |
| `/pos/transaksi` | Riwayat Transaksi | 1 | ✅ |
| `/pos/retur` | Retur Penjualan | 1 | ✅ |
| `/pos/produk` | Manajemen Produk | 1 | ✅ |
| `/pos/kategori` | Kategori | 1 | ✅ |
| `/pos/customer` | Data Pelanggan | 1 | ✅ |
| `/pos/supplier` | Data Supplier | 1 | ✅ |
| `/pos/stok` | Manajemen Stok | 1 | ✅ |
| `/pos/laporan` | Laporan Dasar | 1 | ✅ |
| `/pos/pengguna` | Pengguna POS | 1 | ✅ |
| `/pos/pengaturan` | Pengaturan Usaha | 1 | ✅ |
| `/pos/pembelian` | Purchase Order | 2 | ✅ |
| `/pos/kas` | Kas Harian | 2 | ✅ |
| `/pos/laporan/laba-rugi` | Laporan Laba Rugi | 3 | ✅ |
| `/pos/laporan/kasir` | Laporan per Kasir | 3 | ✅ |
| `/pos/laporan/stok` | Laporan Stok | 3 | ✅ |
| `/pos/analitik` | Analitik RFM Pelanggan | 3 | ✅ |
| `/pos/transfer-stok` | Transfer Stok | 4 | ✅ |
| `/pos/laporan/outlet` | Laporan Outlet | 4 | ✅ |
| `/pos/audit` | Audit Trail | 4 | ✅ |
| `/pos/akses` | Manajemen Akses | 4 | ✅ |
| `/pos/promosi` | Promosi & Voucher | 5 | ✅ |
| `/pos/loyalty` | Program Loyalty | 5 | ✅ |
| `/pos/integrasi` | Integrasi Marketplace | 6 | ✅ |
| `/pos/laporan/cashflow` | Laporan Cashflow | 7 | ❌ |

---

*Dibuat otomatis oleh sistem DesaMart Development — 8 Mei 2026*
