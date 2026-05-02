# Rencana Perbaikan: Analisis Kekurangan, Bug & Database

## Status Audit

| Aspek | Temuan |
|------|--------|
| Console / Network | Bersih, tidak ada error runtime |
| Data dummy | OK (6 merchant, 12 produk, 4 desa, 4 wisata, 6 kategori) |
| RLS | Sebagian besar aman, ada 1 view rawan & beberapa policy bisa diperketat |
| Storage | 9 bucket public; **2 di antaranya berisi data sensitif** (`chat-images`, `pod-images`) |
| Functions | **4 fungsi DB terduplikasi** — sumber bug nyata |
| Auth | Leaked password protection masih OFF |
| Code | 10 file masih pakai `.single()` (sudah diaudit, mostly INSERT) |

---

## Bug & Kekurangan yang Ditemukan

### Bug #1 — Duplikasi Fungsi Database (CRITICAL)
4 fungsi `SECURITY DEFINER` punya 2 versi (overload signature berbeda):
- `get_user_courier_id` x2
- `get_user_merchant_id` x2
- `is_order_merchant` x2
- `use_merchant_quota` x2

**Dampak:** PostgreSQL bisa memanggil versi salah → RLS bocor / policy gagal evaluate → user lihat data orang lain ATAU malah ditolak akses sah. Ini juga sumber utama 107 warning linter "SECURITY DEFINER executable by public".

**Fix:** Identifikasi versi lama via `pg_proc`, DROP overload yang tidak terpakai, sisakan 1 signature yang dipakai RLS policy & app code.

### Bug #2 — Bucket Sensitif Masih Public (HIGH SECURITY)
- `chat-images` → public ⇒ siapa saja bisa baca foto chat antar buyer/merchant/courier
- `pod-images` → public ⇒ bukti pengiriman (alamat/wajah penerima) terbuka

**Fix:** Set `public=false` + tambah RLS `storage.objects` (hanya partisipan order). Update kode upload/baca pakai signed URL (sudah ada pattern `paymentProof.ts`).

Bucket lain (`product-images`, `tourism-images`, `village-images`, `merchant-images`, `merchant-gallery`, `profile-images`, `promotions`, `review-images`, `admin-assets`) memang sengaja public untuk marketplace — biarkan.

### Bug #3 — Leaked Password Protection OFF (MEDIUM)
Auth setting belum aktif. Aktifkan via `cloud--configure_auth` agar Supabase tolak password yang bocor di HaveIBeenPwned.

### Bug #4 — RLS `app_settings` & `halal_regulations` Terlalu Permisif (LOW)
SELECT `USING (true)` untuk semua row publik. Ini sebenarnya by design (settings whitelabel & regulasi publik), tapi pastikan **tidak ada kolom rahasia** masuk ke `app_settings.value` (cek isinya).

### Bug #5 — Tidak Ada Courier Aktif (DATA GAP)
0 courier di DB → fitur ride-hailing & pengiriman village courier tidak bisa di-test end-to-end. Tambah 2-3 dummy courier APPROVED.

### Bug #6 — `.single()` Sisa (LOW — sudah diaudit)
Sudah dipastikan semua sisa pakai `.single()` di konteks INSERT...RETURNING / by-PK lookup yang aman. Tidak perlu perubahan.

---

## Rencana Implementasi (1 migrasi DB + 1 auth config + ~3 file kode)

### Fase 1 — DB Hardening (1 migrasi SQL)
1. **DROP fungsi duplikat** — sisakan signature yang dipakai RLS:
   - `get_user_courier_id()` no-arg, drop yang ada arg
   - `get_user_merchant_id()` no-arg, drop yang ada arg
   - `is_order_merchant(uuid)` — sisakan satu
   - `use_merchant_quota(...)` — sisakan satu
2. **Privatisasi `chat-images` & `pod-images`** + RLS storage.objects
3. **Insert 3 dummy courier** APPROVED (motor, di Bogor) supaya ride-hailing testable

### Fase 2 — Auth Config
4. **Enable leaked password protection** via `cloud--configure_auth`

### Fase 3 — Kode (signed URL untuk bucket privat)
5. **`src/lib/chatImage.ts`** — helper `getChatImageSignedUrl()`
6. **`src/lib/podImage.ts`** — helper `getPodImageSignedUrl()`
7. **Update pemakai**: `OrderChat.tsx`, `ProofOfDelivery.tsx`, `DeliveryStatusCard.tsx` — pakai helper signed URL

---

## Yang TIDAK Diubah (Sudah Benar)
- 9 bucket marketplace public (produk/wisata/desa/dll) — by design
- `app_settings`, `halal_regulations`, `categories`, `pos_packages` SELECT publik — by design
- Kebanyakan warning "SECURITY DEFINER executable" — by design (helper RLS yang memang harus callable). Akan berkurang otomatis setelah duplikat di-DROP.
- Sisa `.single()` di 10 file — sudah aman.

**Total:** 1 migrasi SQL, 1 konfigurasi auth, 2 file helper baru, 3 file kode di-update.