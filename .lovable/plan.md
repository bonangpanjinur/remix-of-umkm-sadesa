
# Rencana Perbaikan & Pengembangan Komprehensif

## Ringkasan

Rencana ini mencakup 3 area utama: (A) Kuota gratis untuk merchant baru yang dapat diatur admin, (B) Fallback pembayaran ke rekening admin, dan (C) Analisis gap menyeluruh untuk kurir, pedagang, dan pembeli.

---

## A. Kuota Gratis Merchant Baru (Configurable)

**Masalah saat ini:**
- Free Tier hardcoded = 100 di `quotaHelpers.ts` dan `api.ts`
- Tidak bisa diatur dari dashboard admin

**Solusi:**
1. Tambahkan setting `free_tier_quota` di tabel `app_settings` dengan value `{ "limit": 100 }`
2. Ubah `quotaHelpers.ts` dan `api.ts` agar mengambil limit dari `app_settings` (dengan cache), bukan hardcoded
3. Tambahkan form pengaturan di `AdminSettingsPage.tsx` tab "Fitur & Registrasi" untuk mengatur jumlah kuota gratis bulanan

---

## B. Fallback Pembayaran ke Rekening Admin

**Status saat ini:**
- `CheckoutPage.tsx` sudah mengimplementasikan fallback ke `admin_payment_info` jika merchant belum isi bank (baris 228-241)
- `MerchantSettingsPage.tsx` sudah menampilkan hint "akan menggunakan rekening admin sebagai default"
- `AdminSettingsPage.tsx` sudah punya form "Rekening & QRIS Default Admin"

**Yang perlu diperbaiki:**
- Pastikan fallback juga berlaku di halaman `PaymentConfirmationPage.tsx` (tampilan info bank saat transfer)
- Pastikan `POSInvoice.tsx` juga ambil bank info dari admin jika merchant kosong

---

## C. Analisis Gap & Rencana Perbaikan

### C1. KURIR (Courier)

| No | Masalah | Prioritas | Solusi |
|----|---------|-----------|-------|
| 1 | Tidak ada fitur withdrawal/penarikan saldo kurir | Tinggi | Tambah halaman penarikan saldo kurir mirip merchant, dengan tabel `courier_withdrawal_requests` |
| 2 | Komisi kurir hardcoded 80% di `CourierEarningsPage.tsx` | Sedang | Pindahkan ke `app_settings` agar bisa diatur admin |
| 3 | Tidak ada notifikasi real-time saat dapat pesanan baru | Tinggi | Tambah realtime listener di courier dashboard + suara notifikasi |
| 4 | Tidak ada halaman pengaturan profil kurir | Sedang | Tambah halaman edit profil (nama, foto, kendaraan, rekening bank) |
| 5 | Tidak ada rating/review kurir dari pembeli | Rendah | Tambah sistem rating kurir setelah pesanan selesai |

### C2. PEDAGANG (Merchant)

| No | Masalah | Prioritas | Solusi |
|----|---------|-----------|-------|
| 1 | Free Tier limit hardcoded, tidak bisa diatur admin | Tinggi | Lihat bagian A di atas |
| 2 | POS belum memvalidasi status langganan POS | Sedang | Cek `pos_subscriptions` sebelum akses POS page |
| 3 | Tidak ada konfirmasi email/WhatsApp saat pesanan masuk | Sedang | Kirim notifikasi WhatsApp via webhook (future) |
| 4 | Merchant tidak bisa melihat detail pesanan lengkap (alamat pembeli di peta) | Rendah | Tambah peta kecil di detail pesanan merchant |
| 5 | Tidak ada fitur chat antara merchant dan pembeli | Rendah | Future feature |

### C3. PEMBELI (Buyer)

| No | Masalah | Prioritas | Solusi |
|----|---------|-----------|-------|
| 1 | Tidak ada halaman detail pesanan yang lengkap | Tinggi | Buat `OrderDetailPage` dengan timeline status, info kurir, dan peta tracking |
| 2 | Tidak ada notifikasi push saat status pesanan berubah | Sedang | Sudah ada `send-push-notification` edge function, pastikan dipanggil pada setiap perubahan status |
| 3 | Tidak bisa re-order (pesan ulang) dari riwayat | Rendah | Tambah tombol "Pesan Lagi" di riwayat pesanan |
| 4 | Review/ulasan belum punya halaman `/orders/:id/review` | Sedang | Buat halaman review setelah pesanan DONE |
| 5 | Tidak ada filter/tab status di halaman pesanan | Sedang | Tambah TabsList untuk filter: Aktif, Selesai, Dibatalkan |

---

## Rencana Implementasi (Urutan Prioritas)

### Fase 1 - Perbaikan Kritis
1. **Kuota gratis configurable** - Ubah hardcoded FREE_TIER_LIMIT menjadi dynamic dari `app_settings`, tambah UI di admin
2. **Validasi fallback pembayaran** - Pastikan `PaymentConfirmationPage` menggunakan admin bank info sebagai fallback
3. **Filter pesanan pembeli** - Tambah tab Aktif/Selesai/Dibatalkan di `OrdersPage`

### Fase 2 - Pengembangan Kurir
4. **Notifikasi real-time kurir** - Suara + toast saat pesanan baru masuk
5. **Penarikan saldo kurir** - Halaman withdrawal + tabel database
6. **Komisi kurir configurable** - Pindahkan 80% ke `app_settings`

### Fase 3 - Pengembangan Merchant
7. **Validasi akses POS** - Cek langganan POS aktif sebelum buka halaman
8. **Fallback bank di POS Invoice** - Gunakan admin bank jika merchant kosong

### Fase 4 - Pengembangan Pembeli
9. **Halaman detail pesanan** - Timeline, info kurir, peta
10. **Halaman review pesanan** - Form rating + ulasan setelah DONE
11. **Tombol pesan ulang** - Re-order dari riwayat

---

## Detail Teknis

### Database (SQL Migration)

```text
-- 1. Setting kuota gratis
INSERT INTO app_settings (key, value, description) 
VALUES ('free_tier_quota', '{"limit": 100}', 'Jumlah kuota gratis bulanan untuk merchant baru')
ON CONFLICT (key) DO NOTHING;

-- 2. Setting komisi kurir  
INSERT INTO app_settings (key, value, description)
VALUES ('courier_commission', '{"percent": 80}', 'Persentase komisi kurir dari ongkir')
ON CONFLICT (key) DO NOTHING;

-- 3. Tabel withdrawal kurir
CREATE TABLE IF NOT EXISTS courier_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES couriers(id) NOT NULL,
  amount NUMERIC NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- + kolom saldo di couriers
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS available_balance NUMERIC DEFAULT 0;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS pending_balance NUMERIC DEFAULT 0;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC DEFAULT 0;

-- RLS policies untuk courier_withdrawal_requests
ALTER TABLE courier_withdrawal_requests ENABLE ROW LEVEL SECURITY;
-- Kurir bisa baca & insert miliknya
-- Admin bisa CRUD semua
```

### File yang akan diubah/dibuat

**Diubah:**
- `src/lib/quotaHelpers.ts` - Dynamic FREE_TIER_LIMIT dari app_settings
- `src/lib/api.ts` - Sama, dynamic limit
- `src/hooks/useMerchantQuota.ts` - Gunakan dynamic limit
- `src/pages/admin/AdminSettingsPage.tsx` - Tambah input kuota gratis + komisi kurir
- `src/pages/CheckoutPage.tsx` - Pastikan fallback konsisten
- `src/pages/OrdersPage.tsx` - Tambah tab filter status
- `src/pages/courier/CourierEarningsPage.tsx` - Dynamic komisi dari settings
- `src/pages/CourierDashboardPage.tsx` - Notifikasi real-time + suara
- `src/components/merchant/POSInvoice.tsx` - Fallback bank info

**Dibuat baru:**
- `src/pages/courier/CourierWithdrawalPage.tsx` - Penarikan saldo kurir
- `src/pages/buyer/OrderDetailPage.tsx` - Detail pesanan lengkap
- `src/pages/buyer/WriteReviewPage.tsx` - Tulis ulasan pesanan
