

# Plan: Consolidated Main SQL Migration File

## Overview
Create a single `supabase/main_migration.sql` file that consolidates the entire database schema from `COMPLETE_DATABASE.md` plus 6 missing tables and several missing functions from later migrations. The file will be fully idempotent — safe to run on both fresh and existing databases.

## What's Being Consolidated

**Base:** `COMPLETE_DATABASE.md` (54 tables, ~60 functions, ~120 RLS policies, triggers, storage, realtime, default data)

**Missing from COMPLETE_DATABASE.md (added via later migrations):**
- Tables: `ride_requests`, `merchant_gallery`, `courier_deposits`, `courier_balance_logs`, `merchant_favorites`
- Functions: `is_chat_participant()`, `set_chat_auto_delete()`, `cleanup_expired_chats()`, `accept_ride()`, `approve_quota_subscription()`, `reject_quota_subscription()`
- Additional app_settings: `ride_fare_settings`, `courier_minimum_balance`
- Additional realtime: `ride_requests`, `courier_deposits`, `courier_balance_logs`, `chat_messages`

## Idempotency Strategy

Every object uses error-safe patterns:
- **Enums:** `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- **Tables:** `CREATE TABLE IF NOT EXISTS`
- **Columns:** `ALTER TABLE ADD COLUMN IF NOT EXISTS` (wrapped in DO blocks)
- **Indexes:** `CREATE INDEX IF NOT EXISTS`
- **Functions:** `CREATE OR REPLACE FUNCTION`
- **Policies:** Bulk `DROP POLICY IF EXISTS` loop first, then recreate all
- **Triggers:** `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER`
- **FK Constraints:** `DO $$ BEGIN ALTER TABLE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- **Storage Buckets:** `ON CONFLICT (id) DO NOTHING`
- **Realtime:** `DO $$ BEGIN ALTER PUBLICATION ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- **Default Data:** `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`

## File Structure

```text
supabase/main_migration.sql
├── BAGIAN 1: Extensions & Enum Types
├── BAGIAN 2: Utility Functions
├── BAGIAN 3: Core Tables (59 tables)
│   ├── 3.1-3.54 (from COMPLETE_DATABASE.md)
│   ├── 3.55 ride_requests
│   ├── 3.56 merchant_gallery
│   ├── 3.57 courier_deposits
│   ├── 3.58 courier_balance_logs
│   └── 3.59 merchant_favorites
├── BAGIAN 4: Indexes
├── BAGIAN 5: Views
├── BAGIAN 6: Functions (~30 functions)
│   ├── Role checking (has_role, is_admin, etc.)
│   ├── Entity lookup (get_user_merchant_id, etc.)
│   ├── Business logic (quota, COD, voucher, etc.)
│   ├── Chat (is_chat_participant, cleanup, auto_delete)
│   ├── Ride (accept_ride)
│   └── Admin RPCs (approve/reject_quota_subscription)
├── BAGIAN 7: Enable RLS (all 59 tables)
├── BAGIAN 8: RLS Policies (drop all → recreate all)
├── BAGIAN 9: Triggers
├── BAGIAN 10: Storage Buckets
├── BAGIAN 11: Realtime Publications
└── BAGIAN 12: Default Data (categories, tiers, settings)
```

## Implementation
One new file: `supabase/main_migration.sql` (~2200 lines). This replaces the need to reference `COMPLETE_DATABASE.md`, `complete_migration_v5.sql`, or any individual migration files. The existing files will remain untouched for history.

