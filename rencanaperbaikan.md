# DesaMart Platform — Rencana Perbaikan & Fitur Tersisa

> Terakhir diperbarui: berdasarkan analisis kode aktual
> Referensi: `progress.md` (status aktual), `BUG_ANALYSIS_AND_FIXES.md` (bug terdokumentasi)

---

## STATUS RINGKAS

Platform sudah sangat lengkap. Hampir seluruh fitur sudah terimplementasi — termasuk **POS Phase 5 & Phase 6** yang sebelumnya keliru ditandai "Belum Dikerjakan" di `DESAMART_POS_PROGRESS_REPORT.md`. Berikut yang masih perlu dikerjakan:

---

## 🔴 BUG — Harus Diperbaiki

### BUG-01: OrdersPage — Foto & Nama Produk Tidak Muncul
**File:** `src/pages/OrdersPage.tsx`
**Dampak:** Semua buyer tidak melihat gambar & nama produk di riwayat pesanan

**Akar masalah:**
- Fungsi `fetchOrders()` memiliki 4 level query fallback (L1–L4)
- Query L2, L3, dan L4 tidak menyertakan `product_id` dalam SELECT
- Karena `product_id` tidak ada, mekanisme secondary fetch tidak pernah berjalan
- `imageUrl` menjadi `undefined`, nama produk jatuh ke fallback "Produk"

**Perbaikan yang dibutuhkan:**
- [ ] Tambahkan `product_id` ke SELECT pada query L2, L3, dan L4
- [ ] Pastikan secondary fetch logic berjalan jika `product_id` tersedia
- [ ] Tambahkan fallback image URL (misalnya `/placeholder.svg`)

---

### BUG-02: OrdersPage — Tombol "Pesan Lagi" Tidak Berfungsi
**File:** `src/pages/OrdersPage.tsx` — fungsi `handleReorder()`
**Dampak:** Buyer tidak bisa memesan ulang produk dari riwayat pesanan

**Akar masalah:**
- `addToCart()` dipanggil dengan objek produk yang tidak lengkap
- Properti `isAvailable` tidak di-set (bernilai `undefined`)
- Properti wajib lain seperti `category`, `description` diberi string kosong
- Data produk diambil dari order history, bukan dari database produk aktual

**Perbaikan yang dibutuhkan:**
- [ ] Fetch data produk lengkap dari database sebelum `addToCart()`
- [ ] Set `isAvailable: true` hanya jika stok > 0 dan merchant aktif
- [ ] Isi semua properti wajib type `Product` dengan data aktual
- [ ] Tambahkan error handling jika produk sudah tidak tersedia

---

## 🟡 PERBAIKAN KUALITAS — Disarankan

### IMPROVE-01: DESAMART_POS_PROGRESS_REPORT.md — Status Phase 5 & 6 Salah
**File:** `DESAMART_POS_PROGRESS_REPORT.md`

Report lama mencatat Phase 5 (Loyalty & Promosi) dan Phase 6 (Integrasi Marketplace) sebagai **⬜ Belum Dikerjakan**, padahal keduanya **sudah selesai**:
- `src/pages/pos/POSPromosiPage.tsx` ✅ Ada & fungsional
- `src/pages/pos/POSLoyaltyPage.tsx` ✅ Ada & fungsional
- `src/pages/pos/POSIntegrasiPage.tsx` ✅ Ada & fungsional
- `supabase/migrations/20260511000000_phase5_loyalty_promosi.sql` ✅ Ada
- `supabase/migrations/20260512000000_phase6_marketplace_integration.sql` ✅ Ada
- Route `/pos/promosi`, `/pos/loyalty`, `/pos/integrasi` ✅ Terdaftar di `App.tsx`

**Aksi:**
- [x] Sudah dikoreksi di `progress.md` (file ini adalah sumber kebenaran baru)
- [ ] Update `DESAMART_POS_PROGRESS_REPORT.md` agar Phase 5 & 6 ditandai ✅ Selesai

---

### IMPROVE-02: Dokumentasikan Halaman POS Bonus
Empat halaman POS tambahan ada di kode tapi **tidak terdokumentasi di mana pun**:

| Halaman | Route | Keterangan |
|---------|-------|------------|
| `POSLaporanCashflowPage.tsx` | `/pos/laporan/cashflow` | Laporan arus kas masuk/keluar/net + grafik area |
| `POSAnalitikProdukPage.tsx` | `/pos/analitik-produk` | Fast/slow/dead moving, margin, turnover produk |
| `POSKioskPage.tsx` | `/pos/kiosk` | Mode self-service kiosk full-screen untuk customer |
| `POSAkuntansiPage.tsx` | `/pos/akuntansi` | Jurnal akuntansi double-entry (debit/kredit) |

**Aksi:**
- [ ] Tambahkan 4 halaman ini ke `DESAMART_POS_PROGRESS_REPORT.md` sebagai "Phase Bonus"
- [ ] Pastikan halaman ini masuk menu sidebar POS (`POSSidebar.tsx`)

---

### IMPROVE-03: Verifikasi Sidebar POS Mencantumkan Semua Menu
**File:** `src/components/pos/POSSidebar.tsx`

Periksa apakah menu berikut sudah ada di sidebar:
- [ ] Laporan Cashflow (`/pos/laporan/cashflow`)
- [ ] Analitik Produk (`/pos/analitik-produk`)
- [ ] Mode Kiosk (`/pos/kiosk`)
- [ ] Jurnal Akuntansi (`/pos/akuntansi`)
- [ ] Promosi (`/pos/promosi`) — Phase 5
- [ ] Loyalty (`/pos/loyalty`) — Phase 5
- [ ] Integrasi Marketplace (`/pos/integrasi`) — Phase 6

---

## 🟢 FITUR BARU — Opsional / Future Development

### FUTURE-01: Mode Offline POS (PWA + IndexedDB)
**Prioritas:** Rendah
- [ ] IndexedDB untuk cache data produk & transaksi saat offline
- [ ] Sync otomatis saat koneksi kembali
- [ ] Service worker dengan strategi cache yang tepat untuk `/pos/*`

### FUTURE-02: Printer Thermal ESC/POS
**Prioritas:** Rendah
- [ ] Integrasi Web Serial API untuk printer thermal
- [ ] Format struk ESC/POS standar
- [ ] Fallback ke `window.print()` jika tidak ada printer serial

### FUTURE-03: Webhook & API Publik POS
**Prioritas:** Rendah
- [ ] REST API endpoint untuk integrasi third-party
- [ ] Webhook event: transaksi baru, stok habis, order masuk
- [ ] API key management (sudah ada `/admin/api-keys` sebagai fondasi)

### FUTURE-04: WhatsApp Notifikasi Otomatis
**Prioritas:** Menengah
- Halaman `/admin/whatsapp` sudah ada
- [ ] Verifikasi integrasi API WhatsApp Business aktual berjalan
- [ ] Template pesan: konfirmasi order, status pengiriman, OTP

### FUTURE-05: Fitur Bandingkan Produk yang Lebih Lengkap
**Prioritas:** Rendah
- Halaman `/compare` sudah ada
- [ ] Tambahkan lebih banyak atribut perbandingan (berat, dimensi, garansi)
- [ ] Simpan daftar produk yang dibandingkan ke localStorage

---

## Urutan Prioritas Pengerjaan

| Prioritas | Item | Estimasi |
|-----------|------|----------|
| 🔴 **1** | BUG-01: Fix foto & nama produk di OrdersPage | 1–2 jam |
| 🔴 **2** | BUG-02: Fix tombol "Pesan Lagi" di OrdersPage | 2–3 jam |
| 🟡 **3** | IMPROVE-01: Update DESAMART_POS_PROGRESS_REPORT.md | 30 menit |
| 🟡 **4** | IMPROVE-02: Dokumentasikan halaman POS bonus | 30 menit |
| 🟡 **5** | IMPROVE-03: Verifikasi sidebar POS lengkap | 1 jam |
| 🟢 **6** | FUTURE-04: Verifikasi WhatsApp notifikasi | 2–4 jam |
| 🟢 **7** | FUTURE-01: Mode offline PWA | 1–2 hari |
| 🟢 **8** | FUTURE-02: Printer thermal | 1 hari |
| 🟢 **9** | FUTURE-03: Webhook & API publik | 1–2 hari |

---

## Catatan Teknis

### Sumber Kebenaran File
- **`progress.md`** — Status aktual semua fitur (diverifikasi dari kode)
- **`rencanaperbaikan.md`** — Ini, rencana perbaikan prioritas
- **`DESAMART_POS_PROGRESS_REPORT.md`** — Report POS lama, **sudah outdated**, perlu diupdate
- **`BUG_ANALYSIS_AND_FIXES.md`** — Detail teknis bug OrdersPage

### Stack Teknologi
- Frontend: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + Storage + Realtime)
- State: React Query + Context API
- Charts: Recharts
- Icons: Lucide React
- Notifikasi: Sonner (toast)
