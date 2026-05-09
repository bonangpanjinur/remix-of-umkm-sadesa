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
| **P2** | Pengalaman Pembeli & Toko | ✅ Selesai |
| **P3** | Admin Desa & Ekosistem Wisata | ✅ Selesai |
| **P4** | Super Admin & Keuangan Platform | ✅ Selesai |
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

## 🟠 FASE P2 — Pengalaman Pembeli & Toko ✅ SELESAI

### 2.1 Profil Toko Lengkap (Galeri, Halal, Jam Buka) ✅
- [x] Upload & kelola galeri foto toko (`merchant_gallery`)
- [x] Badge "Halal Bersertifikat" (via `halal_certificates`)
- [x] Jam buka/tutup + status "Buka Sekarang" (`merchant_operating_hours`)
- **File:** `src/pages/merchant/MerchantGalleryPage.tsx` (262 baris)
- **Route:** `/merchant/gallery`

### 2.2 Manajemen Stok dengan Alert ✅
- [x] Banner peringatan stok < ambang batas
- [x] Pengaturan ambang per produk
- [x] Riwayat pergerakan stok
- [x] Notif WA otomatis saat stok kritis
- **File:** `src/pages/merchant/MerchantStockPage.tsx` (468 baris)
- **Route:** `/merchant/stock`

### 2.3 Multi Alamat Pengiriman (Buyer) ✅
- [x] Halaman CRUD alamat tersimpan — `SavedAddressesPage`
- [x] Pilih alamat saat checkout
- [x] Label: Rumah, Kantor, Lainnya
- **File:** `src/pages/SavedAddressesPage.tsx`
- **Route:** `/saved-addresses`
- **Hooks:** `useSavedAddresses`, `AddressFormDialog`, `AddressCard`

### 2.4 Beli Lagi 1-Klik & Riwayat Lengkap ✅
- [x] Tombol "Pesan Lagi" di setiap order DONE/CANCELLED
- [x] Filter riwayat: Semua, Belum Bayar, Diproses, Dikirim, Selesai, Dibatalkan
- [x] Download invoice PDF per pesanan
- **File:** `src/pages/OrdersPage.tsx` (689 baris)
- **Hook:** `useReorder` — validasi stok & status merchant sebelum tambah ke cart

### 2.5 Dispute / Komplain Terstruktur ✅
- [x] Buyer ajukan komplain dengan foto bukti
- [x] Merchant respons komplain
- [x] Admin mediasi & putuskan resolusi (RESOLVED_REFUND / RESOLVED_REJECTED)
- [x] Status: PENDING → MERCHANT_RESPONDED → IN_MEDIATION → RESOLVED / CLOSED
- **File:** `src/pages/buyer/DisputePage.tsx` (465 baris)
- **Route:** `/orders/:orderId/dispute`

### 2.6 Balas Ulasan oleh Merchant ✅
- [x] Merchant tambahkan balasan ke review pelanggan
- [x] Filter: semua, belum dibalas, sudah dibalas
- [x] Notif badge merah di sidebar untuk ulasan belum dibalas
- **File:** `src/components/merchant/CustomerReviews.tsx` (360 baris)
- **Page:** `src/pages/merchant/MerchantReviewsPage.tsx`
- **Route:** `/merchant/reviews`

### 2.7 Laporan Keuangan Merchant (Laba Rugi Sederhana) ✅
- [x] Rekap omzet bulanan vs biaya platform (fee 3%)
- [x] Grafik tren penjualan 6 bulan (BarChart + LineChart)
- [x] Export PDF/Excel laporan keuangan
- **File:** `src/pages/merchant/MerchantFinancePage.tsx` (339 baris)
- **Route:** `/merchant/finance`

---

## 🟠 FASE P3 — Admin Desa & Ekosistem Wisata ✅ SELESAI

### 3.1 Profil & Galeri Desa Lengkap ✅
- [x] Form edit profil desa: nama, deskripsi, kontak, koordinat GPS
- [x] Upload foto utama + galeri multi-foto
- [x] QR Code desa untuk promosi offline (download PNG)
- [x] Link sosmed: Instagram, Facebook, Website
- **File:** `src/pages/desa/DesaProfilPage.tsx` (405 baris)
- **Route:** `/desa/profil`

### 3.2 Paket Wisata & Booking Online ✅
- [x] Admin desa buat/edit/hapus paket wisata
- [x] Detail paket: harga, durasi, min/max peserta, itinerary, fasilitas
- [x] Tab Booking: daftar pemesanan + kelola status (CONFIRMED, REJECTED)
- [x] Konfirmasi otomatis via WA (notifikasi ke buyer & admin)
- **File:** `src/pages/desa/DesaPaketWisataPage.tsx` (403 baris)
- **Route:** `/desa/paket-wisata`

### 3.3 Laporan Keuangan & Pendapatan Desa ✅
- [x] Total transaksi merchant se-desa + komisi desa
- [x] Grafik pendapatan bulanan dari merchant & wisata
- [x] Export laporan untuk Pemdes (PDF/CSV)
- [x] Laporan statistik wisata: view count, rating, occupancy
- **File:** `src/pages/desa/DesaLaporanKeuanganPage.tsx`, `DesaLaporanWisataPage.tsx`
- **Route:** `/desa/laporan-keuangan`, `/desa/laporan-wisata`

### 3.4 Jadwal & Pemandu Wisata ✅
- [x] Daftar pemandu + nomor WA + ketersediaan
- [x] Dialog tambah/edit pemandu
- [x] Badge aktif/nonaktif
- **File:** `src/pages/desa/DesaPemanduPage.tsx` (266 baris)
- **Route:** `/desa/pemandu`

---

## 🟡 FASE P4 — Super Admin & Keuangan Platform ✅ SELESAI

### 4.1 Manajemen Paket Langganan Platform ✅
- [x] CRUD paket kuota/transaksi: nama, harga, quota, komisi
- [x] Daftar permintaan paket dari merchant
- [x] Assign & kelola status paket per merchant
- [x] Perpanjangan & histori upgrade/downgrade
- **File:** `src/pages/admin/AdminTransactionQuotaPage.tsx` (900 baris)
- **Route:** `/admin/transaction-quota`

### 4.2 Dashboard Realtime Platform ✅
- [x] Transaksi per jam (grafik live via SSE)
- [x] Transaksi per menit (live 60 menit) — grafik AreaChart
- [x] User aktif saat ini (dari `sessions`)
- [x] Alert otomatis jika ada spike (rasio ≥ 2x, min 5 order/jam)
- [x] Feed pesanan terbaru 5 menit real-time
- [x] SSE endpoint `GET /api/admin/stats/stream` — update tiap 10 detik
- **File:** `server/routes/admin-stats.ts`, `src/hooks/useAdminRealtime.ts`
- **Page:** `src/pages/admin/AdminRealtimeDashboardPage.tsx`
- **Route:** `/admin/realtime`

### 4.3 Komisi Dinamis per Kategori & Desa ✅
- [x] Atur komisi berbeda per kategori produk (kuliner 3%, kriya 5%, dll)
- [x] Atur komisi per desa wisata
- [x] Histori perubahan komisi dengan timestamp
- **File:** `src/pages/admin/AdminKomisiPage.tsx` (319 baris)
- **Route:** `/admin/komisi`

### 4.4 Laporan Keuangan Platform (P&L) ✅
- [x] Pendapatan komisi marketplace + shipping + iklan
- [x] Breakdown per merchant, per periode
- [x] Grafik tren pendapatan harian/bulanan
- [x] Export PDF/Excel bulanan
- **File:** `src/pages/admin/AdminFinancePage.tsx` (415 baris)
- **Route:** `/admin/finance`

### 4.5 Sistem Tiket Support Internal ✅
- [x] User ajukan tiket bantuan (kategori: Pesanan, Pembayaran, Akun, Teknis)
- [x] Admin balas & ubah status tiket (Baru → Diproses → Selesai → Ditutup)
- [x] Thread percakapan real-time per tiket
- [x] Filter tiket per status & kategori di sisi admin
- [x] Badge prioritas: Rendah / Sedang / Tinggi / Mendesak
- [x] SLA info: respons dalam 24 jam kerja
- **File admin:** `src/pages/admin/AdminSupportTicketsPage.tsx`
- **File buyer:** `src/pages/buyer/BuyerSupportPage.tsx`
- **Route admin:** `/admin/support-tickets`
- **Route buyer:** `/support`
- **DB:** `support_tickets`, `support_ticket_messages`

### 4.6 Manajemen SEO & Konten Halaman Publik ✅
- [x] Edit meta title, description, OG image per halaman (maks. 160 karakter warning)
- [x] Preview SERP Google + preview OG card media sosial
- [x] Redirect rules (301/302) — tambah, toggle aktif, hapus
- [x] Generate sitemap XML + robots.txt viewer
- [x] Google Search Console & Tag Manager verification code management
- [x] Schema.org JSON-LD editor per halaman + global
- **File:** `src/pages/admin/AdminSEOPage.tsx`
- **Route:** `/admin/seo`
- **DB:** `seo_meta`, `seo_redirects`

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

### Tabel Support Tickets (P4.5) — BARU
```sql
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
```

### Tabel SEO (P4.6) — BARU
```sql
CREATE TABLE IF NOT EXISTS public.seo_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug TEXT NOT NULL UNIQUE,
  page_label TEXT,
  meta_title TEXT,
  meta_description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  canonical_url TEXT,
  robots TEXT DEFAULT 'index,follow',
  schema_json TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_redirects_from_path ON public.seo_redirects(from_path);
```

### Tabel HR Karyawan (P5-A, P5-B)
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

### Tabel Hutang & Piutang (P5-C)
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

## 🔗 Status Sprint

| Sprint | Fokus | Status |
|--------|-------|--------|
| Sprint 1 (P1) | Integrasi Inti | ✅ Selesai |
| Sprint 2 (P2) | Galeri toko, stok alert, multi alamat, beli lagi, dispute | ✅ Selesai |
| Sprint 3 (P2+P3) | Balas ulasan, laporan merchant, profil desa, booking wisata | ✅ Selesai |
| Sprint 4 (P3+P4) | Laporan desa, pemandu wisata, manajemen paket langganan | ✅ Selesai |
| Sprint 5 (P4) | Komisi dinamis, P&L platform, tiket support, SEO admin | ✅ Selesai |
| Sprint 6 (P5+P6) | QR Pay, menu digital QR, penghasilan kurir PDF, pre-order | ⏳ Belum |

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
- **Support Tickets:** Tabel `support_tickets` + `support_ticket_messages` perlu dijalankan di DB
- **SEO:** Tabel `seo_meta` + `seo_redirects` perlu dijalankan di DB
