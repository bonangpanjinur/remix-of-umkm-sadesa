

# Rencana Perbaikan Selanjutnya

## Status Terkini

Hampir semua item dari rencana sebelumnya **sudah selesai**:
- `safeGoBack()` diterapkan di 23 file (semua `navigate(-1)` sudah diganti)
- Audio alert merchant sudah berjalan via `useRealtimeOrders`
- Chat link sudah ada di AccountPage
- OrdersPage sudah punya realtime subscription
- Empty state di ShopsPage & ExplorePage sudah informatif
- `.single()` → `.maybeSingle()` sudah diterapkan pada read queries
- API cache layer, search bar, toast add-to-cart, "Lihat Lebih Banyak" — semua DONE

## Yang Masih Harus Dikerjakan

### 1. Hapus 116 File Migrasi Lama (HIGH)
Folder `supabase/migrations/` masih berisi **116 file** yang sudah di-backup ke `supabase/migrations_backup/`. File-file ini harus dihapus agar tidak membingungkan dan tidak menyebabkan konflik deployment.

### 2. Security: Function Search Path Mutable (MEDIUM)
Database linter menemukan **3 fungsi** yang tidak set `search_path`. Ini bisa menjadi vektor SQL injection jika attacker bisa memanipulasi `search_path`. Perlu diidentifikasi fungsi mana dan tambahkan `SET search_path = public`.

### 3. Security: RLS Policy Always True (MEDIUM)
Ada **1 RLS policy** yang menggunakan `WITH CHECK (true)` pada operasi INSERT/UPDATE/DELETE. Ini terlalu permisif dan perlu diperketat.

### 4. Security: Leaked Password Protection Disabled (LOW)
Fitur deteksi password bocor belum diaktifkan di konfigurasi auth.

### 5. Update `.lovable/plan.md` (LOW)
File plan masih menampilkan item-item yang sudah selesai sebagai "BELUM". Perlu diperbarui agar akurat.

---

## Rencana Implementasi

### Fase 1 — Database Cleanup
1. **Hapus semua 116 file** di `supabase/migrations/` (backup sudah aman di `migrations_backup/`)
2. Update `.lovable/plan.md` — tandai semua item sebagai DONE

### Fase 2 — Security Fixes (1 migrasi SQL)
3. **Fix 3 fungsi tanpa `search_path`** — identifikasi dan perbaiki via migrasi SQL dengan `ALTER FUNCTION ... SET search_path = public`
4. **Fix RLS policy "always true"** — perketat policy yang terlalu permisif pada operasi INSERT/UPDATE/DELETE
5. **Enable leaked password protection** — via konfigurasi auth

**Total: 116 file dihapus, 1 migrasi SQL, 1 file diupdate**

