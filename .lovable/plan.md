

# Rencana Perbaikan: Pemisahan Pendapatan & Sistem Keuangan Kurir

## Bug Kritis: Build Error
File `src/main.tsx` mengimpor `virtual:pwa-register` yang gagal resolve. PWA plugin dengan `registerType: 'autoUpdate'` sudah auto-register. Solusi: hapus import manual dan gunakan inline check.

## Bagian 1: Pemisahan Pendapatan Merchant

### Masalah Saat Ini
- `MerchantOrdersPage.tsx` baris 427: `stats.total_revenue` dihitung dari `order.total` (termasuk ongkir + biaya COD + biaya platform)
- `QuickStats.tsx` baris 87-89: `todayRevenue` juga dari `order.total`
- `DailySummaryCard.tsx`: sama, pakai `order.total`
- `MerchantDashboardPage.tsx` baris 122: chart revenue dari `order.total`
- Seharusnya pendapatan merchant = `order.subtotal` saja (harga produk x qty), BUKAN `order.total`

### Perubahan
1. **`MerchantOrdersPage.tsx`** -- Ubah stat "Pendapatan" dari `curr.total` ke `curr.subtotal`, rename label jadi "Pendapatan Produk"
2. **`QuickStats.tsx`** -- Ubah `todayRevenue` dari `o.total` ke `o.subtotal`
3. **`DailySummaryCard.tsx`** -- Ubah revenue calc dari `total` ke `subtotal`
4. **`MerchantDashboardPage.tsx`** -- Ubah chart revenue dari `order.total` ke `order.subtotal`, fetch `subtotal` field
5. **`WithdrawalManager.tsx`** -- Tidak perlu diubah (saldo sudah di-manage admin)

## Bagian 2: Sistem Keuangan Kurir (Deposit/Kredit)

### Konsep Baru
```text
Alur Saldo Kurir:
1. Kurir wajib setor deposit awal ke admin (transfer) → saldo bertambah
2. Kurir dapat pesanan COD (terima cash dari pembeli) → saldo BERKURANG sebesar ongkir
   (karena dia sudah pegang cash, tapi ongkir bukan miliknya sepenuhnya)
3. Kurir dapat pesanan Transfer (ongkir sudah dibayar online) → saldo BERTAMBAH sebesar komisi ongkir
4. Kurir bisa tarik saldo, tapi harus menyisakan saldo minimum (diatur admin)
5. Jika saldo < minimum, kurir wajib setor dulu sebelum bisa tarik

Rumus:
- Komisi kurir = shipping_cost × (courier_commission% / 100)
- COD: kurir terima cash = order.total, harus setor ke admin = order.total - komisi
  → saldo berkurang sebesar (order.total - komisi kurir)
- Transfer: kurir tidak pegang cash → saldo bertambah sebesar komisi kurir
```

### Database: Tambah setting & tabel
1. **`app_settings`** -- Tambah key `courier_minimum_balance` dengan value `{ amount: 50000 }` (default Rp 50.000)
2. **`courier_deposits`** (tabel baru) -- Track setiap setoran kurir ke admin:
   - `id`, `courier_id`, `amount`, `proof_url`, `status` (PENDING/APPROVED/REJECTED), `admin_notes`, `approved_by`, `created_at`, `processed_at`
3. **`courier_balance_logs`** (tabel baru) -- Log setiap perubahan saldo:
   - `id`, `courier_id`, `order_id`, `type` (DEPOSIT/COD_DEBIT/TRANSFER_CREDIT/WITHDRAWAL), `amount`, `balance_before`, `balance_after`, `description`, `created_at`

### File yang Diubah/Dibuat

4. **`CourierEarningsPage.tsx`** -- Perbaiki kalkulasi: tampilkan rincian per pesanan (komisi dari ongkir, bukan total), tambah indikator COD vs Transfer
5. **`CourierWithdrawalPage.tsx`** -- Tambah validasi saldo minimum (fetch dari `app_settings.courier_minimum_balance`), tampilkan info "saldo minimal harus tersisa Rp X"
6. **`CourierDashboardPage.tsx`** -- Tambah card saldo ringkas (saldo tersedia, saldo minimum, status), tambah tombol "Setor Saldo"
7. **`CourierDepositPage.tsx`** (baru) -- Form setoran: upload bukti transfer, input jumlah, riwayat setoran
8. **`AdminSettingsPage.tsx`** -- Tambah input "Saldo Minimum Kurir" di tab Pengiriman
9. **`AdminCouriersPage.tsx`** -- Tambah kolom saldo di tabel kurir, tombol approve deposit

### Routing
10. **`App.tsx`** -- Tambah route `/courier/deposit` → `CourierDepositPage`
11. **`CourierSidebar.tsx`** -- Tambah menu "Setor Saldo"

## Bagian 3: Fix Build Error
12. **`src/main.tsx`** -- Hapus import `registerSW` dari `virtual:pwa-register` (VitePWA `autoUpdate` sudah handle otomatis)

## Total: ~12 file diubah/dibuat, 1 migrasi database

