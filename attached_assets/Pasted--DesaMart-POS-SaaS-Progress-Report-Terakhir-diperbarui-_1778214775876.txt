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
| **Phase 4** | Multi-outlet & Audit Trail | ✅ Selesai |
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
| `src/components/pos/POSSidebar.tsx` | Sidebar navigasi 23 menu item (Phase 1–4) | ✅ |
| `src/components/pos/BarcodeScanner.tsx` | Kamera barcode scanner (`@zxing/browser`) | ✅ |
| `src/App.tsx` | Route `/pos/*` lengkap Phase 1–4 | ✅ |

---

### 1.3 Halaman POS — Phase 1

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

#### Halaman Phase 1 Lainnya
- [x] `/pos/transaksi` — Riwayat transaksi + filter + export CSV
- [x] `/pos/retur` — Retur penjualan + restock otomatis
- [x] `/pos/produk` — CRUD produk (SKU, barcode, varian, margin)
- [x] `/pos/kategori` — CRUD kategori & sub-kategori
- [x] `/pos/customer` — CRUD pelanggan + statistik
- [x] `/pos/supplier` — CRUD supplier
- [x] `/pos/stok` — Stok per outlet + penyesuaian + mutasi
- [x] `/pos/laporan` — Laporan penjualan dasar (grafik, top produk)
- [x] `/pos/pengguna` — 7 role pengguna + PIN kasir
- [x] `/pos/pengaturan` — Pengaturan usaha & outlet

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
**Route:** `/pos/pembelian`
- [x] Kartu ringkasan status PO (Draft, Dikirim, Sebagian, Selesai, Dibatalkan)
- [x] Ringkasan hutang dagang: total nilai, dibayar, sisa
- [x] Buat PO baru: pilih supplier, No PO auto-generate, estimasi tiba
- [x] Tambah item dari master produk atau manual
- [x] Flow status: Draft → Dikirim → Terima Barang → Selesai / Sebagian
- [x] Penerimaan barang: update stok + catat mutasi otomatis
- [x] Export CSV

#### POSKasPage — Kas Harian
**Route:** `/pos/kas`
- [x] Buka sesi kasir (saldo awal, nama kasir, No sesi auto-generate)
- [x] Kalkulasi real-time: Saldo Awal + Penjualan Tunai + Kas Masuk − Kas Keluar
- [x] Kas masuk/keluar manual dengan kategori
- [x] Tutup sesi: input saldo aktual, auto-hitung selisih lebih/kurang
- [x] Tab Mutasi Kas & Riwayat Sesi, export CSV

---

## ✅ PHASE 3 — Selesai

### 3.1 Halaman Phase 3

#### POSLaporanLabaRugiPage
**Route:** `/pos/laporan/laba-rugi`
- [x] Statement laba rugi format akuntansi (Omzet → Laba Kotor → Laba Bersih)
- [x] KPI: Net margin %, Gross margin %, Omzet, HPP
- [x] Grafik bar Omzet vs HPP vs Laba per hari/bulan
- [x] Top 10 produk berdasar laba + badge margin %
- [x] Export CSV + Cetak

#### POSLaporanKasirPage
**Route:** `/pos/laporan/kasir`
- [x] Banner kasir terbaik dengan kontribusi % omzet
- [x] Tabel performa (transaksi, omzet, avg/transaksi, total item)
- [x] Grafik jam sibuk (06:00–22:00) per kasir yang dipilih
- [x] Riwayat sesi kasir dengan selisih saldo + Export CSV

#### POSLaporanStokPage
**Route:** `/pos/laporan/stok`
- [x] Alert stok menipis/habis otomatis
- [x] Ringkasan stok per produk: masuk/keluar/terjual/dibeli + badge status
- [x] Riwayat setiap mutasi stok (tipe berwarna, before/after)
- [x] Grafik top 8 produk paling laku + Export CSV

#### POSAnalitikPage — Analitik Pelanggan
**Route:** `/pos/analitik`
- [x] Top 20 pelanggan dengan ikon medali + indikator hari terakhir belanja
- [x] Segmentasi RFM 6 segmen + pie chart distribusi
- [x] Tren pelanggan baru vs kembali per bulan
- [x] Breakdown metode pembayaran + top 8 produk terlaris + Export CSV

---

## ✅ PHASE 4 — Selesai

### 4.1 Database

**File:** `supabase/migrations/20260510000000_phase4_multioutlet_audit.sql`

| Tabel | Keterangan | Status |
|-------|-----------|--------|
| `pos_stock_transfers` | Header permintaan transfer stok antar outlet | ✅ |
| `pos_stock_transfer_items` | Detail item per transfer | ✅ |
| `pos_audit_logs` | Jejak aktivitas seluruh user (action, module, old/new values) | ✅ |
| `pos_notifications` | Notifikasi in-app per user/outlet | ✅ |
| `pos_user_outlet_access` | Akses granular user per outlet + role | ✅ |

> RLS + Index lengkap sudah disertakan di migration.

---

### 4.2 Halaman Phase 4

#### POSTransferStokPage — Transfer Stok Antar Outlet
**Route:** `/pos/transfer-stok` | **File:** `src/pages/pos/POSTransferStokPage.tsx`

- [x] **Status flow lengkap:** Draft → Menunggu → Disetujui → Selesai / Ditolak / Dibatalkan
- [x] **Buat transfer baru:** pilih outlet asal & tujuan, No transfer auto-generate
- [x] **Cari & tambah produk** dari master: tampilkan stok tersedia per outlet asal
- [x] **Validasi stok:** blokir qty transfer > stok tersedia
- [x] **Approve & Reject:** flow persetujuan dengan alasan penolakan
- [x] **Selesaikan transfer:** input qty diterima, update stok kedua outlet otomatis (masuk + keluar di `pos_stock_mutations`)
- [x] **Expand detail** setiap transfer: tabel item + qty diminta/dikirim/diterima
- [x] **Filter status & outlet**, kartu ringkasan per status
- [x] **Audit log otomatis** setiap aksi (buat, setujui, tolak, selesai)
- [x] Export CSV + Alert jika outlet < 2

#### POSLaporanOutletPage — Laporan Perbandingan Outlet
**Route:** `/pos/laporan/outlet` | **File:** `src/pages/pos/POSLaporanOutletPage.tsx`

- [x] **Periode fleksibel:** Hari ini, Minggu, Bulan, Tahun, Kustom
- [x] **Banner outlet terbaik** dengan kontribusi % omzet (emas trophy)
- [x] **Cards per outlet:**
  - Omzet + progress bar porsi dari grand total
  - Transaksi, Avg/Trx, Pelanggan unik, Item terjual
  - Split Tunai vs Non-tunai
- [x] **Grafik bar harian** omzet semua outlet (multi-bar berwarna)
- [x] **Tabel perbandingan lengkap** dengan badge porsi %
- [x] **Grand total row** di bawah tabel
- [x] Export CSV + alert jika outlet < 2

#### POSAuditPage — Audit Trail
**Route:** `/pos/audit` | **File:** `src/pages/pos/POSAuditPage.tsx`

- [x] **KPI Cards:** Total aktivitas, Pengguna aktif, Mutasi stok, Aksi sensitif (hapus+tolak)
- [x] **Filter:** Rentang tanggal, Aksi, Modul, Outlet
- [x] **Tab Log Aktivitas:**
  - Tabel: Waktu, User, Aksi (badge berwarna), Modul, Deskripsi
  - Klik baris untuk lihat detail (old values vs new values JSON)
  - Pagination 50 per halaman
- [x] **Tab Mutasi Stok:**
  - Setiap perubahan stok: tipe (badge warna), before, perubahan (±), sesudah
  - Referensi (penjualan/pembelian/transfer) + keterangan
- [x] **Search** user/deskripsi/modul lintas tab
- [x] Export CSV + audit log export itu sendiri

#### POSAksesPage — Manajemen Akses
**Route:** `/pos/akses` | **File:** `src/pages/pos/POSAksesPage.tsx`

- [x] **KPI Cards:** Total pengguna, Pengguna aktif, Ada PIN kasir, Akses outlet aktif
- [x] **Tab Pengguna POS:**
  - Tabel lengkap: nama, email, role (badge), outlet utama, status PIN, toggle aktif/nonaktif
  - Tambah & Edit pengguna (nama, email, role, outlet utama)
  - Hapus pengguna dengan konfirmasi
  - Set/update PIN kasir (4–6 digit angka, konfirmasi, validasi numerik)
- [x] **Tab Akses Per Outlet:**
  - Beri akses user ke outlet tertentu dengan role yang berbeda per outlet
  - Upsert (satu user bisa punya role berbeda di tiap outlet)
  - Cabut akses dengan satu klik
  - Filter per outlet
- [x] **Tab Panduan Role:** penjelasan 7 role + daftar hak akses masing-masing
- [x] Alert jika outlet < 2 pada tab akses

---

### 4.3 Navigasi & Routing Phase 4

| Menu Sidebar | Route | Icon | Status |
|---|---|---|---|
| Transfer Stok | `/pos/transfer-stok` | ArrowRightLeft | ✅ |
| Lap. Outlet | `/pos/laporan/outlet` | GitCompare | ✅ |
| Audit Trail | `/pos/audit` | Shield | ✅ |
| Manajemen Akses | `/pos/akses` | KeyRound | ✅ |

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
1. supabase/migrations/20260508000000_phase1_pos_saas.sql       → Phase 1 (Core)
2. supabase/migrations/20260509000000_phase2_pos_purchase_kas.sql → Phase 2
3. supabase/migrations/20260510000000_phase4_multioutlet_audit.sql → Phase 4
```

> Phase 3 tidak membutuhkan migration DB baru — semua halaman membaca tabel yang sudah ada.
> Semua migration harus dijalankan di **Supabase Dashboard → SQL Editor** secara berurutan.

### Struktur File Lengkap POS

```
src/
├── contexts/
│   └── POSContext.tsx                    ← State global POS
├── components/pos/
│   ├── POSLayout.tsx
│   ├── POSSidebar.tsx                    ← 23 menu item (Phase 1–4)
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
    ├── POSAnalitikPage.tsx               ← Phase 3
    ├── POSTransferStokPage.tsx           ← Phase 4
    ├── POSLaporanOutletPage.tsx          ← Phase 4
    ├── POSAuditPage.tsx                  ← Phase 4
    └── POSAksesPage.tsx                  ← Phase 4

supabase/migrations/
├── 20260508000000_phase1_pos_saas.sql
├── 20260509000000_phase2_pos_purchase_kas.sql
└── 20260510000000_phase4_multioutlet_audit.sql
```

### Dependencies yang Digunakan

Tidak ada package tambahan di Phase 3 & 4. Semua memanfaatkan:

| Package | Fungsi |
|---------|--------|
| `@supabase/supabase-js` | Database queries + auth |
| `recharts` | Grafik (Bar, Line, Pie, Area, Radar) |
| `date-fns` | Format & kalkulasi tanggal |
| `lucide-react` | Ikon UI |
| `sonner` | Toast notifications |
| `shadcn/ui` | Komponen UI (Table, Dialog, Badge, Tabs, Switch, dll.) |

### Alur Transfer Stok (Phase 4)

```
Buat Transfer (status: pending)
  ↓
Approve oleh Manager/Owner (status: approved)
  ↓                        ↘
Selesaikan Transfer        Tolak (status: rejected)
  ↓
Update pos_stock outlet asal (−qty) + outlet tujuan (+qty)
Catat pos_stock_mutations (transfer_out + transfer_in)
Catat pos_audit_logs
  ↓
Status: completed
```

### Alur Audit Log (Phase 4)

Setiap aksi penting mencatat ke `pos_audit_logs`:
- `action`: create, update, delete, approve, reject, complete, export, print
- `module`: kasir, produk, stok, transfer_stok, pembelian, kas, pelanggan, dll.
- `old_values` / `new_values`: JSON snapshot sebelum & sesudah (opsional)
- Bisa difilter per user, modul, aksi, outlet, dan rentang tanggal
