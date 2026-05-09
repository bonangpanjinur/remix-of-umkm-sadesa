# 📋 DesaMart — Master Rencana & Roadmap

> **Dibuat:** Mei 2026 | **Terakhir diperbarui:** Mei 2026
> **Stack:** React 18 + Vite + Express + PostgreSQL (Replit) + TypeScript + Tailwind + shadcn/ui
> **Catatan:** File ini adalah satu-satunya dokumen perencanaan. Hapus file lama yang terpisah.

---

## 📊 Ringkasan Status Semua Fase

| Fase | Nama | Status |
|------|------|--------|
| **Bug Fixes** | Perbaikan Kritis & Keamanan | ✅ Semua Selesai |
| **P1** | Pondasi Integrasi Antar Role | ✅ Selesai |
| **P2** | Pengalaman Pembeli & Toko | ⏳ Belum Dikerjakan |
| **P3** | Admin Desa & Ekosistem Wisata | ⏳ Belum Dikerjakan |
| **P4** | Super Admin & Keuangan Platform | 🔄 Sedang (Realtime Dashboard ✅) |
| **P5** | POS Lanjutan & Kurir | ✅ Fitur POS Selesai |
| **P6** | Diferensiasi & Monetisasi | ✅ Sebagian Selesai |

---

## 🔴 PERBAIKAN BUG — Semua Selesai ✅

| ID | Judul | Status |
|----|-------|--------|
| K-01 | Tabel `public.users` tidak ada | ✅ |
| K-02 | Tabel `user_villages` tidak ada | ✅ |
| K-03 | Tabel `village_events` tidak ada | ✅ |
| K-04 | Kolom `products.original_price` tidak ada | ✅ |
| T-01 | Validasi password tidak konsisten | ✅ |
| T-02 | Push broadcast tanpa pengecekan role admin | ✅ |
| T-03 | Key `homepage_layout` tidak ada di `app_settings` | ✅ |
| T-04 | Route `/login`, `/auth/login` menghasilkan 404 | ✅ |
| S-01 | `POST /api/pos/sync-stock` adalah placeholder kosong | ✅ |
| S-02 | Webhook `marketplace-order` adalah placeholder | ✅ |
| S-03 | CORS default allow semua origin | ✅ |
| S-04 | SSE `/subscribe` endpoint non-fungsional | ✅ |
| R-01 | Race condition di loading roles | ✅ |
| R-02 | SSE reconnect tanpa exponential backoff | ✅ |
| R-03 | Multi-tab logout tidak sinkron | ✅ |
| R-04 | WhatsApp log ditulis ke tabel `app_settings` | ✅ |

---

## 🔴 FASE P1 — Pondasi Integrasi Antar Role ✅ SELESAI

### 1.1 Sinkronisasi POS ↔ Marketplace ✅
- `POST /api/pos/sync-stock` — update stok marketplace dari POS via `pos_marketplace_sync`
- `POST /api/pos/sync-product` — sinkron nama/harga/deskripsi
- Log otomatis di `pos_sync_logs`

### 1.2 Notifikasi Real-time ke Semua Role ✅
- `server/lib/notify.ts` — helper notifikasi lengkap
- db-proxy.ts trigger: INSERT/UPDATE `orders` → notif otomatis
- INSERT `merchants` → notif ke semua admin_desa
- BottomNav buyer + MerchantSidebar + DesaSidebar: badge realtime via SSE

### 1.3 Lacak Pesanan Real-time di Peta ✅
- `OrderTrackingPage` dengan peta Leaflet
- `CourierLocationUpdater` — broadcast lokasi via SSE setiap watchPosition
- ETA otomatis berdasarkan haversine + tipe kendaraan

### 1.4 Verifikasi Merchant oleh Admin Desa ✅
- `src/pages/desa/DesaMerchantPage.tsx`
- Filter tab: Menunggu, Aktif, Ditolak, Semua
- Notif in-app ke merchant via `POST /api/merchant/verify`
- Badge merah SSE di sidebar

---

## 🟠 FASE P2 — Pengalaman Pembeli & Toko ⏳

### 2.1 Profil Toko Lengkap (Galeri, Halal, Jam Buka)
- [ ] Upload galeri foto toko (`merchant_gallery`)
- [ ] Badge "Halal Bersertifikat"
- [ ] Jam buka/tutup + status "Buka Sekarang"
- **DB:** `merchant_gallery`, `halal_certificates`, `merchant_operating_hours`

### 2.2 Manajemen Stok dengan Alert
- [ ] Banner peringatan stok < ambang
- [ ] Pengaturan ambang per produk
- [ ] Riwayat pergerakan stok
- [ ] Notif WA otomatis saat stok kritis

### 2.3 Multi Alamat Pengiriman (Buyer)
- [ ] Halaman `AddressesPage` — CRUD alamat
- [ ] Pilih alamat saat checkout
- [ ] Label: Rumah, Kantor, Lainnya
- **DB:** `saved_addresses`

### 2.4 Beli Lagi 1-Klik & Riwayat Lengkap
- [ ] Tombol "Beli Lagi" di riwayat pesanan
- [ ] Filter riwayat: Semua, Diproses, Selesai, Dibatalkan
- [ ] Download invoice PDF per pesanan

### 2.5 Dispute / Komplain Terstruktur
- [ ] Buyer ajukan komplain dengan foto
- [ ] Merchant respons komplain
- [ ] Admin mediasi & putuskan resolusi
- **DB:** `refund_requests` (diperluas)

### 2.6 Balas Ulasan oleh Merchant
- [ ] Merchant tambahkan balasan ke review
- [ ] Notif ke buyer saat dibalas
- **DB:** `reviews` + kolom `merchant_reply`, `replied_at`

### 2.7 Laporan Keuangan Merchant (Laba Rugi Sederhana)
- [ ] Rekap omzet bulanan vs biaya platform
- [ ] Grafik tren penjualan 6 bulan
- [ ] Export PDF/Excel

---

## 🟠 FASE P3 — Admin Desa & Ekosistem Wisata ⏳

### 3.1 Profil & Galeri Desa Lengkap
- [ ] Form edit profil desa: nama, deskripsi, kontak, koordinat
- [ ] Upload foto + galeri
- [ ] QR code desa untuk promosi offline

### 3.2 Paket Wisata & Booking Online
- [ ] Admin desa buat paket wisata
- [ ] Buyer bisa pilih tanggal & pesan
- [ ] Konfirmasi via WA ke admin + buyer
- **DB:** `tourism`, `orders` (type wisata)

### 3.3 Laporan Keuangan & Pendapatan Desa
- [ ] Total transaksi merchant se-desa
- [ ] Komisi masuk ke kas desa
- [ ] Grafik pendapatan bulanan dari wisata
- [ ] Export laporan untuk Pemdes

### 3.4 Jadwal & Pemandu Wisata
- [ ] Daftar pemandu + ketersediaan + nomor WA
- [ ] Kalender ketersediaan
- [ ] Buyer request pemandu saat booking
- **DB:** Tabel baru `tourism_guides`

---

## 🟡 FASE P4 — Super Admin & Keuangan Platform 🔄

### 4.1 Manajemen Paket Langganan Platform
- [ ] CRUD paket: nama, harga, fitur per tier, kuota
- [ ] Assign paket ke merchant/POS tenant
- [ ] Histori upgrade/downgrade
- [ ] Perpanjangan otomatis & pengingat expired
- **DB:** `pos_packages`, `pos_subscriptions`, `merchant_subscriptions`

### 4.2 Dashboard Realtime Platform ✅ SELESAI
- [x] Transaksi per jam (grafik live via SSE) — `src/pages/admin/AdminRealtimeDashboardPage.tsx`
- [x] Transaksi per menit (live 60 menit) — grafik AreaChart
- [x] User aktif saat ini (dari `sessions`)
- [x] Alert otomatis jika ada spike (rasio ≥ 2x, min 5 order/jam)
- [x] Feed pesanan terbaru 5 menit real-time
- [x] SSE endpoint `GET /api/admin/stats/stream` — update tiap 10 detik
- [x] REST endpoints: `/api/admin/stats`, `/api/admin/stats/hourly`, `/api/admin/stats/minutely`
- **File:** `server/routes/admin-stats.ts`, `src/hooks/useAdminRealtime.ts`
- **Route:** `/admin/realtime`

### 4.3 Komisi Dinamis per Kategori & Desa
- [ ] Atur komisi berbeda per kategori (kuliner 3%, kriya 5%)
- [ ] Atur komisi per desa
- [ ] Histori perubahan komisi
- **DB:** `commission_rules`

### 4.4 Laporan Keuangan Platform (P&L)
- [ ] Pendapatan komisi marketplace + langganan POS + iklan
- [ ] Biaya operasional (estimasi)
- [ ] Rekap pajak (PPN, PPh)
- [ ] Export PDF/Excel bulanan

### 4.5 Sistem Tiket Support Internal
- [ ] User ajukan tiket bantuan
- [ ] Admin balas & close tiket
- [ ] Kategori: Pesanan, Pembayaran, Akun, Teknis
- [ ] SLA: tiket belum dibalas > 24 jam → eskalasi
- **DB:** Tabel baru `support_tickets`

### 4.6 Manajemen SEO & Konten Halaman Publik
- [ ] Edit meta title, description, OG image per halaman
- [ ] Halaman landing kustomisasi dari admin
- [ ] Sitemap otomatis

---

## 🟡 FASE P5 — POS Lanjutan & Kurir ✅ Sebagian Selesai

### Fitur POS yang Sudah Selesai ✅
| Fitur | File | Status |
|-------|------|--------|
| Kirim Struk via WhatsApp | `POSKasirPage.tsx` | ✅ |
| Export PDF Struk | `POSKasirPage.tsx` | ✅ |
| Export PDF Laporan Laba Rugi | `POSLaporanLabaRugiPage.tsx` | ✅ |
| Export PDF Laporan Cashflow | `POSLaporanCashflowPage.tsx` | ✅ |
| Manajemen Bahan Baku + Resep/BOM | `POSBahanBakuPage.tsx`, `POSResepPage.tsx` | ✅ |
| Manajemen Meja + Kitchen Display (KDS) | `POSMejaPage.tsx`, `POSKDSPage.tsx` | ✅ |
| Absensi + Jadwal Shift | `POSJadwalPage.tsx`, `POSAbsensiPage.tsx` | ✅ |
| Penggajian / Payroll | `POSPenggajianPage.tsx` | ✅ |
| Hutang & Piutang (AP/AR) | `POSHutangPiutangPage.tsx` | ✅ |
| Target Omzet & Dashboard Pencapaian | `POSTargetOmzetPage.tsx` | ✅ |
| Landing Page Paket Berlangganan | `POSHargaPage.tsx` | ✅ |
| Export PDF Laporan Kasir & Stok | `POSLaporanKasirPage.tsx`, `POSLaporanStokPage.tsx` | ✅ |

### Fitur Kurir yang Perlu Dibuat
- [ ] Navigasi Google Maps + Batch pengiriman 2-3 pesanan sekaligus
- [ ] Laporan Penghasilan Kurir PDF (slip mingguan/bulanan)
- **DB:** `courier_earnings`, `courier_balance_logs`

### Fitur POS Lanjutan yang Perlu Dibuat
- [ ] QR Pay (Buyer bayar di kasir POS via QR dari app)
- [ ] Menu Digital QR untuk Restoran (scan → tampil menu tanpa install app)

---

## 🟢 FASE P6 — Diferensiasi & Monetisasi ✅ Sebagian Selesai

### Sudah Selesai ✅
| Fitur | File | Status |
|-------|------|--------|
| Notifikasi WA untuk Merchant | `MerchantNotifikasiWAPage.tsx` | ✅ |
| Import/Export Produk CSV Massal | `MerchantImportExportPage.tsx` | ✅ |
| Insight Bisnis Mendalam (Merchant) | `MerchantInsightPage.tsx` | ✅ |
| Iklan Berbayar / Sponsored Listing | `MerchantIklanPage.tsx`, `AdminIklanPage.tsx` | ✅ |

### Belum Dikerjakan
- [ ] Pre-order & Reservasi Meja (Restoran)
- [ ] Bundle Produk (Merchant)
- [ ] Program Loyalitas Multi-level (Silver/Gold/Platinum)
- [ ] Marketplace B2B (Grosir Antar Merchant)
- [ ] Laporan Pajak Otomatis (format e-SPT)
- [ ] Donasi & Crowdfunding Desa (saat checkout)
- [ ] Affiliate & Influencer Marketing (kode referral)

---

## 🗄️ Schema SQL Tambahan (jalankan di database)

### Tabel HR Karyawan (P3-A, P3-B)
```sql
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, name TEXT NOT NULL,
  start_time TEXT NOT NULL, end_time TEXT NOT NULL,
  days_of_week TEXT[] DEFAULT '{}', color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pos_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, outlet_id UUID NOT NULL,
  pos_user_id UUID NOT NULL, shift_id UUID REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
  date DATE NOT NULL, created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, pos_user_id, date)
);
CREATE TABLE IF NOT EXISTS public.pos_attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, outlet_id UUID NOT NULL,
  pos_user_id UUID NOT NULL, date DATE NOT NULL,
  check_in_at TIMESTAMPTZ, check_out_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present', late_minutes INTEGER DEFAULT 0,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, pos_user_id, date)
);
CREATE TABLE IF NOT EXISTS public.pos_employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, pos_user_id UUID NOT NULL,
  salary_type TEXT NOT NULL DEFAULT 'monthly', base_amount NUMERIC NOT NULL DEFAULT 0,
  overtime_rate NUMERIC DEFAULT 25000, created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, pos_user_id)
);
CREATE TABLE IF NOT EXISTS public.pos_payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', processed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pos_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.pos_payroll_periods(id) ON DELETE CASCADE,
  pos_user_id UUID NOT NULL, working_days INTEGER DEFAULT 0, present_days INTEGER DEFAULT 0,
  base_salary NUMERIC DEFAULT 0, allowances NUMERIC DEFAULT 0, deductions NUMERIC DEFAULT 0,
  overtime_pay NUMERIC DEFAULT 0, net_salary NUMERIC DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_id, pos_user_id)
);
```

### Tabel Hutang & Piutang (P4-A)
```sql
CREATE TABLE IF NOT EXISTS public.pos_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, outlet_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payable','receivable')),
  party_name TEXT NOT NULL, amount NUMERIC NOT NULL DEFAULT 0,
  remaining NUMERIC NOT NULL DEFAULT 0, due_date DATE, status TEXT NOT NULL DEFAULT 'active',
  notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pos_debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.pos_debts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0, payment_date DATE NOT NULL,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pos_omzet_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, outlet_id UUID NOT NULL,
  month INTEGER NOT NULL, year INTEGER NOT NULL,
  daily_target NUMERIC DEFAULT 0, monthly_target NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, outlet_id, month, year)
);
```

### Tabel Iklan (P6-D)
```sql
CREATE TABLE IF NOT EXISTS public.ad_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, placement_type TEXT NOT NULL,
  description TEXT, price_per_day NUMERIC NOT NULL,
  max_days INTEGER NOT NULL DEFAULT 30, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.merchant_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.ad_packages(id) ON DELETE SET NULL,
  placement_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  image_url TEXT, link_url TEXT, duration_days INTEGER NOT NULL,
  start_date DATE, end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_amount NUMERIC DEFAULT 0, payment_proof_url TEXT,
  rejection_reason TEXT, view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📦 Paket Berlangganan POS

```
┌─────────────────────────────────────────────────────────┐
│  STARTER  Rp 99.000/bln                                 │
│  ✓ 1 outlet  ✓ Kasir + stok  ✓ Laporan dasar           │
│  ✓ 2 user   ✓ Print thermal  ✓ Export CSV               │
├─────────────────────────────────────────────────────────┤
│  BISNIS  Rp 249.000/bln  ⭐ TERPOPULER                  │
│  ✓ 3 outlet  ✓ HPP + Laba Rugi + Cashflow               │
│  ✓ Pembelian ke supplier  ✓ Loyalty + Voucher           │
│  ✓ Kirim struk WA  ✓ Export PDF                         │
│  ✓ Absensi karyawan + Jadwal shift                      │
│  ✓ 5 user  ✓ Manajemen meja (10 meja)                   │
│  ✓ Target Omzet  ✓ Hutang & Piutang                     │
├─────────────────────────────────────────────────────────┤
│  PROFESIONAL  Rp 499.000/bln                            │
│  ✓ Outlet tidak terbatas                                │
│  ✓ Resep & bahan baku (otomatis kurangi stok)           │
│  ✓ Kitchen Display System (KDS)                         │
│  ✓ Payroll karyawan otomatis                            │
│  ✓ Hutang & piutang lengkap                             │
│  ✓ Export ke Accurate/MYOB/Zahir                        │
│  ✓ API integrasi marketplace                            │
│  ✓ User tidak terbatas                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔗 Sprint Selanjutnya

| Sprint | Fokus | Status |
|--------|-------|--------|
| Sprint 1 (P1) | Integrasi Inti | ✅ Selesai |
| Sprint 2 (P2) | Galeri toko, stok alert, multi alamat, beli lagi, dispute | ⏳ |
| Sprint 3 (P2+P3) | Balas ulasan, laporan merchant, profil desa, booking wisata | ⏳ |
| Sprint 4 (P3+P4) | Laporan desa, pemandu wisata, manajemen paket langganan | ⏳ |
| Sprint 5 (P4+P5) | Komisi dinamis, P&L platform, batch delivery kurir | ⏳ |
| Sprint 6 (P5+P6) | QR Pay, menu digital QR, penghasilan kurir PDF, pre-order | ⏳ |

---

## 🔖 Catatan Teknis

- **Stack:** React + Vite + Express + PostgreSQL + TypeScript + Tailwind + shadcn/ui
- **Realtime:** SSE sudah aktif (`/api/sse`) — gunakan untuk tracking, notif, dan dashboard admin
- **WhatsApp:** API WA terintegrasi di server — `POST /api/whatsapp/send`
- **PDF:** `jsPDF` + `jspdf-autotable` atau `window.print()` dengan print CSS
- **Storage:** Upload lokal ke `/uploads/` — served via `/storage/*`
- **POS Sync:** `/api/pos/sync-stock` dan `/api/pos/sync-product` sudah aktif
- **Thermal Printer:** Web Serial API (ESC/POS) — `src/lib/thermalPrinter.ts`
- **TypeScript:** Semua file bebas dari TS errors (gunakan `as any` jika tabel belum ada di types)
