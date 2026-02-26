

# Real-Time Courier Tracking via Supabase Broadcast

## Ringkasan

Mengubah sistem pelacakan kurir dari yang sebelumnya mengandalkan `UPDATE` database setiap kali GPS bergerak, menjadi menggunakan **Supabase Realtime Broadcast** (websocket). Database hanya di-update setiap 30 detik sebagai checkpoint. Hasilnya: marker kurir bergerak mulus di peta pembeli, hemat kuota database, dan baterai kurir lebih awet.

## Arsitektur Perubahan

```text
SEBELUM:
  Kurir GPS → UPDATE couriers (setiap gerak) → postgres_changes → Peta pembeli
  Masalah: Terlalu banyak write DB, delay antrean

SESUDAH:
  Kurir GPS → Broadcast via websocket (setiap gerak) → Peta pembeli (instan)
                ↘ UPDATE couriers (setiap 30 detik, checkpoint saja)
```

## File yang Diubah

### 1. `src/components/CourierLocationUpdater.tsx` (Sisi Kurir)
- Tambah Supabase channel `courier-tracking-{courierId}` saat tracking aktif
- Di `watchPosition` callback, kirim lokasi via `channel.send({ type: 'broadcast', event: 'location-update', payload })` -- ini TIDAK menyentuh database
- Pertahankan interval 30 detik untuk `updateLocationToServer()` sebagai checkpoint DB
- Cleanup channel saat tracking dimatikan atau komponen unmount
- Gunakan ref untuk channel agar tidak stale di callback watchPosition

### 2. `src/components/CourierMap.tsx` (Peta Admin/Pembeli)
- Tambah listener `.on('broadcast', { event: 'location-update' })` di channel yang sama
- Broadcast listener langsung update state `couriers` -- marker bergerak instan
- Pertahankan `postgres_changes` listener sebagai fallback untuk checkpoint 30 detik
- Hapus polling interval 30 detik (tidak perlu lagi karena sudah ada broadcast + postgres_changes)
- Jika tracking 1 kurir spesifik, auto-center peta mengikuti pergerakan

### 3. `src/pages/OrderTrackingPage.tsx` (Halaman Pembeli)
- Import dan render `<CourierMap>` saat status pesanan `ASSIGNED`, `PICKED_UP`, atau `SENT` dan ada `courier_id`
- Tampilkan di bawah info kurir dengan judul "Live Tracking Kurir"
- Tambah juga marker tujuan (alamat pengiriman) jika `delivery_lat`/`delivery_lng` tersedia
- Height peta: `250px` agar tidak terlalu besar di mobile

## Detail Teknis

### Broadcast Flow (CourierLocationUpdater)
```text
watchPosition callback:
  1. setCurrentLocation(lat, lng)        -- update UI lokal
  2. channelRef.current.send({           -- broadcast via websocket
       type: 'broadcast',
       event: 'location-update',
       payload: { id: courierId, lat, lng, timestamp }
     })
  3. TIDAK ada database write

Interval 30 detik (tetap ada):
  1. updateLocationToServer(lat, lng)    -- UPDATE couriers SET current_lat, current_lng
  2. Ini trigger postgres_changes        -- fallback untuk penerima yang baru join
```

### Broadcast Listener (CourierMap)
```text
Channel setup:
  1. supabase.channel(`courier-tracking-${courierId}`)
  2. .on('broadcast', { event: 'location-update' }, handler)  -- pergerakan instan
  3. .on('postgres_changes', { ... }, handler)                 -- checkpoint fallback
  4. .subscribe()
```

### Tidak Ada Perubahan Database
- Tidak perlu migrasi SQL
- Tidak perlu tabel baru
- Broadcast berjalan murni via websocket, tidak menyentuh database
- Supabase Realtime Broadcast sudah aktif secara default

## Total: 3 file diubah, 0 migrasi database

