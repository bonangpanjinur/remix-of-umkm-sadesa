# DesaMart POS SaaS — Progress Report

> Terakhir diperbarui: 9 Mei 2026
> Platform: React 18 + TypeScript + Vite + Supabase
> Jalur: `/pos/*` (terpisah dari marketplace DesaMart)

---

## Ringkasan Fase

| Fase | Nama | Status |
|------|------|--------|
| **Phase 1** | POS Core + Master Data + Stok Dasar | ✅ Selesai |
| **Phase 2** | Pembelian & Kas Harian | ✅ Selesai |
| **Phase 3** | Laporan Lanjutan & Analitik Pelanggan | ✅ Selesai |
| **Phase 4** | Multi-outlet & Manajemen Shift | ⬜ Belum |
| **Phase 5** | Loyalty, Promosi & Diskon | ⬜ Belum |
| **Phase 6** | Integrasi Marketplace & API Publik | ⬜ Belum |

---

## ✅ PHASE 1 — Selesai

### 1.1 Database (Supabase Migration)

**File:** `supabase/migrations/20260508000000_phase1_pos_saas.sql`

| Tabel | Keterangan | Status |
|-------|-----------|--------|
| `pos_tenants` | Data usaha (nama, logo, mata uang, pajak) | ✅ |
| `pos_outlets` | Outlet/cabang per tenant | ✅ |
| `pos_users` | Pengguna POS dengan 7 role + PIN | ✅ |
| `pos_categories` | Kategori produk (mendukung sub-kategori) | ✅ |
| `pos_brands` | Brand/merek produk | ✅ |
| `pos_products` | Produk utama (harga, HPP, barcode, SKU, pajak) | ✅ |
| `pos_product_variants` | Varian produk (warna, ukuran, dll.) | ✅ |
| `pos_stock` | Stok per produk per outlet | ✅ |
| `pos_stock_mutations` | Riwayat perubahan stok | ✅ |
| `pos_customers` | Data pelanggan + statistik pembelian | ✅ |
| `pos_suppliers` | Data supplier/pemasok | ✅ |
| `pos_sales` | Header transaksi penjualan | ✅ |
| `pos_sale_items` | Detail item per transaksi | ✅ |
| `pos_held_bills` | Transaksi yang ditahan (hold) | ✅ |
| `pos_sale_returns` | Header retur penjualan | ✅ |
| `pos_sale_return_items` | Detail item retur | ✅ |

> **Catatan:** Semua migration SQL harus dijalankan manual di **Supabase Dashboard → SQL Editor**.

---

### 1.2 Core Infrastructure

| File | Fungsi | Status |
|------|--------|--------|
| `src/contexts/POSContext.tsx` | State tenant, outlet aktif, format mata uang | ✅ |
| `src/components/pos/POSLayout.tsx` | Wrapper layout POS (header + sidebar) | ✅ |
| `src/components/pos/POSSidebar.tsx` | Sidebar navigasi 19 menu item (termasuk Phase 2 & 3) | ✅ |
| `src/components/pos/BarcodeScanner.tsx` | Kamera barcode scanner (`@zxing/browser`) | ✅ |
| `src/App.tsx` | Route `/pos/*` lengkap Phase 1–3 | ✅ |

---

### 1.3 Halaman POS

#### POSSetupPage — Wizard Setup Usaha
**Route:** `/pos/setup`
- [x] Step 1: Nama usaha, jenis usaha, mata uang, format pajak
- [x] Step 2: Setup outlet pertama (nama, alamat, telepon)
- [x] Redirect otomatis ke dashboard setelah setup

#### POSDashboardPage — Dashboard Utama
**Route:** `/pos`
- [x] Kartu statistik: Penjualan hari ini, jumlah transaksi, produk terjual, pelanggan baru
- [x] Grafik penjualan 7 hari terakhir (Recharts BarChart)
- [x] Alert stok menipis
- [x] Shortcut navigasi cepat

#### POSKasirPage — Kasir / Point of Sale
**Route:** `/pos/kasir`
- [x] Grid produk + filter kategori + search (nama, SKU, barcode)
- [x] Barcode scanner kamera (`@zxing/browser`)
- [x] Dialog pilih varian produk
- [x] Keranjang belanja dengan qty +/- dan hapus item
- [x] Diskon per item dan diskon global
- [x] Pilih/cari pelanggan + input nama bebas
- [x] Hold bill & Resume bill
- [x] Dialog pembayaran: Tunai, QRIS, Transfer, Debit
- [x] Hitung kembalian otomatis + tombol nominal cepat
- [x] Cetak struk (`window.print()`)
- [x] Update stok & statistik pelanggan otomatis
- [x] Keyboard shortcuts (F2, F3, F8, Esc)

#### POSTransaksiPage — Riwayat Transaksi
**Route:** `/pos/transaksi`
- [x] List transaksi + filter tanggal & rentang kustom
- [x] Detail transaksi (modal), export CSV

#### POSReturPage — Retur Penjualan
**Route:** `/pos/retur`
- [x] Cari transaksi, pilih item & jumlah retur
- [x] Opsi restock + update stok otomatis

#### POSProdukPage — Manajemen Produk
**Route:** `/pos/produk`
- [x] CRUD produk (SKU, barcode, harga, HPP, pajak, varian, gambar)
- [x] Kalkulasi margin otomatis, export CSV

#### POSKategoriPage — Manajemen Kategori | POSCustomerPage — Pelanggan
**Route:** `/pos/kategori` | `/pos/customer`
- [x] CRUD kategori & sub-kategori + CRUD pelanggan dengan statistik

#### POSSupplierPage — Supplier | POSStokPage — Stok | POSLaporanPage — Laporan Penjualan
**Route:** `/pos/supplier` | `/pos/stok` | `/pos/laporan`
- [x] CRUD supplier + manajemen stok + laporan penjualan dasar (grafik, top produk, metode bayar)

#### POSPenggunaPage — Pengguna | POSPengaturanPage — Pengaturan
**Route:** `/pos/pengguna` | `/pos/pengaturan`
- [x] 7 role pengguna + PIN kasir + pengaturan usaha & outlet

---

## ✅ PHASE 2 — Selesai

### 2.1 Database

**File:** `supabase/migrations/20260509000000_phase2_pos_purchase_kas.sql`

| Tabel | Keterangan | Status |
|-------|-----------|--------|
| `pos_purchase_orders` | Header Purchase Order ke supplier | ✅ |
| `pos_purchase_order_items` | Detail item per PO | ✅ |
| `pos_purchase_returns` | Retur barang ke supplier | ✅ |
| `pos_purchase_return_items` | Detail item retur supplier | ✅ |
| `pos_cash_sessions` | Sesi kasir (buka/tutup shift) | ✅ |
| `pos_cash_mutations` | Mutasi kas manual (masuk/keluar non-penjualan) | ✅ |

---

### 2.2 Halaman Phase 2

#### POSPembelianPage — Purchase Order ke Supplier
**Route:** `/pos/pembelian` | **File:** `src/pages/pos/POSPembelianPage.tsx`

- [x] Kartu ringkasan status PO (Draft, Dikirim, Sebagian, Selesai, Dibatalkan)
- [x] Ringkasan hutang dagang: total nilai, dibayar, sisa
- [x] Buat PO baru: pilih supplier, No PO auto-generate, estimasi tiba
- [x] Tambah item dari master produk atau manual, qty, harga beli, diskon, pajak
- [x] Flow status: Draft → Dikirim → Terima Barang → Selesai / Sebagian
- [x] Penerimaan barang: update stok `pos_stock` + catat `pos_stock_mutations` otomatis
- [x] Filter status & search, export CSV

#### POSKasPage — Kas Harian
**Route:** `/pos/kas` | **File:** `src/pages/pos/POSKasPage.tsx`

- [x] Buka sesi kasir (saldo awal, nama kasir, No sesi auto-generate)
- [x] Kalkulasi real-time: Saldo Awal + Penjualan Tunai + Kas Masuk − Kas Keluar
- [x] Kas masuk/keluar manual dengan kategori (modal, gaji, biaya operasional, dll.)
- [x] Tutup sesi: input saldo aktual, auto-hitung selisih lebih/kurang
- [x] Tab Mutasi Kas & Riwayat Sesi, export CSV

---

## ✅ PHASE 3 — Selesai

### 3.1 Halaman Phase 3

#### POSLaporanLabaRugiPage — Laporan Laba Rugi + HPP
**Route:** `/pos/laporan/laba-rugi` | **File:** `src/pages/pos/POSLaporanLabaRugiPage.tsx`

- [x] **Periode fleksibel:** Hari ini, Minggu, Bulan, Tahun, Kustom (range bebas)
- [x] **KPI Cards:**
  - Omzet penjualan + jumlah transaksi
  - HPP (Harga Pokok Penjualan) + Gross Margin %
  - Laba Kotor (Omzet − HPP − Retur − Diskon)
  - Laba Bersih + Net Profit Margin %
- [x] **Statement Laba Rugi** format akuntansi:
  - Pendapatan: Omzet, (-) Diskon, (-) Retur, (-) HPP → Laba Kotor
  - Beban: rincian per kategori (operasional, gaji, dll.) → Total Beban
  - **Laba/Rugi Bersih**
- [x] **Grafik Bar:** Omzet vs HPP vs Laba Kotor per hari/bulan
- [x] **Top 10 Produk** berdasar laba kotor dengan margin % per produk
- [x] Export CSV + Cetak (`window.print()`)

#### POSLaporanKasirPage — Laporan Per Kasir
**Route:** `/pos/laporan/kasir` | **File:** `src/pages/pos/POSLaporanKasirPage.tsx`

- [x] **Periode fleksibel** + filter kasir
- [x] **Banner kasir terbaik** (top omzet + kontribusi %)
- [x] **Tabel performa kasir:** transaksi, omzet, diskon, avg/transaksi, total item
- [x] **Grafik bar horizontal** omzet per kasir
- [x] **Tab Jam Sibuk:** grafik transaksi & omzet per jam (06:00–22:00)
- [x] **Tab Riwayat Sesi Kasir:** saldo awal, akhir, selisih per sesi
- [x] **Detail kasir terpilih** dengan klik baris
- [x] Export CSV

#### POSLaporanStokPage — Laporan Pergerakan Stok
**Route:** `/pos/laporan/stok` | **File:** `src/pages/pos/POSLaporanStokPage.tsx`

- [x] **Filter tanggal** bebas (range kustom)
- [x] **Alert banner** stok menipis/habis dengan badge per produk
- [x] **KPI Cards:** Total produk, Total Masuk, Total Keluar, Stok Habis
- [x] **Tab Ringkasan Stok:**
  - Stok saat ini, total masuk/keluar/terjual/dibeli/adjust per produk
  - Badge status: Normal / Menipis / Habis
  - Search produk
- [x] **Tab Riwayat Mutasi:**
  - Setiap perubahan stok: tipe, before/after, keterangan
  - Badge tipe berwarna: Penjualan, Pembelian, Retur, Penyesuaian, Transfer
  - Filter per tipe mutasi + search produk
- [x] **Tab Grafik:** Top 8 produk paling banyak terjual (horizontal bar chart)
- [x] Export CSV

#### POSAnalitikPage — Analitik Pelanggan
**Route:** `/pos/analitik` | **File:** `src/pages/pos/POSAnalitikPage.tsx`

- [x] **Filter periode:** 1, 3, 6, 12 bulan terakhir
- [x] **KPI Cards:** Total pelanggan, Champions count, Rata-rata belanja, Perlu perhatian
- [x] **Tab Top Pelanggan:**
  - Top 20 pelanggan berdasar nilai belanja
  - Ikon medali (emas, perak, perunggu) untuk 3 teratas
  - Kolom: total belanja, jumlah transaksi, avg/transaksi, terakhir belanja, segmen RFM
  - Indikator "N hari lalu" dengan warna merah jika > 60 hari
- [x] **Tab Segmentasi RFM:**
  - 6 segmen: Champions, Pelanggan Setia, Potensi Loyal, Pelanggan Baru, Perlu Perhatian, Hilang
  - Pie chart distribusi segmen
  - Progress bar per segmen dengan persentase
- [x] **Tab Tren & Pembayaran:**
  - Grafik stacked bar: Pelanggan Baru vs Kembali per bulan
  - Breakdown metode pembayaran: progress bar nilai + persentase
  - Grafik top 8 produk terlaris berdasar omzet
- [x] Export CSV

---

### 3.2 Navigasi & Routing Phase 3

| Menu Sidebar | Route | Status |
|---|---|---|
| Lap. Penjualan (existing) | `/pos/laporan` | ✅ |
| Lap. Laba Rugi (ikon TrendingUp) | `/pos/laporan/laba-rugi` | ✅ |
| Lap. Per Kasir (ikon UserCheck) | `/pos/laporan/kasir` | ✅ |
| Lap. Stok (ikon BoxesIcon) | `/pos/laporan/stok` | ✅ |
| Analitik Pelanggan (ikon PieChart) | `/pos/analitik` | ✅ |

---

## ⬜ PHASE 4 — Belum Dikerjakan

### Multi-outlet & Audit Trail

- [ ] Transfer stok antar outlet
- [ ] Laporan perbandingan performa antar outlet
- [ ] Shift management (jadwal kasir per outlet)
- [ ] Log aktivitas per user (audit trail)
- [ ] Notifikasi stok menipis (push / email)
- [ ] Hak akses per outlet per user (lebih granular)

---

## ⬜ PHASE 5 — Belum Dikerjakan

### Loyalty, Promosi & Diskon

- [ ] Tabel DB: `pos_loyalty_points`, `pos_promotions`, `pos_vouchers`
- [ ] Program poin pelanggan (earn & redeem)
- [ ] Diskon otomatis berbasis kondisi (beli X dapat diskon Y)
- [ ] Voucher & kode kupon
- [ ] Promosi bundling (beli A+B harga spesial)
- [ ] Happy hour / diskon waktu tertentu
- [ ] Kartu member digital
- [ ] Halaman `/pos/promosi` & `/pos/loyalty`

---

## ⬜ PHASE 6 — Belum Dikerjakan

### Integrasi Marketplace & API Publik

- [ ] Sinkronisasi produk POS ↔ Marketplace DesaMart
- [ ] Stok terpusat (marketplace & offline POS berbagi stok)
- [ ] Order dari marketplace masuk ke POS sebagai transaksi
- [ ] API publik (REST) untuk integrasi third-party
- [ ] Webhook event (transaksi baru, stok habis, dll.)
- [ ] Integrasi printer thermal (ESC/POS via browser serial API)
- [ ] Mode offline (PWA + IndexedDB sync)

---

## Catatan Teknis

### SQL Migration — Urutan Eksekusi

```
1. supabase/migrations/20260508000000_phase1_pos_saas.sql   → Phase 1 (Core)
2. supabase/migrations/20260509000000_phase2_pos_purchase_kas.sql → Phase 2
```

> Phase 3 tidak membutuhkan migration DB baru — semua halaman membaca tabel yang sudah ada.

### Struktur File Lengkap POS

```
src/
├── contexts/
│   └── POSContext.tsx                    ← State global POS
├── components/pos/
│   ├── POSLayout.tsx
│   ├── POSSidebar.tsx                    ← 19 menu item
│   └── BarcodeScanner.tsx
└── pages/pos/
    ├── POSSetupPage.tsx                  ← Phase 1
    ├── POSDashboardPage.tsx              ← Phase 1
    ├── POSKasirPage.tsx                  ← Phase 1
    ├── POSTransaksiPage.tsx              ← Phase 1
    ├── POSReturPage.tsx                  ← Phase 1
    ├── POSProdukPage.tsx                 ← Phase 1
    ├── POSKategoriPage.tsx               ← Phase 1
    ├── POSCustomerPage.tsx               ← Phase 1
    ├── POSSupplierPage.tsx               ← Phase 1
    ├── POSStokPage.tsx                   ← Phase 1
    ├── POSLaporanPage.tsx                ← Phase 1
    ├── POSPenggunaPage.tsx               ← Phase 1
    ├── POSPengaturanPage.tsx             ← Phase 1
    ├── POSPembelianPage.tsx              ← Phase 2
    ├── POSKasPage.tsx                    ← Phase 2
    ├── POSLaporanLabaRugiPage.tsx        ← Phase 3
    ├── POSLaporanKasirPage.tsx           ← Phase 3
    ├── POSLaporanStokPage.tsx            ← Phase 3
    └── POSAnalitikPage.tsx               ← Phase 3

supabase/migrations/
├── 20260508000000_phase1_pos_saas.sql
└── 20260509000000_phase2_pos_purchase_kas.sql
```

### Dependencies yang Digunakan

Tidak ada package tambahan di Phase 2 & 3. Semua memanfaatkan:

| Package | Fungsi |
|---------|--------|
| `@supabase/supabase-js` | Database queries + auth |
| `recharts` | Grafik (Bar, Line, Pie, Area) |
| `date-fns` | Format & kalkulasi tanggal |
| `lucide-react` | Ikon UI |
| `sonner` | Toast notifications |
| `shadcn/ui` | Komponen UI (Table, Dialog, Badge, Tabs, dll.) |

### Alur Data Laporan Laba Rugi

```
pos_sales (omzet)
  + pos_sale_items.cost_price × qty → HPP
  + pos_sale_returns.total_refund   → Retur
  + pos_cash_mutations (type=out)   → Beban Operasional
  = Laba Bersih
```

### Segmentasi RFM — Logika Klasifikasi

| Segmen | Recency | Frequency | Value |
|--------|---------|-----------|-------|
| Champions | ≤ 30 hari | ≥ 3 kali | ≥ rata-rata |
| Pelanggan Setia | — | ≥ 3 kali | ≥ rata-rata |
| Potensi Loyal | ≤ 30 hari | ≥ 3 kali | < rata-rata |
| Pelanggan Baru | ≤ 30 hari | 1 kali | — |
| Perlu Perhatian | > 30 hari | ≥ 3 kali | — |
| Hilang | > 90 hari | — | — |
