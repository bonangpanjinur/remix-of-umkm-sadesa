## Tujuan
Menganalisis seluruh file SQL yang ada (116+ di `migrations_backup/`, 131 di `migrations/`, dan `main_migration.sql` 2186 baris) lalu mengkonsolidasikannya menjadi **5 file migrasi baru** yang bersih, terurut, dan idempotent (aman dijalankan ulang tanpa error).

## Lokasi Output
Folder baru: **`supabase/migrations_consolidated/`**

Semua file akan menggunakan `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` sebelum `CREATE POLICY`, dan blok `DO $$ ... EXCEPTION WHEN duplicate_object`/`IF NOT EXISTS` agar bebas error saat migrasi.

## Pembagian 5 File

### 1. `01_foundation_and_auth.sql`
**Fondasi sistem & autentikasi**
- Extensions (`pgcrypto`, `pg_trgm`)
- Enum `app_role`
- Fungsi utilitas: `update_updated_at_column()`, `set_updated_at()`
- Tabel: `profiles`, `user_roles`, `user_villages`, `password_reset_tokens`, `rate_limits`
- Fungsi role: `has_role`, `has_any_role`, `get_user_roles`, `is_admin`, `is_merchant`, `is_verifikator`
- Trigger `handle_new_user` (auto-create profile)
- GRANT + RLS + Policies untuk tabel di atas

### 2. `02_core_entities.sql`
**Entitas inti marketplace**
- `villages`, `categories`, `tourism`
- `merchants` (+ slug function `generate_merchant_slug`)
- `merchant_subscriptions`, `merchant_gallery`, `merchant_favorites`
- `trade_groups`, `group_members`, `group_announcements`, `kas_payments`
- `verifikator_codes`, `verifikator_earnings`, `verifikator_withdrawals`
- `transaction_packages`, `quota_tiers`, `quota_usage_logs`
- `couriers`, `courier_earnings`, `courier_deposits`, `courier_balance_logs`, `courier_withdrawal_requests`
- Views: `public_merchants`, `public_couriers` (SECURITY INVOKER)
- GRANT + RLS + Policies

### 3. `03_commerce_orders.sql`
**Produk, pesanan, dan transaksi**
- `products`, `product_images`, `product_variants`
- `orders`, `order_items` (constraint status lengkap)
- `flash_sales`, `vouchers`, `voucher_usages`, `promotions`
- `reviews`, `refund_requests`, `withdrawal_requests`
- `platform_fees`, `insurance_fund`
- `ride_requests` (Ojek Desa)
- Fungsi helper: `is_order_courier`, `is_order_merchant`
- GRANT + RLS + Policies

### 4. `04_communications_pos.sql`
**Chat, notifikasi, POS, halal, alamat**
- `notifications`, `broadcast_notifications`, `push_subscriptions`
- `chat_messages` + fungsi `is_chat_participant` + trigger auto-delete 3 jam
- `saved_addresses`, `wishlists`
- `pos_packages`, `pos_settings`, `pos_subscriptions`, `pos_transactions`
- `halal_regulations`
- `page_views`
- Storage buckets: `chat-images`, `review-images`, `products`, `halal-certificates`, `payment-proofs`, dll + storage policies
- GRANT + RLS + Policies

### 5. `05_admin_settings_seed.sql`
**Pengaturan admin, audit, backup, RPC, realtime, seed data**
- `app_settings`, `admin_audit_logs`, `backup_logs`, `backup_schedules`, `seo_settings`
- RPC penting: `accept_ride`, fungsi-fungsi balance/refund, dll
- Realtime publication: `ALTER PUBLICATION supabase_realtime ADD TABLE ...` (dibungkus DO block agar idempotent)
- Seed data: kategori default, `app_settings` default (COD, fees), `pos_packages` default, `transaction_packages` default, `halal_regulations`
- GRANT + RLS + Policies sisa

## Strategi Anti-Error
1. **Urutan file penting** — file 01 → 05 sesuai dependency. Tabel yang direferensikan harus dibuat lebih dulu.
2. **Idempotent guards**: `IF NOT EXISTS`, `OR REPLACE`, `DROP ... IF EXISTS` sebelum CREATE POLICY/TRIGGER, `ON CONFLICT DO NOTHING` untuk seed.
3. **GRANT setelah CREATE TABLE** dengan urutan: CREATE → GRANT → ENABLE RLS → POLICY.
4. **Tidak ada foreign key cross-file yang melompat ke tabel belum dibuat** — sudah diatur lewat urutan grouping.
5. **Tidak menyentuh schema reserved** (`auth`, `storage` schema langsung — hanya `storage.objects` policy & `storage.buckets` insert).
6. **Realtime publication** dibungkus blok pengecekan agar tidak error jika tabel sudah di-publish.

## Catatan
- Folder `migrations/` dan `migrations_backup/` lama **tidak dihapus** — tetap sebagai arsip.
- Folder baru `migrations_consolidated/` murni untuk dokumentasi/migrasi ulang ke environment baru. Tidak akan otomatis dijalankan oleh Supabase CLI (karena bukan di `migrations/`).
- Jika Anda ingin file ini menggantikan `migrations/` aktif, beri tahu setelah plan disetujui.

Setelah plan disetujui, saya akan membuat ke-5 file tersebut secara paralel.