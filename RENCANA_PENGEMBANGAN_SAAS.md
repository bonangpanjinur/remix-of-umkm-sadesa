# Rencana Pengembangan DesaMart POS — SaaS FnB

> Dokumen ini adalah panduan pengembangan fitur berbasis prioritas bisnis.
> Update setiap selesai mengerjakan fitur.

---

## Status Pengerjaan

| Prioritas | Fitur | File Utama | Status |
|---|---|---|---|
| 🔴 P1 | Kirim struk via WhatsApp (kasir) | `src/pages/pos/POSKasirPage.tsx` | ✅ Selesai |
| 🔴 P1 | Export PDF struk (kasir) | `src/pages/pos/POSKasirPage.tsx` | ✅ Selesai |
| 🔴 P1 | Export PDF Laporan Laba Rugi | `src/pages/pos/POSLaporanLabaRugiPage.tsx` | ✅ Selesai |
| 🔴 P1 | Export PDF Laporan Cashflow | `src/pages/pos/POSLaporanCashflowPage.tsx` | ✅ Selesai |
| 🟠 P2 | Manajemen Bahan Baku + Resep/BOM | `src/pages/pos/POSBahanBakuPage.tsx` `src/pages/pos/POSResepPage.tsx` | ✅ Selesai |
| 🟠 P2 | Manajemen Meja + Kitchen Display (KDS) | `src/pages/pos/POSMejaPage.tsx` `src/pages/pos/POSKDSPage.tsx` | ✅ Selesai |
| 🟡 P3 | Absensi Karyawan + Jadwal Shift | `src/pages/pos/POSAbsensiPage.tsx` `src/pages/pos/POSJadwalPage.tsx` | ✅ Selesai |
| 🟡 P3 | Penggajian / Payroll Karyawan | `src/pages/pos/POSPenggajianPage.tsx` | ✅ Selesai |
| 🟢 P4 | Hutang & Piutang (AP/AR) lengkap | `src/pages/pos/POSHutangPiutangPage.tsx` | ✅ Selesai |
| 🟢 P4 | Target Omzet & Tracking Pencapaian | `src/pages/pos/POSTargetOmzetPage.tsx` | ✅ Selesai |
| 🔵 P5 | Landing Page Paket Berlangganan (poles) | `src/pages/pos/POSHargaPage.tsx` | ✅ Selesai |
| 🔵 P5 | Export PDF Laporan Kasir & Stok | `src/pages/pos/POSLaporanKasirPage.tsx` `src/pages/pos/POSLaporanStokPage.tsx` | ✅ Selesai |
| 🟣 P6 | Notifikasi WA untuk Merchant | `src/pages/merchant/MerchantNotifikasiWAPage.tsx` | ✅ Selesai |
| 🟣 P6 | Import / Export Produk CSV (Massal) | `src/pages/merchant/MerchantImportExportPage.tsx` | ✅ Selesai |
| 🟣 P6 | Insight Bisnis Mendalam | `src/pages/merchant/MerchantInsightPage.tsx` | ✅ Selesai |

### Migration SQL yang perlu dijalankan di Supabase / Database

| File | Fitur | Status |
|---|---|---|
| `supabase/migrations/20260508000000_phase1_pos_saas.sql` | Core POS (kasir, produk, stok, dll) | ✅ Sudah ada |
| `supabase/migrations/20260510000000_phase2_bahan_baku_resep.sql` | Bahan Baku + Resep/BOM | ✅ Sudah ada |
| `supabase/migrations/20260512000000_phase2b_meja_kds.sql` | Manajemen Meja + KDS | ✅ Sudah ada |
| — | Jadwal Shift + Absensi + Payroll (tabel baru) | ⚠️ Perlu dijalankan di DB |
| — | Hutang & Piutang (tabel baru) | ⚠️ Perlu dijalankan di DB |
| — | Target Omzet (tabel baru) | ⚠️ Perlu dijalankan di DB |

---

## 🔴 PRIORITAS 1 — Quick Wins (SELESAI ✅)

### [P1-A] Kirim Struk via WhatsApp ✅
**File:** `src/pages/pos/POSKasirPage.tsx` — fungsi `sendReceiptViaWhatsApp`

### [P1-B] Export PDF Struk ✅
**File:** `src/pages/pos/POSKasirPage.tsx` — fungsi `exportReceiptPDF`

### [P1-C] Export PDF Laporan Laba Rugi ✅
**File:** `src/pages/pos/POSLaporanLabaRugiPage.tsx` — fungsi `exportPDF`

### [P1-D] Export PDF Laporan Cashflow ✅
**File:** `src/pages/pos/POSLaporanCashflowPage.tsx` — fungsi `exportPDF`

---

## 🟠 PRIORITAS 2 — FnB Differentiator (SELESAI ✅)

### [P2-A] Manajemen Bahan Baku + Resep/BOM ✅
**File:** `src/pages/pos/POSBahanBakuPage.tsx`, `src/pages/pos/POSResepPage.tsx`

### [P2-B] Manajemen Meja + Kitchen Display System (KDS) ✅
**File:** `src/pages/pos/POSMejaPage.tsx`, `src/pages/pos/POSKDSPage.tsx`

---

## 🟡 PRIORITAS 3 — HR Karyawan (SELESAI ✅)

### [P3-A] Absensi + Jadwal Shift ✅

**File dibuat:**
- `src/pages/pos/POSJadwalPage.tsx` — kalender mingguan, CRUD shift (nama, jam, hari, warna), assign jadwal karyawan
- `src/pages/pos/POSAbsensiPage.tsx` — clock-in/out cepat, catat manual, rekap bulanan, export CSV
- Route: `/pos/jadwal`, `/pos/absensi`

**Tabel DB baru yang dibutuhkan:**
```sql
pos_shifts (id, tenant_id, name, start_time, end_time, days_of_week jsonb, color)
pos_schedules (id, tenant_id, outlet_id, pos_user_id, shift_id, date)
pos_attendances (id, tenant_id, outlet_id, pos_user_id, date, check_in_at, check_out_at, status, late_minutes, notes)
```

---

### [P3-B] Penggajian / Payroll ✅

**File dibuat:**
- `src/pages/pos/POSPenggajianPage.tsx` — atur gaji pokok per karyawan, hitung otomatis dari absensi, slip gaji PDF via print, export CSV
- Route: `/pos/penggajian`

**Tabel DB baru yang dibutuhkan:**
```sql
pos_employee_salaries (id, tenant_id, pos_user_id, salary_type, base_amount, overtime_rate)
pos_payroll_periods (id, tenant_id, month, year, status, processed_at)
pos_payroll_items (id, period_id, pos_user_id, working_days, present_days, base_salary, allowances, deductions, overtime_pay, net_salary)
```

---

## 🟢 PRIORITAS 4 — Keuangan Lebih Dalam (SELESAI ✅)

### [P4-A] Hutang & Piutang (AP/AR) Lengkap ✅

**File dibuat:**
- `src/pages/pos/POSHutangPiutangPage.tsx` — CRUD hutang/piutang, catat pembayaran, alert jatuh tempo, export CSV
- Route: `/pos/hutang-piutang`

**Tabel DB baru yang dibutuhkan:**
```sql
pos_debts (id, tenant_id, outlet_id, type, party_name, amount, remaining, due_date, status, notes, created_at)
pos_debt_payments (id, debt_id, amount, payment_date, notes, created_by)
```

---

### [P4-B] Target Omzet & Dashboard Pencapaian ✅

**File dibuat:**
- `src/pages/pos/POSTargetOmzetPage.tsx` — atur target harian & bulanan per outlet, progress bar, proyeksi akhir bulan, grafik harian, alert jika under-target
- Route: `/pos/target-omzet`

**Tabel DB baru yang dibutuhkan:**
```sql
pos_omzet_targets (id, tenant_id, outlet_id, month, year, daily_target, monthly_target)
```

---

## 🟣 PRIORITAS 6 — Fitur Merchant Marketplace (SELESAI ✅)

### [P6-A] Notifikasi WhatsApp untuk Merchant ✅

**File dibuat:**
- `src/pages/merchant/MerchantNotifikasiWAPage.tsx`
- Route: `/merchant/notifikasi-wa`

**Fitur yang ada:**
- Simpan nomor WA merchant (localStorage + kolom phone di DB)
- Tab **Notifikasi**: daftar pesanan pending + tombol "Notif ke Saya" (buka WA ke HP sendiri), daftar stok menipis, tombol alert stok bulk
- Tab **Laporan**: preview rekap hari ini (omzet, order, avg/order, pending, stok) + tombol kirim ke WA sendiri
- Tab **Broadcast**: template pesan dengan variabel `{nama_pembeli}`, kirim satu-satu atau ke semua pelanggan sekaligus, daftar pelanggan unik 90 hari terakhir dengan jumlah order
- Tab **Pengaturan**: atur nomor WA, toggle preferensi notif, test kirim WA
- Semua menggunakan `wa.me` link — tanpa API berbayar

---

### [P6-B] Import & Export Produk CSV (Massal) ✅

**File dibuat:**
- `src/pages/merchant/MerchantImportExportPage.tsx`
- Route: `/merchant/import-export`

**Fitur yang ada:**
- **Import Tab**: download template CSV, upload file CSV, parse & validasi per baris (nama wajib, harga > 0, kategori valid), preview tabel dengan status valid/error per baris, import massal dengan progress bar, laporan hasil (berhasil/gagal)
- **Export Tab**: export semua produk ke CSV (nama, deskripsi, harga, stok, kategori, aktif, promo, dilihat, terjual, tanggal dibuat), preview tabel produk di halaman
- Mendukung encoding UTF-8 dengan BOM (agar Excel Indonesia tidak error)

---

### [P6-C] Insight Bisnis Mendalam ✅

**File dibuat:**
- `src/pages/merchant/MerchantInsightPage.tsx`
- Route: `/merchant/insight`

**Fitur yang ada:**
- Pilih periode 7 hari / 30 hari
- **KPI Cards**: omzet, total order, rata-rata/order, pelanggan unik — semua dengan delta % vs periode sebelumnya
- **Highlight**: jam paling ramai, hari terbaik, tingkat repeat buyer, jumlah produk aktif
- **Tab Tren Omzet**: grafik area omzet harian, bar chart omzet per hari dalam seminggu, pie chart kategori
- **Tab Jam Ramai**: bar chart per jam (hijau = jam paling ramai), bar chart per hari (dengan highlight puncak), rekomendasi otomatis kapan aktifkan promo
- **Tab Produk**: top 5 terlaris dengan progress bar & konversi, produk perlu perhatian (views tinggi tapi konversi rendah), stok menipis
- **Tab Pelanggan**: statistik total + repeat buyer, interpretasi otomatis + rekomendasi aksi (broadcast WA, voucher, dll)

---

## 🔵 PRIORITAS 5 — SaaS Infrastructure (SELESAI ✅)

### [P5-A] Landing Page Berlangganan ✅

**File dibuat:**
- `src/pages/pos/POSHargaPage.tsx` — showcase 3 paket (Starter/Bisnis/Profesional), tabel perbandingan fitur, FAQ, CTA trial gratis
- Route publik: `/pos/harga`

---

### [P5-B] Export PDF Laporan Kasir & Stok ✅

**File dimodifikasi:**
- `src/pages/pos/POSLaporanKasirPage.tsx` — tambah fungsi `exportPDF()` + tombol "Export PDF"
- `src/pages/pos/POSLaporanStokPage.tsx` — tambah fungsi `exportPDF()` + tombol "Export PDF" (Stock Opname)

---

## Paket Berlangganan (Rekomendasi Harga)

```
┌─────────────────────────────────────────────────────────────┐
│  STARTER  Rp 99.000/bln                                     │
│  ✓ 1 outlet  ✓ Kasir + stok  ✓ Laporan dasar               │
│  ✓ 2 user   ✓ Print thermal  ✓ Export CSV                   │
├─────────────────────────────────────────────────────────────┤
│  BISNIS  Rp 249.000/bln  ⭐ TERPOPULER                      │
│  ✓ 3 outlet  ✓ HPP + Laba Rugi + Cashflow                   │
│  ✓ Pembelian ke supplier  ✓ Loyalty + Voucher               │
│  ✓ Kirim struk WA  ✓ Export PDF                             │
│  ✓ Absensi karyawan + Jadwal shift                          │
│  ✓ 5 user  ✓ Manajemen meja (10 meja)                       │
│  ✓ Target Omzet  ✓ Hutang & Piutang                         │
├─────────────────────────────────────────────────────────────┤
│  PROFESIONAL  Rp 499.000/bln                                │
│  ✓ Outlet tidak terbatas                                    │
│  ✓ Resep & bahan baku (otomatis kurangi stok)               │
│  ✓ Kitchen Display System (KDS)                             │
│  ✓ Payroll karyawan otomatis                                │
│  ✓ Hutang & piutang lengkap                                 │
│  ✓ Export ke Accurate/MYOB/Zahir                            │
│  ✓ API integrasi marketplace                                │
│  ✓ User tidak terbatas                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Catatan Teknis

- **Stack:** React + Vite + Supabase/PostgreSQL + TypeScript + Tailwind + shadcn/ui
- **Print/PDF:** `window.open` + HTML terformat + `window.print()` → tidak perlu library tambahan
- **WhatsApp:** `wa.me` link dengan pesan ter-encode — tidak perlu API berbayar
- **Thermal Printer:** Web Serial API (ESC/POS) — sudah ada di `src/lib/thermalPrinter.ts`
- **KDS:** Realtime update status pesanan ke dapur
- **PDF Laporan:** Print CSS dengan `@page { size: A4 }` + grid KPI cards
- **TypeScript:** Seluruh file yang diedit bebas dari TS errors

## SQL Schema Tambahan (jalankan di database)

```sql
-- Shifts
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  days_of_week TEXT[] DEFAULT '{}',
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Schedules
CREATE TABLE IF NOT EXISTS public.pos_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  outlet_id UUID NOT NULL,
  pos_user_id UUID NOT NULL,
  shift_id UUID REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, pos_user_id, date)
);

-- Attendances
CREATE TABLE IF NOT EXISTS public.pos_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  outlet_id UUID NOT NULL,
  pos_user_id UUID NOT NULL,
  date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  late_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, pos_user_id, date)
);

-- Employee Salaries
CREATE TABLE IF NOT EXISTS public.pos_employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pos_user_id UUID NOT NULL,
  salary_type TEXT NOT NULL DEFAULT 'monthly',
  base_amount NUMERIC NOT NULL DEFAULT 0,
  overtime_rate NUMERIC DEFAULT 25000,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, pos_user_id)
);

-- Payroll Periods
CREATE TABLE IF NOT EXISTS public.pos_payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payroll Items
CREATE TABLE IF NOT EXISTS public.pos_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.pos_payroll_periods(id) ON DELETE CASCADE,
  pos_user_id UUID NOT NULL,
  working_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  base_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, pos_user_id)
);

-- Debts (Hutang/Piutang)
CREATE TABLE IF NOT EXISTS public.pos_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  outlet_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payable','receivable')),
  party_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Debt Payments
CREATE TABLE IF NOT EXISTS public.pos_debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.pos_debts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Omzet Targets
CREATE TABLE IF NOT EXISTS public.pos_omzet_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  outlet_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  daily_target NUMERIC DEFAULT 0,
  monthly_target NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, outlet_id, month, year)
);
```
