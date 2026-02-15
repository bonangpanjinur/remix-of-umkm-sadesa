

# Perbaikan Loading Alamat yang Gagal/Lambat

## Akar Masalah

Dari 3 strategi fetch paralel yang ada, **tidak ada yang bekerja dengan baik**:

| Strategi | Status | Alasan |
|----------|--------|--------|
| Direct fetch ke wilayah.id | Gagal | CORS diblokir browser |
| Edge function (wilayah-proxy) | Gagal | Belum terdeploy (404 Not Found) |
| CORS proxy (allorigins.win) | Tidak stabil | Layanan gratis, sering down |

Akibatnya dropdown alamat kosong atau loading sangat lama (15 detik timeout sebelum menyerah).

## Solusi

### 1. Deploy dan perbaiki Edge Function `wilayah-proxy`

Edge function sudah ada kodenya di `supabase/functions/wilayah-proxy/index.ts` tapi belum terdeploy. Kita perlu:
- Deploy edge function
- Perbaiki CORS headers agar sesuai standar (tambahkan header yang diperlukan oleh Supabase client)
- Ini akan menjadi strategi utama yang paling reliable karena berjalan di server (tidak kena CORS)

### 2. Tambah CORS proxy alternatif

Selain `allorigins.win`, tambahkan proxy alternatif lain sebagai backup:
- `corsproxy.io`
- Ini meningkatkan peluang salah satu proxy berhasil

### 3. Tambah error state dan tombol Retry di `AddressDropdowns`

Saat ini dropdown hanya kosong tanpa feedback. Perbaikan:
- Tambah state error per dropdown (kabupaten, kecamatan, kelurahan)
- Tampilkan pesan "Gagal memuat data" + tombol "Coba Lagi"
- User bisa retry tanpa harus mengulang pilihan sebelumnya

### 4. Kurangi timeout dari 15 detik ke 10 detik

15 detik terlalu lama menunggu. Dengan edge function yang aktif, 10 detik sudah lebih dari cukup.

## Detail Teknis

### File yang Diubah

| File | Perubahan |
|------|-----------|
| `supabase/functions/wilayah-proxy/index.ts` | Perbaiki CORS headers (tambah `x-supabase-client-platform` dll) |
| `src/lib/addressApi.ts` | Tambah CORS proxy alternatif, kurangi timeout ke 10s |
| `src/components/admin/AddressDropdowns.tsx` | Tambah error state, tombol retry, feedback visual |

### Perubahan CORS Headers (wilayah-proxy)

```text
Sebelum:
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'

Sesudah:
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

### Perubahan addressApi.ts

```text
1. Tambah fungsi fetchViaCorsProxy2() menggunakan corsproxy.io sebagai alternatif
2. Tambahkan ke array promises di fetchWithFallbacks (jadi 4 strategi paralel)
3. Kurangi timeout dari 15000ms ke 10000ms
```

### Perubahan AddressDropdowns.tsx

```text
State baru:
- errorRegencies, errorDistricts, errorVillages: boolean

Logika:
- Set error=true jika fetch return array kosong (dan parent sudah dipilih)
- Tampilkan "Gagal memuat. [Coba Lagi]" di bawah dropdown yang error
- Tombol retry memanggil load function dengan kode parent yang sama
```

### Alur Setelah Perbaikan

```text
User pilih provinsi
  -> 4 strategi fetch paralel dijalankan bersamaan:
     1. Direct fetch (kemungkinan gagal CORS, tapi dicoba)
     2. Edge function (UTAMA - paling reliable)
     3. CORS proxy allorigins.win
     4. CORS proxy corsproxy.io
  -> Yang pertama berhasil langsung dipakai (max 10 detik)
  -> Jika semua gagal: tampilkan error + tombol retry
  -> Hasil di-cache 24 jam ke localStorage
```

