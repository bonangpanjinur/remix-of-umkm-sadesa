# DesaMart POS SaaS — Progress Report

> Terakhir diperbarui: 9 Mei 2026
> Platform: React 18 + TypeScript + Vite + Supabase
> Jalur: `/pos/*` (terpisah dari marketplace DesaMart)

---

## Ringkasan Fase

| Fase | Nama | Status |
|------|------|--------|
| **Phase 1** | POS + Master Data + Stok Dasar | ✅ Selesai |
| **Phase 2** | Pembelian & Kas Harian | ✅ Selesai |
| **Phase 3** | Laporan Lanjutan & Analitik | ⬜ Belum |
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

> **Catatan:** Migration SQL belum dijalankan otomatis. Harus di-paste ke **Supabase Dashboard → SQL Editor** dan dijalankan secara manual.

Semua tabel sudah dilengkapi:
- Row Level Security (RLS) policies
- Index untuk query performa tinggi
- Foreign key constraints
- `created_at` / `updated_at` timestamps

---

### 1.2 Core Infrastructure

| File | Fungsi | Status |
|------|--------|--------|
| `src/contexts/POSContext.tsx` | State tenant, outlet aktif, format mata uang, outlet switcher | ✅ |
| `src/components/pos/POSLayout.tsx` | Wrapper layout POS (header + sidebar) | ✅ |
| `src/components/pos/POSSidebar.tsx` | Sidebar navigasi lengkap dengan outlet selector + menu Phase 2 | ✅ |
| `src/components/pos/BarcodeScanner.tsx` | Kamera barcode scanner menggunakan `@zxing/browser` | ✅ |
| `src/App.tsx` | Route `/pos/*` + `POSProvider` wrapper + route Phase 2 | ✅ |

---

### 1.3 Halaman POS (`src/pages/pos/`)

#### POSSetupPage — Wizard Setup Usaha
**Route:** `/pos/setup`
- [x] Step 1: Nama usaha, jenis usaha, mata uang, format pajak
- [x] Step 2: Setup outlet pertama (nama, alamat, telepon)
- [x] Redirect otomatis ke dashboard setelah setup selesai

#### POSDashboardPage — Dashboard Utama
**Route:** `/pos`
- [x] Kartu statistik: Penjualan hari ini, jumlah transaksi, produk terjual, pelanggan baru
- [x] Grafik penjualan 7 hari terakhir (Recharts BarChart)
- [x] Alert stok menipis (produk dengan stok ≤ minimum)
- [x] Shortcut navigasi cepat ke Kasir, Produk, Stok, Laporan

#### POSKasirPage — Kasir / Point of Sale
**Route:** `/pos/kasir`
- [x] Grid produk dengan gambar, harga, stok real-time
- [x] Filter kategori horizontal
- [x] Search produk (nama, SKU, barcode)
- [x] Barcode scanner kamera (powered by `@zxing/browser`)
- [x] Dialog pilih varian produk
- [x] Keranjang belanja dengan qty +/- dan hapus item
- [x] Diskon per item dan diskon global transaksi
- [x] Pilih/cari pelanggan (dengan badge Member)
- [x] Input nama pelanggan bebas
- [x] Catatan per transaksi
- [x] Hold bill & Resume bill
- [x] Dialog pembayaran: Tunai, QRIS, Transfer, Debit
- [x] Hitung kembalian otomatis
- [x] Tombol nominal cepat
- [x] Cetak struk (`window.print()`)
- [x] Update stok & statistik pelanggan otomatis
- [x] Keyboard shortcuts (F2, F3, F8, Esc)

#### POSTransaksiPage — Riwayat Transaksi
**Route:** `/pos/transaksi`
- [x] List transaksi dengan filter tanggal & rentang kustom
- [x] Ringkasan omset, jumlah transaksi, rata-rata
- [x] Detail transaksi (modal)
- [x] Export CSV
- [x] Badge status transaksi

#### POSReturPage — Retur Penjualan
**Route:** `/pos/retur`
- [x] Cari transaksi berdasarkan nomor transaksi
- [x] Pilih item & jumlah retur
- [x] Opsi restock barang
- [x] Update stok otomatis
- [x] List retur yang sudah diproses

#### POSProdukPage — Manajemen Produk
**Route:** `/pos/produk`
- [x] List produk dengan filter & search
- [x] Form tambah/edit produk (SKU, barcode, harga, HPP, pajak)
- [x] Upload gambar produk
- [x] Manajemen varian produk
- [x] Kalkulasi margin otomatis
- [x] Export CSV

#### POSKategoriPage — Manajemen Kategori
**Route:** `/pos/kategori`
- [x] CRUD kategori & sub-kategori
- [x] Sort order & status aktif

#### POSCustomerPage — Manajemen Pelanggan
**Route:** `/pos/customer`
- [x] CRUD pelanggan + toggle Member
- [x] Statistik: total belanja, jumlah transaksi
- [x] Export CSV

#### POSSupplierPage — Manajemen Supplier
**Route:** `/pos/supplier`
- [x] CRUD supplier (nama, kontak, telepon, email, alamat)
- [x] Status aktif/nonaktif

#### POSStokPage — Manajemen Stok
**Route:** `/pos/stok`
- [x] Stok per produk per outlet
- [x] Filter outlet & status stok
- [x] Adjustment stok manual
- [x] Riwayat mutasi stok
- [x] Export CSV

#### POSLaporanPage — Laporan Penjualan
**Route:** `/pos/laporan`
- [x] Periode: Harian, Mingguan, Bulanan, Tahunan
- [x] Grafik penjualan (LineChart Recharts)
- [x] Breakdown metode pembayaran
- [x] Top 5 produk terlaris
- [x] Export CSV

#### POSPenggunaPage — Manajemen Pengguna POS
**Route:** `/pos/pengguna`
- [x] CRUD pengguna POS dengan 7 role
- [x] Set PIN kasir & outlet assignment

#### POSPengaturanPage — Pengaturan Usaha
**Route:** `/pos/pengaturan`
- [x] Edit profil usaha, outlet, brand
- [x] Header/footer struk & format mata uang

---

## ✅ PHASE 2 — Selesai

### 2.1 Database (Supabase Migration)

**File:** `supabase/migrations/20260509000000_phase2_pos_purchase_kas.sql`

| Tabel | Keterangan | Status |
|-------|-----------|--------|
| `pos_purchase_orders` | Header Purchase Order ke supplier | ✅ |
| `pos_purchase_order_items` | Detail item per PO | ✅ |
| `pos_purchase_returns` | Retur barang ke supplier | ✅ |
| `pos_purchase_return_items` | Detail item retur supplier | ✅ |
| `pos_cash_sessions` | Sesi kasir (buka/tutup shift) | ✅ |
| `pos_cash_mutations` | Mutasi kas manual (masuk/keluar non-penjualan) | ✅ |

Semua tabel dilengkapi dengan:
- RLS policies (tenant owner + tenant users)
- Indexes untuk performa query
- Foreign key constraints

> **Catatan:** Migration SQL harus dijalankan di **Supabase Dashboard → SQL Editor**.

---

### 2.2 Halaman Phase 2

#### POSPembelianPage — Purchase Order
**Route:** `/pos/pembelian`
**File:** `src/pages/pos/POSPembelianPage.tsx`

- [x] Summary kartu status (Draft, Dikirim, Diterima Sebagian, Selesai, Dibatalkan)
- [x] Total nilai PO, dibayar, dan sisa hutang dagang
- [x] Filter status PO & search (No PO / nama supplier)
- [x] Buat PO baru:
  - [x] Pilih supplier dari daftar atau input manual
  - [x] Nomor PO auto-generate (format: `PO-YYMMDD-XXXX`)
  - [x] Tanggal PO & estimasi tiba
  - [x] Tambah item produk (dari master produk atau manual)
  - [x] Search produk di form item
  - [x] Qty, satuan, harga beli, diskon per item
  - [x] Auto-hitung subtotal per item & total keseluruhan
  - [x] Diskon global (Rp) & tarif pajak (%)
  - [x] Kolom catatan PO
- [x] Expand baris PO untuk lihat detail item
- [x] Update status: Draft → Dikirim → (Terima Barang) → Selesai / Diterima Sebagian
- [x] Batalkan PO (dari status Draft)
- [x] **Penerimaan barang (Receiving):**
  - [x] Input qty diterima per item (default: sisa yang belum diterima)
  - [x] Update stok otomatis ke `pos_stock` & `pos_stock_mutations`
  - [x] Status PO otomatis berubah: `partial` jika belum semua, `received` jika semua
- [x] Export CSV daftar PO
- [x] Indikator hutang dagang per PO

#### POSKasPage — Kas Harian
**Route:** `/pos/kas`
**File:** `src/pages/pos/POSKasPage.tsx`

- [x] Banner sesi aktif dengan info kasir, waktu buka, saldo awal
- [x] Kalkulasi real-time ekspektasi saldo kas:
  - `Saldo Awal + Penjualan Tunai Hari Ini + Kas Masuk − Kas Keluar`
- [x] Kartu ringkasan: Penjualan Tunai, Non-Tunai, Kas Masuk, Kas Keluar
- [x] **Buka Sesi Kasir:**
  - [x] Input nama kasir
  - [x] Input saldo awal kas
  - [x] Catatan pembukaan (opsional)
  - [x] Nomor sesi auto-generate (format: `KAS-YYMMDD-HHmm`)
- [x] **Tutup Sesi Kasir:**
  - [x] Tampil ringkasan: saldo awal, penjualan tunai, kas masuk/keluar, ekspektasi akhir
  - [x] Input saldo aktual (hitung fisik)
  - [x] Auto-hitung selisih (lebih/kurang)
  - [x] Catatan penutupan (opsional)
- [x] **Kas Masuk Manual** (dari sesi aktif):
  - [x] Kategori: Modal/Setoran, Pembayaran Piutang, dll.
  - [x] Jumlah + keterangan + referensi
- [x] **Kas Keluar Manual** (dari sesi aktif):
  - [x] Kategori: Pembelian Barang, Biaya Operasional, Gaji, Bayar Hutang, dll.
  - [x] Jumlah + keterangan + referensi
- [x] Tab **Mutasi Kas** — riwayat masuk/keluar sesi aktif dengan tipe, kategori, jumlah
- [x] Tab **Riwayat Sesi** — semua sesi tutup dengan detail: saldo awal, akhir, selisih, breakdown
- [x] Export CSV riwayat sesi
- [x] Refresh data manual

---

### 2.3 Navigasi & Routing

| Item | Status |
|------|--------|
| Menu "Pembelian" di sidebar POS (ikon ShoppingBag) | ✅ |
| Menu "Kas Harian" di sidebar POS (ikon Wallet) | ✅ |
| Route `/pos/pembelian` di `App.tsx` | ✅ |
| Route `/pos/kas` di `App.tsx` | ✅ |

---

## ⬜ PHASE 3 — Belum Dikerjakan

### Laporan Lanjutan & Analitik

- [ ] Laporan Laba Rugi (Omset − HPP − Pengeluaran)
- [ ] Laporan HPP (Harga Pokok Penjualan) per periode
- [ ] Laporan per kasir / per user
- [ ] Laporan pergerakan stok (stock movement report)
- [ ] Analitik pelanggan (cohort, RFM sederhana)
- [ ] Dashboard grafik interaktif (drill-down)
- [ ] Export laporan ke PDF
- [ ] Pengiriman laporan otomatis via email

---

## ⬜ PHASE 4 — Belum Dikerjakan

### Multi-outlet & Manajemen Shift

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
- [ ] Halaman `/pos/promosi`

---

## ⬜ PHASE 6 — Belum Dikerjakan

### Integrasi Marketplace & API Publik

- [ ] Sinkronisasi produk POS ↔ Marketplace DesaMart
- [ ] Stok terpusat (marketplace & offline POS berbagi stok)
- [ ] Order dari marketplace masuk ke POS sebagai transaksi
- [ ] API publik (REST) untuk integrasi third-party
- [ ] Webhook event (transaksi baru, stok habis, dll.)
- [ ] Integrasi printer thermal (ESC/POS via browser serial API)
- [ ] Integrasi timbangan digital
- [ ] Mode offline (PWA + IndexedDB sync)

---

## Catatan Teknis Penting

### Yang Harus Dilakukan Sebelum Menggunakan Phase 2

1. **Jalankan SQL Migration Phase 1** (jika belum):
   - File: `supabase/migrations/20260508000000_phase1_pos_saas.sql`
   - Copy → Paste ke **Supabase → SQL Editor → New Query** → Run

2. **Jalankan SQL Migration Phase 2**:
   - File: `supabase/migrations/20260509000000_phase2_pos_purchase_kas.sql`
   - Copy → Paste ke **Supabase → SQL Editor → New Query** → Run

3. **Akses Fitur Phase 2:**
   - Login → Akun → Kasir POS → `/pos`
   - Menu **Pembelian** untuk Purchase Order ke supplier
   - Menu **Kas Harian** untuk manajemen sesi & mutasi kas

### Alur Pembelian yang Direkomendasikan

```
Buat PO (Draft)
  → Kirim ke Supplier (status: sent)
  → Barang Tiba → Klik "Terima Barang"
  → Input qty diterima → Stok otomatis update
  → Status: partial (sebagian) atau received (selesai)
```

### Alur Kas Harian yang Direkomendasikan

```
Mulai shift → Buka Sesi Kasir (input saldo awal)
  → Jalankan transaksi kasir seperti biasa
  → Catat Kas Masuk/Keluar manual jika ada
  → Akhir shift → Tutup Sesi (hitung fisik uang)
  → Sistem tampilkan selisih (lebih/kurang)
```

### Struktur File Phase 2

```
src/
└── pages/pos/
    ├── POSPembelianPage.tsx        ← Purchase Order ke supplier
    └── POSKasPage.tsx              ← Kas harian & manajemen sesi

supabase/migrations/
└── 20260509000000_phase2_pos_purchase_kas.sql  ← Schema DB Phase 2
```

### Dependencies Phase 2

Tidak ada package baru yang ditambahkan. Semua menggunakan dependencies yang sudah ada di Phase 1:
- `@supabase/supabase-js` — database queries
- `date-fns` — format tanggal
- `lucide-react` — ikon
- `sonner` — toast notifications
- `shadcn/ui` — komponen UI (Table, Dialog, Badge, dll.)
