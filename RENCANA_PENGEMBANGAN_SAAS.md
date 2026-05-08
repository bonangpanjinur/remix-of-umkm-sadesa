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
| 🟡 P3 | Absensi Karyawan + Jadwal Shift | — | 🔲 Belum |
| 🟡 P3 | Penggajian / Payroll Karyawan | — | 🔲 Belum |
| 🟢 P4 | Hutang & Piutang (AP/AR) lengkap | — | 🔲 Belum |
| 🟢 P4 | Target Omzet & Tracking Pencapaian | — | 🔲 Belum |
| 🔵 P5 | Landing Page Paket Berlangganan (poles) | — | 🔲 Belum |
| 🔵 P5 | Export PDF Laporan Kasir & Stok | — | 🔲 Belum |

### Migration SQL yang perlu dijalankan di Supabase

| File | Fitur | Status |
|---|---|---|
| `supabase/migrations/20260508000000_phase1_pos_saas.sql` | Core POS (kasir, produk, stok, dll) | ✅ Sudah ada |
| `supabase/migrations/20260510000000_phase2_bahan_baku_resep.sql` | Bahan Baku + Resep/BOM | ⚠️ Perlu dijalankan |
| `supabase/migrations/20260512000000_phase2b_meja_kds.sql` | Manajemen Meja + KDS | ⚠️ Perlu dijalankan |

---

## 🔴 PRIORITAS 1 — Quick Wins (SELESAI ✅)

### [P1-A] Kirim Struk via WhatsApp ✅

**Alasan:** Fitur paling sering diminta owner FnB. Langsung terasa manfaatnya.

**Yang dibangun:**
- Tombol "Kirim via WA" di dialog sukses setelah transaksi
- Format pesan struk yang rapi dengan emoji dan bold text WhatsApp
- Jika customer punya nomor HP → langsung buka WA dengan nomor terisi
- Jika tidak ada nomor → buka WA tanpa nomor (user pilih sendiri)
- Pesan berisi: nama toko, nomor transaksi, daftar item, total, metode bayar, poin diperoleh

**File yang dimodifikasi:**
- `src/pages/pos/POSKasirPage.tsx` — fungsi `sendReceiptViaWhatsApp` + tombol hijau "Kirim via WA"

---

### [P1-B] Export PDF Struk ✅

**Alasan:** Owner dan customer butuh bukti transaksi PDF untuk pembukuan, klaim, arsip.

**Yang dibangun:**
- Tombol "Simpan PDF" di dialog sukses setelah transaksi
- Buka print window dengan HTML struk terformat (font monospace, lebar 80mm)
- Trigger `window.print()` → user pilih "Save as PDF"
- Tampilan mirip thermal printer dengan semua detail transaksi

**File yang dimodifikasi:**
- `src/pages/pos/POSKasirPage.tsx` — fungsi `exportReceiptPDF` + tombol biru "Simpan PDF"

---

### [P1-C] Export PDF Laporan Laba Rugi ✅

**Yang dibangun:**
- Tombol "Export PDF" di halaman Laporan Laba Rugi
- PDF berisi: KPI summary cards (omzet, laba kotor, laba bersih, HPP), tabel L/R lengkap, top produk terlaris
- Format A4, header toko + outlet + periode

**File yang dimodifikasi:**
- `src/pages/pos/POSLaporanLabaRugiPage.tsx` — fungsi `exportPDF` + tombol biru

---

### [P1-D] Export PDF Laporan Cashflow ✅

**Yang dibangun:**
- Tombol "Export PDF" di halaman Laporan Cashflow
- PDF berisi: KPI summary (kas masuk, kas keluar, net cashflow), tabel rincian masuk & keluar
- Format A4, warna sesuai positif/negatif

**File yang dimodifikasi:**
- `src/pages/pos/POSLaporanCashflowPage.tsx` — fungsi `exportPDF` + tombol biru

---

## 🟠 PRIORITAS 2 — FnB Differentiator (Pembeda dari POS Biasa)

### [P2-A] Manajemen Bahan Baku + Resep/BOM

**Alasan:** Fitur paling membedakan POS FnB dari POS retail. Saat kasir jual 1 porsi Nasi Goreng, stok bahan baku (beras, telur, minyak, dll) otomatis berkurang sesuai resep. Owner bisa tahu food cost dan margin real-time.

**Yang perlu dibangun:**

*Database (migrasi baru):*
```sql
pos_raw_materials (id, tenant_id, outlet_id, name, unit, current_stock, min_stock, cost_per_unit, created_at)
pos_recipes (id, tenant_id, product_id, raw_material_id, qty_needed, unit)
pos_raw_material_mutations (id, tenant_id, outlet_id, raw_material_id, type, qty, reference_id, notes, created_at)
```

*Halaman baru:*
- `/pos/bahan-baku` — CRUD bahan baku, stok masuk, alert stok menipis
- `/pos/resep` — mapping produk → bahan baku dengan qty
- Trigger otomatis saat transaksi: kurangi bahan baku sesuai resep

*Integrasi:*
- Di POSKasirPage `processPayment()`: setelah transaksi sukses, jalankan pengurangan bahan baku berdasarkan resep produk yang terjual

---

### [P2-B] Manajemen Meja + Kitchen Display System (KDS)

**Alasan:** Restoran dan kafe tidak bisa beroperasi tanpa ini. Meja, antrian pesanan ke dapur, status masak — kebutuhan fundamental FnB.

**Yang perlu dibangun:**

*Database:*
```sql
pos_tables (id, tenant_id, outlet_id, name, capacity, status, section, qr_code_url)
-- status: available, occupied, reserved, cleaning
pos_table_orders (id, tenant_id, outlet_id, table_id, status, items jsonb, notes, cashier_id, created_at)
-- status: pending → cooking → ready → served → paid
```

*Halaman baru:*
- `/pos/meja` — layout meja visual dengan status warna (hijau/merah/kuning)
- `/pos/kds` — Kitchen Display System fullscreen (update realtime via Supabase)
- `/pos/kasir-meja` — mode kasir pilih meja dulu baru input pesanan
- Mode QR: customer scan QR di meja → self-order

---

## 🟡 PRIORITAS 3 — HR Karyawan

### [P3-A] Absensi + Jadwal Shift

**Yang perlu dibangun:**

*Database:*
```sql
pos_shifts (id, tenant_id, name, start_time, end_time, days_of_week jsonb)
pos_schedules (id, tenant_id, pos_user_id, outlet_id, shift_id, date)
pos_attendances (id, tenant_id, pos_user_id, outlet_id, check_in_at, check_out_at, status, late_minutes, notes)
-- status: present, absent, late, permission, sick
```

*Halaman baru:*
- `/pos/jadwal` — kalender jadwal shift per karyawan per outlet
- `/pos/absensi` — rekap kehadiran, clock-in/out, rekap bulanan
- Integrasi: buka sesi kas di POS → otomatis catat absensi kasir

---

### [P3-B] Penggajian / Payroll

**Yang perlu dibangun:**

*Database:*
```sql
pos_employee_salaries (id, tenant_id, pos_user_id, salary_type, base_amount, overtime_rate)
-- salary_type: monthly, daily, hourly
pos_payroll_periods (id, tenant_id, month, year, status, processed_at)
-- status: draft, finalized
pos_payroll_items (id, period_id, pos_user_id, working_days, present_days, base_salary, allowances, deductions, overtime_pay, net_salary)
```

*Halaman baru:*
- `/pos/penggajian` — hitung gaji otomatis dari data absensi, export slip gaji PDF
- Kirim slip gaji via WhatsApp ke karyawan

---

## 🟢 PRIORITAS 4 — Keuangan Lebih Dalam

### [P4-A] Hutang & Piutang (AP/AR) Lengkap

*Database:*
```sql
pos_debts (id, tenant_id, outlet_id, type, party_name, party_id, amount, remaining, due_date, status, notes)
-- type: payable (hutang ke supplier), receivable (piutang dari customer)
pos_debt_payments (id, debt_id, amount, payment_date, notes, created_by)
```

*Halaman baru:*
- `/pos/hutang-piutang` — daftar hutang/piutang, reminder jatuh tempo, rekonsiliasi cashflow

---

### [P4-B] Target Omzet & Dashboard Pencapaian

*Fitur:*
- Setting target omzet harian/bulanan per outlet di pengaturan
- Widget di dashboard: progress bar, estimasi akhir bulan, alert jika under-target
- Notifikasi WA ke owner jika omzet di bawah 50% target di tengah bulan

---

## 🔵 PRIORITAS 5 — SaaS Infrastructure

### [P5-A] Landing Page Berlangganan (poles)

*Halaman yang sudah ada (perlu dipoles):*
- `MerchantPOSSubscribePage` — sudah ada, tambahkan tabel perbandingan fitur antar paket
- `AdminPOSPage` — sudah ada approval, tambahkan statistik subscriber + pendapatan

*Yang perlu ditambah:*
- Halaman publik `/pos/harga` — showcase 3 paket dengan fitur masing-masing
- CTA "Mulai Trial Gratis 30 Hari" dan "Berlangganan Sekarang"
- Notifikasi WA ke super admin saat ada subscriber baru

---

### [P5-B] Export PDF Laporan Lainnya

*Halaman yang belum punya PDF:*
- Laporan Kasir (`POSLaporanKasirPage`) — shift summary per kasir
- Laporan Stok (`POSLaporanStokPage`) — stock opname PDF
- Laporan Outlet (`POSLaporanOutletPage`) — perbandingan antar outlet

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

- **Stack:** React + Vite + Supabase + TypeScript + Tailwind + shadcn/ui
- **Print/PDF:** `window.open` + HTML terformat + `window.print()` → tidak perlu library tambahan
- **WhatsApp:** `wa.me` link dengan pesan ter-encode — tidak perlu API berbayar
- **Thermal Printer:** Web Serial API (ESC/POS) — sudah ada di `src/lib/thermalPrinter.ts`
- **KDS:** Supabase Realtime untuk update status pesanan real-time ke dapur
- **PDF Laporan:** Print CSS dengan `@page { size: A4 }` + grid KPI cards
- **TypeScript:** Seluruh file yang diedit bebas dari TS errors (pre-existing errors ada di file lain yang tidak disentuh)
