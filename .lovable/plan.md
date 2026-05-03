
# Hasil Audit: Kekurangan, Bug & Rencana Perbaikan

## Ringkasan Kondisi

| Aspek | Status |
|------|--------|
| Console browser | Bersih (tidak ada error/warning runtime) |
| Network requests | Bersih |
| Linter Supabase | 99 warning, **semua by-design** (lihat di bawah) |
| Security scan | 107 finding, semuanya level `warn`, tidak ada `error` |
| Data dummy | 6 merchant aktif, 12 produk, 3 courier aktif — siap test |
| Storage privat | `payment-proofs`, `pod-images`, `chat-images`, `courier-documents` sudah private |

**Kesimpulan: tidak ada bug runtime maupun celah keamanan kritis baru.** Semua perbaikan besar (RLS, signed URL, fungsi duplikat, dummy data) sudah selesai di iterasi sebelumnya.

---

## Analisis Warning yang Tersisa (semua by-design)

### Group 1 — 9× "Public Bucket Allows Listing"
Bucket `product-images`, `tourism-images`, `village-images`, `merchant-images`, `merchant-gallery`, `profile-images`, `promotions`, `review-images`, `admin-assets` sengaja public — ini marketplace, gambar produk/wisata/desa harus bisa dilihat semua orang tanpa login. **Tidak perlu diubah.**

### Group 2 — 90× "SECURITY DEFINER Function Executable"
Helper RLS seperti `has_role`, `is_admin`, `is_merchant`, `get_user_merchant_id`, `is_chat_participant`, `apply_voucher`, dll. wajib `SECURITY DEFINER` agar policy bisa cek role tanpa rekursi. Memang harus callable dari client (digunakan di RLS yang dievaluasi sebagai `auth.uid()`). **Tidak perlu diubah** — mengubah jadi INVOKER akan mematikan seluruh RLS.

### Catatan
Bisa di-suppress di security memory supaya scanner berikutnya tidak melaporkan ulang.

---

## Kekurangan Minor (2 item, opsional)

### Item #1 — Leaked Password Protection (HIBP) masih OFF (LOW)
Auth setting belum aktif. Cegah user pakai password yang sudah bocor di HaveIBeenPwned.

**Fix:** Aktifkan via `cloud--configure_auth` dengan `password_hibp_enabled: true`.

### Item #2 — `useEffect` di `PodImage.tsx` tidak handle error gracefully (LOW)
File `src/components/courier/PodImage.tsx` me-return `null` saat URL belum loaded → bisa terlihat seperti gambar hilang. Tambah skeleton placeholder + fallback alt text supaya UX lebih jelas saat loading/gagal.

**Fix:** Tampilkan `<div className="bg-muted animate-pulse" />` saat loading, dan icon broken-image saat gagal.

---

## Rencana Perbaikan

### Fase 1 — Auth Hardening (1 langkah)
1. **Enable HIBP** via `cloud--configure_auth({ password_hibp_enabled: true })`

### Fase 2 — UX Polish (1 file)
2. **Update `PodImage.tsx`** — tambah loading skeleton + error fallback

### Fase 3 — Security Memory (1 langkah)
3. **Update security memory** — dokumentasikan bahwa 9 public bucket + 90 SECURITY DEFINER warning adalah by-design, sehingga scanner berikutnya tidak melaporkan sebagai issue baru.

**Total perubahan: 1 file kode, 1 konfigurasi auth, 1 update memory. Tidak ada migrasi DB.**

---

## Yang TIDAK Diubah
- 9 bucket public marketplace (by design)
- ~90 SECURITY DEFINER helper (wajib untuk RLS)
- Skema database (sudah bersih, tidak ada duplikat fungsi tersisa)
- Dummy data (sudah lengkap untuk testing end-to-end)
