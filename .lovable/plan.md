

# Perbaikan Checkout UX & Peta Interaktif Kurir untuk Merchant

## Bagian 1: Perbaikan Checkout (Bug dari Screenshot + UX)

### Masalah yang Terlihat
Dari screenshot: bagian "Detail Alamat" dan "Edit Alamat Manual" terlihat membingungkan -- tombol "Pilih kelurahan/desa" muncul di bawah tombol "Edit Alamat Manual" tanpa konteks yang jelas, dan field detail alamat kurang guidance visual.

### Perubahan di `CheckoutAddressForm.tsx`
1. Perbaiki flow alamat: sembunyikan "Edit Alamat Manual" jika alamat sudah terdeteksi dari peta/saved address, tampilkan hanya jika belum ada alamat
2. Gabungkan "Pilih kelurahan/desa" ke dalam section yang lebih intuitif -- jangan tampilkan sebagai link terpisah di bawah tombol
3. Tambah visual confirmation (checkmark hijau) saat alamat sudah lengkap
4. Detail alamat: tambah contoh placeholder yang lebih kontekstual, beri border highlight saat belum diisi

### Perubahan di `CheckoutPage.tsx`
5. Tambah progress step yang *active* -- highlight step saat ini (bukan semua inactive)
6. Tambah ringkasan alamat yang ringkas di bagian atas setelah diisi (collapsible)
7. Bottom bar: tambah label metode pembayaran yang dipilih agar user tahu apa yang akan terjadi
8. Animasi submit button: pulse saat semua valid, disabled state lebih jelas
9. Tambah "Gratis ongkir" badge jika subtotal melebihi threshold free shipping

## Bagian 2: Peta Interaktif Kurir di Merchant (Saat Pilih "Kurir Desa")

### Masalah Saat Ini
`CourierAssignDialog` hanya menampilkan list kurir dengan jarak teks -- tidak ada peta visual. Merchant tidak bisa melihat posisi kurir relatif terhadap toko & pembeli.

### Perubahan
10. **Buat `CourierMapSelector.tsx`** (komponen baru) -- peta Leaflet yang menampilkan:
    - Marker toko merchant (hijau)
    - Marker tujuan pengiriman / alamat pembeli (merah)
    - Marker semua kurir tersedia (motor icon) dengan posisi GPS realtime
    - Jarak tiap kurir ditampilkan di popup marker
    - Klik marker kurir = langsung assign
    - Subscribe ke broadcast `courier-tracking-*` untuk update posisi realtime

11. **Update `CourierAssignDialog.tsx`** -- tambah tab/toggle antara "Daftar" dan "Peta" view
    - Pass `merchantLat/Lng` dan `deliveryLat/Lng` ke `CourierMapSelector`
    - Saat kurir dipilih dari peta, panggil `manualAssignCourier`

12. **Update `MerchantOrdersPage.tsx`** -- pass `delivery_lat/lng` dari order ke `CourierAssignDialog` saat membuka dialog assign kurir

## Bagian 3: Perbaikan Pesanan di Admin

### Masalah
- `AdminOrdersPage.tsx` baris 233: pendapatan masih pakai `curr.total` (termasuk ongkir) -- harus `curr.subtotal`
- Admin tidak bisa melihat detail rincian (subtotal vs ongkir vs biaya lain) di dialog detail
- Tidak ada fitur assign kurir dari peta di admin

### Perubahan
13. **`AdminOrdersPage.tsx`** -- Fix revenue calc: `curr.total` → `curr.subtotal`, rename label "Total Pendapatan" → "Pendapatan Produk"
14. **`OrderDetailsDialog.tsx`** -- Tambah breakdown biaya (subtotal produk, ongkir, biaya COD, biaya platform) di dialog detail, bukan hanya subtotal + ongkir + total
15. Admin juga bisa akses `CourierMapSelector` saat assign kurir -- pass delivery coordinates ke `CourierAssignDialog`

## Bagian 4: Perbaikan Pesanan di Merchant

### Perubahan
16. **`MerchantOrdersPage.tsx`** -- Label "Pendapatan" sudah benar (pakai `subtotal`), tambah tooltip "Hanya produk, tidak termasuk ongkir"
17. Di dialog detail merchant: tampilkan breakdown yang sama (subtotal produk terpisah dari ongkir dan biaya lain)
18. Tambah indikator realtime kurir saat status ASSIGNED/SENT -- embed mini `CourierMap` di dialog detail

## Total: ~7 file diubah/dibuat, 0 migrasi database

