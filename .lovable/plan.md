
# Tahap 3: Standarisasi Alamat + Sistem Iuran Verifikator

## Bagian A: Standarisasi Formulir Alamat

### Masalah Ditemukan
Ada **3 pola berbeda** untuk dropdown alamat di aplikasi ini:

1. **`AddressSelector`** (di `src/components/AddressSelector.tsx`) -- Menggunakan `addressApi.ts` dengan strategi parallel race 5 arah (cepat). Dipakai di: Checkout, Profil, Alamat Tersimpan.
2. **`AddressDropdowns`** (di `src/components/admin/AddressDropdowns.tsx`) -- Juga menggunakan `addressApi.ts`. Dipakai di: RegisterMerchantPage.
3. **`locationService`** (di `src/services/locationService.ts`) -- Menggunakan **hanya Emsifa API langsung** (lebih lambat, tidak ada fallback). Dipakai di: `SellerApplicationForm.tsx`.

Selain itu, `RegisterCourierPage` dan `RegisterVillagePage` menggunakan `addressApi.ts` tapi dengan dropdown manual (bukan komponen reusable), sehingga tidak konsisten dalam UX (tidak ada loading indicator, retry, dll).

### Solusi
Standarkan semua formulir alamat menggunakan komponen **`AddressSelector`** yang sudah ada, karena:
- Sudah menggunakan `addressApi.ts` (parallel race, cepat)
- Ada loading indicator per dropdown
- Ada retry mechanism
- Ada preload chain untuk edit mode

### File yang Diubah

| File | Perubahan |
|------|-----------|
| `src/components/seller/SellerApplicationForm.tsx` | Ganti `locationService` dengan `AddressSelector` |
| `src/pages/RegisterCourierPage.tsx` | Ganti dropdown manual dengan `AddressSelector` |
| `src/pages/RegisterVillagePage.tsx` | Ganti dropdown manual dengan `AddressSelector` |

### Detail Perubahan

**SellerApplicationForm.tsx:**
- Hapus import `locationService`
- Import `AddressSelector`, `AddressData`, `createEmptyAddressData`
- Ganti 4 dropdown terpisah + 4 state loading + 4 handler menjadi satu `<AddressSelector>` component
- Map `AddressData` ke field form saat submit

**RegisterCourierPage.tsx:**
- Hapus state `provinces`, `cities`, `districts`, `subdistricts`, `selectedProvinceCode`, dll
- Import dan gunakan `AddressSelector`
- Simpan `AddressData` ke state, map ke `formData` saat submit

**RegisterVillagePage.tsx:**
- Sama: ganti dropdown manual dengan `AddressSelector`
- Map output ke form values saat submit

---

## Bagian B: Sistem Iuran Verifikator (Peningkatan)

### Kondisi Saat Ini
Sudah ada fitur dasar:
- Tabel `kas_payments` dengan kolom: group_id, merchant_id, amount, payment_month, payment_year, status, notes, collected_by
- Verifikator bisa generate tagihan bulanan via `generate_monthly_kas` RPC
- Verifikator bisa tandai PAID/UNPAID
- Verifikator bisa kirim pengingat notifikasi
- Merchant bisa lihat status iuran via `MerchantKasCard`

### Fitur Baru yang Ditambahkan

#### 1. Tagihan Individual (Buat Tagihan ke Merchant Tertentu)
- Di dashboard verifikator, tambah tombol "Buat Tagihan Manual"
- Dialog form: pilih merchant (dropdown), jumlah, catatan, bulan/tahun
- Insert langsung ke `kas_payments`

#### 2. Kirim Tagihan Massal dengan Notifikasi
- Saat generate tagihan bulanan, otomatis kirim notifikasi ke semua merchant yang belum bayar
- Tambah tombol "Kirim Pengingat Semua" untuk batch reminder

#### 3. Riwayat Iuran Lengkap di Merchant
- Perbaiki `MerchantKasCard` menjadi halaman lengkap di merchant dashboard
- Tambah route `/merchant/dues` untuk halaman iuran
- Tampilkan: riwayat lengkap, total tunggakan, badge "Terverifikasi" pada pembayaran yang sudah dicatat verifikator

#### 4. Laporan Kas Verifikator
- Tambah tab "Laporan" di dashboard verifikator
- Rekap: total terkumpul, total tunggakan, persentase kepatuhan
- Filter per bulan/tahun
- Daftar merchant yang nunggak

#### 5. Status Verifikasi di Merchant
- Di `MerchantKasCard` dan halaman iuran merchant, tampilkan:
  - Badge "Terverifikasi oleh Verifikator" jika `collected_by` terisi
  - Tanggal verifikasi (`payment_date`)
  - Nama verifikator (query dari `collected_by`)

### Database Changes

```sql
-- Tidak perlu tabel baru, cukup tambah kolom untuk catatan tagihan
ALTER TABLE kas_payments ADD COLUMN IF NOT EXISTS invoice_note text;
ALTER TABLE kas_payments ADD COLUMN IF NOT EXISTS sent_at timestamptz;
```

### File Baru

| File | Deskripsi |
|------|-----------|
| `src/pages/merchant/MerchantDuesPage.tsx` | Halaman lengkap riwayat iuran merchant |
| `src/pages/verifikator/VerifikatorKasReportPage.tsx` | Laporan kas lengkap verifikator |

### File yang Diubah

| File | Perubahan |
|------|-----------|
| `src/pages/verifikator/VerifikatorDashboardPage.tsx` | Tambah dialog tagihan individual, tombol kirim pengingat massal, tab laporan |
| `src/components/merchant/MerchantKasCard.tsx` | Tambah badge "Terverifikasi", link ke halaman detail, nama verifikator |
| `src/components/verifikator/VerifikatorSidebar.tsx` | Tambah menu "Laporan Kas" |
| `src/components/merchant/MerchantSidebar.tsx` | Tambah menu "Iuran Kas" |
| `src/App.tsx` | Tambah route `/merchant/dues` dan `/verifikator/kas-report` |

### Alur Buat Tagihan Individual

```text
Verifikator klik "Buat Tagihan Manual"
  -> Dialog muncul: pilih merchant dari dropdown anggota kelompok
  -> Isi jumlah (default: iuran bulanan kelompok), catatan, bulan/tahun
  -> Submit -> insert ke kas_payments dengan status UNPAID
  -> Otomatis kirim notifikasi ke merchant
```

### Alur Kirim Tagihan Massal

```text
Verifikator klik "Generate Tagihan Bulan Ini"
  -> RPC generate_monthly_kas berjalan
  -> Setelah berhasil, tampilkan opsi "Kirim Notifikasi ke Semua"
  -> Klik -> batch insert notifications ke semua merchant yang UNPAID
  -> Toast: "X pengingat terkirim"
```

### Alur Merchant Melihat Iuran Terverifikasi

```text
Merchant buka halaman Iuran Kas
  -> Daftar iuran per bulan
  -> Status PAID + collected_by terisi -> Badge hijau "Terverifikasi"
  -> Status UNPAID -> Badge merah "Belum Bayar" 
  -> Total tunggakan ditampilkan di atas
```

---

## Ringkasan Perubahan

| Kategori | Jumlah File |
|----------|------------|
| File diubah | 9 |
| File baru | 2 |
| Migrasi database | 1 (tambah 2 kolom) |
| Total | 12 perubahan |
