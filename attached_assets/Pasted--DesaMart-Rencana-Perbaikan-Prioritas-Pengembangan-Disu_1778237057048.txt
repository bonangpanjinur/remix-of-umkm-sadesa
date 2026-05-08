# DesaMart — Rencana Perbaikan & Prioritas Pengembangan

> Disusun: 8 Mei 2026
> Dasar: analisis gap dari `docs/PROGRESS.md`
> Total fitur belum dikerjakan: **58 fitur** (18 POS + 40 Marketplace)

---

## Cara Membaca Dokumen Ini

| Kolom | Keterangan |
|-------|-----------|
| **Dampak** | Seberapa besar pengaruh ke pengguna (⭐⭐⭐ = besar) |
| **Usaha** | Estimasi waktu pengerjaan (S=<1 hari, M=1-3 hari, L=3-7 hari) |
| **Bergantung pada** | Fitur lain yang harus selesai lebih dulu |

---

## 🏁 SPRINT 1 — Selesaikan yang 80-90% (Tambal Lubang Cepat)

> Target: menyelesaikan fase yang hampir selesai agar 100% tuntas.
> Estimasi total: **3–5 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S1-01** | Laporan Cashflow POS (`/pos/laporan/cashflow`) | ⭐⭐⭐ | M | — |
| **S1-02** | Kartu member digital — QR code di halaman Customer POS | ⭐⭐ | S | Program loyalty (✅) |
| **S1-03** | Notifikasi expiry poin di dashboard loyalty | ⭐⭐ | S | Program loyalty (✅) |
| **S1-04** | Auto-sync stok berkala (Supabase Edge Function cron) | ⭐⭐ | M | Integrasi Phase 6 (✅) |
| **S1-05** | Webhook order marketplace — real-time push ke POS | ⭐⭐ | M | Integrasi Phase 6 (✅) |

### Alasan Sprint 1 Didahulukan
- **S1-01** melengkapi Phase 3 dari 80% → 100%. Pemilik UMKM **wajib** tahu arus kas.
- **S1-02 & S1-03** melengkapi Phase 5 dari 88% → 100%. Effort kecil, dampak langsung ke experience pelanggan.
- **S1-04 & S1-05** melengkapi Phase 6 dari 67% → 100%. Tanpa ini, integrasi marketplace hanya berjalan secara manual.

---

## 🚀 SPRINT 2 — Fitur Operasional Toko Fisik (POS Core UX)

> Target: membuat POS benar-benar siap dipakai di toko fisik sehari-hari.
> Estimasi total: **7–10 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S2-01** | Printer thermal struk (ESC/POS via Web Serial API) | ⭐⭐⭐ | L | — |
| **S2-02** | Split payment (sebagian tunai + sebagian QRIS/transfer) | ⭐⭐⭐ | M | — |
| **S2-03** | Cetak label produk dengan barcode dari halaman Produk | ⭐⭐ | M | — |
| **S2-04** | Auto-reorder point — notifikasi otomatis saat stok < threshold | ⭐⭐⭐ | M | — |
| **S2-05** | Analitik produk — slow-moving, dead stock, turnover rate | ⭐⭐ | M | Data stok (✅) |

### Alasan Sprint 2 Didahulukan setelah Sprint 1
- **Printer thermal** adalah kebutuhan paling sering diminta toko fisik. Tanpa struk fisik, POS terasa tidak lengkap.
- **Split payment** sangat umum di warung & UMKM ("bayar separuh cash, sisanya transfer").
- **Auto-reorder** mencegah kehabisan stok yang menyebabkan kehilangan penjualan.

---

## 🛒 SPRINT 3 — Tingkatkan Pengalaman Pembeli Marketplace

> Target: meningkatkan konversi dan retensi pembeli di marketplace.
> Estimasi total: **7–12 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S3-01** | Flash sale & limited-time deals (countdown timer) | ⭐⭐⭐ | M | — |
| **S3-02** | Kupon & voucher kode di marketplace (dari platform/merchant) | ⭐⭐⭐ | M | — |
| **S3-03** | Program poin loyalitas pembeli marketplace | ⭐⭐⭐ | L | S3-02 |
| **S3-04** | Rekomendasi produk personal ("Orang juga membeli…") | ⭐⭐⭐ | L | Data riwayat order (✅) |
| **S3-05** | Notifikasi restok produk favorit/wishlist | ⭐⭐ | S | Wishlist (✅) + data stok |
| **S3-06** | Perbandingan produk berdampingan (maks. 3 produk) | ⭐⭐ | M | — |

### Alasan Sprint 3 Penting
- **Flash sale + voucher** adalah driver konversi terbesar di e-commerce. Marketplace tanpa ini kalah bersaing.
- **Program poin** membuat pembeli kembali belanja (repeat order).
- **Rekomendasi personal** meningkatkan Average Order Value (AOV) tanpa biaya marketing tambahan.

---

## 🚗 SPRINT 4 — Perkuat Pengalaman Kurir

> Target: kurir bisa bekerja lebih efisien dan terpercaya.
> Estimasi total: **5–8 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S4-01** | Navigasi GPS — tombol buka Google Maps dari halaman order | ⭐⭐⭐ | S | — |
| **S4-02** | Bukti kirim foto — upload foto selesai antar | ⭐⭐⭐ | M | Supabase Storage |
| **S4-03** | Toggle online/offline kurir | ⭐⭐⭐ | S | — |
| **S4-04** | Rekap pendapatan harian/mingguan kurir | ⭐⭐⭐ | M | Data pengiriman (✅) |
| **S4-05** | Rating kurir oleh pembeli setelah pesanan tiba | ⭐⭐ | M | S4-02 |
| **S4-06** | Laporan performa kurir (tepat waktu %, jarak, rating) | ⭐⭐ | M | S4-04 + S4-05 |

### Alasan Sprint 4
- **GPS navigasi** effort paling kecil (1 tombol deep link), dampak paling besar untuk kurir.
- **Bukti kirim foto** meningkatkan kepercayaan pembeli dan melindungi kurir dari klaim palsu.
- **Toggle online/offline** diperlukan untuk manajemen kapasitas dan auto-assign yang lebih akurat.

---

## 🏘️ SPRINT 5 — Lengkapi Fitur Admin Desa & Verifikator

> Target: Admin Desa dan Verifikator punya alat yang cukup untuk perannya.
> Estimasi total: **5–8 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S5-01** | Laporan ekonomi desa (omzet UMKM, jumlah transaksi, grafik) | ⭐⭐⭐ | M | Data order merchant |
| **S5-02** | Manajemen event desa (pasar malam, festival, jadwal) | ⭐⭐⭐ | M | — |
| **S5-03** | Keanggotaan UMKM (daftar, verifikasi, sertifikat digital) | ⭐⭐⭐ | L | — |
| **S5-04** | Broadcast pengumuman ke semua merchant desa | ⭐⭐ | S | — |
| **S5-05** | Peta interaktif lokasi merchant & wisata di desa | ⭐⭐ | M | Data merchant + koordinat |
| **S5-06** | Laporan kunjungan wisatawan (traffic, rating destinasi) | ⭐⭐ | M | Data wisata (✅) |

### Alasan Sprint 5
- **Laporan ekonomi desa** adalah output utama yang dibutuhkan untuk pelaporan ke pemerintah daerah.
- **Event desa** mengaktifkan traffic ke marketplace dan UMKM lokal.
- **Keanggotaan UMKM** memberi legitimasi dan membuka akses ke program bantuan.

---

## 🧩 SPRINT 6 — Dashboard Super Admin & Merchant Lanjutan

> Target: Super Admin dan Merchant punya visibilitas & kontrol platform yang lebih baik.
> Estimasi total: **7–10 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S6-01** | Dashboard analitik platform real-time (GMV, transaksi/jam, funnel) | ⭐⭐⭐ | L | — |
| **S6-02** | Manajemen komisi & fee per kategori/merchant | ⭐⭐⭐ | M | — |
| **S6-03** | Broadcast notifikasi ke semua user / segmen | ⭐⭐⭐ | M | — |
| **S6-04** | Export laporan ke PDF/Excel (POS + marketplace) | ⭐⭐⭐ | M | Laporan (✅) |
| **S6-05** | Flash sale / promo waktu terbatas di halaman merchant | ⭐⭐⭐ | M | S3-01 |
| **S6-06** | Manajemen banner & promosi platform (slot iklan) | ⭐⭐ | M | — |
| **S6-07** | Audit log platform (siapa ubah apa, kapan) | ⭐⭐ | M | — |
| **S6-08** | Notifikasi WhatsApp ke pelanggan (struk, promo, poin) | ⭐⭐⭐ | L | API WhatsApp |

---

## 🌐 SPRINT 7 — Infrastruktur & Ekosistem (Jangka Panjang)

> Target: platform siap untuk skala besar dan integrasi third-party.
> Estimasi total: **14–21 hari kerja**

| # | Fitur | Dampak | Usaha | Bergantung pada |
|---|-------|--------|-------|----------------|
| **S7-01** | PWA offline-capable (IndexedDB + background sync) | ⭐⭐⭐ | L | — |
| **S7-02** | API publik REST + API Key management | ⭐⭐ | L | — |
| **S7-03** | Integrasi akuntansi (export jurnal ke Accurate/MYOB) | ⭐⭐ | L | Laporan laba rugi (✅) |
| **S7-04** | Cashback & reward program marketplace | ⭐⭐ | L | S3-03 |
| **S7-05** | Program afiliasi / referral (kode unik, komisi) | ⭐⭐ | L | — |
| **S7-06** | Layanan langganan produk rutin (subscribe & save) | ⭐⭐ | L | — |
| **S7-07** | Mode kiosk / self-checkout | ⭐ | L | — |
| **S7-08** | Dashboard multi-brand / multi-toko | ⭐ | L | Multi-outlet (✅) |

---

## 📅 Roadmap Visual (Urutan Sprint)

```
SEKARANG
   │
   ▼
┌─────────────────────────────────────────────────┐
│  SPRINT 1 — Tambal Lubang (3-5 hari)            │
│  ✦ Laporan Cashflow POS                         │
│  ✦ Kartu Member QR + Notif Expiry Poin          │
│  ✦ Auto-sync & Webhook Marketplace              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  SPRINT 2 — POS Toko Fisik (7-10 hari)         │
│  ✦ Printer Thermal + Split Payment              │
│  ✦ Label Produk + Auto-reorder + Analitik Stok │
└────────────────────┬────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌──────────────────────────┐
│  SPRINT 3        │  │  SPRINT 4                │
│  Pembeli         │  │  Kurir                   │
│  Marketplace     │  │  (5-8 hari)              │
│  (7-12 hari)     │  │  ✦ GPS, Foto, Toggle     │
│  ✦ Flash sale    │  │  ✦ Rekap Pendapatan      │
│  ✦ Voucher       │  │  ✦ Rating + Performa     │
│  ✦ Poin buyer    │  └──────────────────────────┘
│  ✦ Rekomendasi   │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  SPRINT 5 — Admin Desa & Verifikator (5-8 hari) │
│  ✦ Laporan Ekonomi Desa + Event + Keanggotaan   │
│  ✦ Peta Interaktif + Broadcast Pengumuman       │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  SPRINT 6 — Super Admin & Merchant (7-10 hari)  │
│  ✦ Dashboard GMV + Komisi + Broadcast           │
│  ✦ Export PDF/Excel + Flash Sale + WhatsApp     │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  SPRINT 7 — Infrastruktur & Ekosistem (2-3 mgg) │
│  ✦ PWA Offline + API Publik + Akuntansi         │
│  ✦ Afiliasi + Langganan + Kiosk                 │
└─────────────────────────────────────────────────┘
                     │
                     ▼
                  SELESAI 🎉
```

---

## 📊 Rekap Total Usaha

| Sprint | Fokus | Fitur | Estimasi |
|--------|-------|-------|----------|
| Sprint 1 | Tambal lubang Phase 3, 5, 6 | 5 fitur | 3–5 hari |
| Sprint 2 | POS toko fisik | 5 fitur | 7–10 hari |
| Sprint 3 | Pembeli marketplace | 6 fitur | 7–12 hari |
| Sprint 4 | Kurir | 6 fitur | 5–8 hari |
| Sprint 5 | Admin Desa & Verifikator | 6 fitur | 5–8 hari |
| Sprint 6 | Super Admin & Merchant | 8 fitur | 7–10 hari |
| Sprint 7 | Infrastruktur ekosistem | 8 fitur | 14–21 hari |
| **TOTAL** | | **44 fitur** | **48–74 hari** |

> Catatan: Sprint 3 dan Sprint 4 bisa dikerjakan **paralel** karena tidak saling bergantung.

---

## ⚡ Quick Wins — Selesai < 1 Hari, Dampak Besar

Jika ada waktu terbatas, mulai dari ini dulu:

| # | Fitur | Alasan |
|---|-------|--------|
| 1 | **GPS navigasi kurir** (tombol buka Maps dari order) | 1 baris kode, dampak langsung ke kurir |
| 2 | **Toggle online/offline kurir** | Field sederhana di tabel users |
| 3 | **Notifikasi restok** ke wishlist pembeli | Trigger saat stok diupdate |
| 4 | **Broadcast pengumuman** ke merchant desa | 1 form kirim notifikasi |
| 5 | **Export laporan ke CSV** di halaman yang belum ada | Sudah ada pola dari halaman lain |

---

*Dokumen ini harus diperbarui setiap sprint selesai. Tandai fitur dengan ✅ di `docs/PROGRESS.md` setelah selesai dikerjakan.*
