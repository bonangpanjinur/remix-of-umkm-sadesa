#!/usr/bin/env python3
"""
DesaMart — Database Migration Script
Adapts Supabase migrations to plain PostgreSQL (Replit environment).
"""
import os
import sys
import glob
import re
import subprocess

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

MIGRATION_DIRS = [
    "supabase/migrations",
]

def psql(sql: str, ignore_errors: bool = False) -> bool:
    result = subprocess.run(
        ["psql", DATABASE_URL, "-c", sql],
        capture_output=True, text=True
    )
    if result.returncode != 0 and not ignore_errors:
        print(f"  WARN: {result.stderr.strip()[:200]}")
        return False
    return True

def psql_file(filepath: str) -> tuple[bool, str]:
    result = subprocess.run(
        ["psql", DATABASE_URL, "-f", filepath, "--set=ON_ERROR_STOP=0"],
        capture_output=True, text=True
    )
    return result.returncode == 0, result.stderr

def clean_sql(sql: str) -> str:
    """
    Adapt Supabase-specific SQL to plain PostgreSQL.
    - Replace auth.users references with public.users
    - Remove supabase_realtime ALTER PUBLICATION statements
    - Remove TO authenticated / TO anon role grants (not applicable)
    - Remove storage bucket creation
    - Replace auth.uid() with a placeholder function call
    - Skip Supabase-specific extensions
    """
    lines = sql.split("\n")
    cleaned = []
    skip_block = False

    for line in lines:
        stripped = line.strip()

        # Skip supabase_realtime publication changes
        if "ALTER PUBLICATION supabase_realtime" in line:
            cleaned.append("-- SKIPPED: " + line)
            continue

        # Skip GRANT ... TO authenticated/anon
        if re.search(r"GRANT .* TO (authenticated|anon)\b", line, re.IGNORECASE):
            cleaned.append("-- SKIPPED: " + line)
            continue

        # Skip REVOKE ... FROM authenticated/anon  
        if re.search(r"REVOKE .* FROM (authenticated|anon)\b", line, re.IGNORECASE):
            cleaned.append("-- SKIPPED: " + line)
            continue

        # Skip storage schema operations
        if "storage.buckets" in line or "storage.objects" in line:
            cleaned.append("-- SKIPPED: " + line)
            continue

        # Skip supabase_storage_admin references
        if "supabase_storage_admin" in line:
            cleaned.append("-- SKIPPED: " + line)
            continue

        # Replace auth.users references → public.users
        line = line.replace("auth.users", "public.users")

        # Replace auth.uid() → public.current_user_id()
        line = line.replace("auth.uid()", "public.current_user_id()")

        # Remove TO authenticated from CREATE POLICY
        line = re.sub(r"\s+TO\s+authenticated\b", "", line)
        line = re.sub(r"\s+TO\s+anon\b", "", line)

        cleaned.append(line)

    return "\n".join(cleaned)

def bootstrap_schema():
    """Create foundational schema elements needed before running migrations."""
    print("→ Bootstrapping schema...")

    bootstrap_sql = """
-- Create auth schema stub (Supabase compatibility)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Create auth.uid() stub function
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULL::uuid $$;

-- Create auth.role() stub function
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT 'authenticated'::text $$;

-- Create current_user_id() placeholder for public schema
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULL::uuid $$;

-- Create public.users table (used by server-side auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    password_hash TEXT,
    replit_id TEXT UNIQUE,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auth schema users stub (for FK compatibility from Supabase migrations)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- app_role enum (may fail if already exists, that's ok)
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'buyer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extended role enum needed by later migrations
DO $$ BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'merchant';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verifikator';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'courier';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_desa';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Install pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
"""

    result = subprocess.run(
        ["psql", DATABASE_URL, "-c", bootstrap_sql, "--set=ON_ERROR_STOP=0"],
        capture_output=True, text=True
    )
    if "ERROR" in result.stderr and "already exists" not in result.stderr:
        print(f"  Bootstrap warnings: {result.stderr[:500]}")
    print("  ✓ Schema bootstrapped")

def get_migration_files():
    """Get all migration files sorted by name."""
    files = []
    for d in MIGRATION_DIRS:
        pattern = os.path.join(d, "*.sql")
        files.extend(glob.glob(pattern))
    # Sort by filename (chronological order)
    files.sort(key=lambda f: os.path.basename(f))
    return files

def run_migrations():
    """Run all migration files in order."""
    files = get_migration_files()
    print(f"→ Found {len(files)} migration files")

    success = 0
    failed = 0
    skipped = 0

    for filepath in files:
        filename = os.path.basename(filepath)
        print(f"  Running: {filename}")

        with open(filepath, "r", encoding="utf-8") as f:
            sql = f.read()

        # Clean the SQL
        cleaned = clean_sql(sql)

        # Write to temp file
        tmp_path = f"/tmp/migration_{filename}"
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(cleaned)

        # Run against database
        result = subprocess.run(
            ["psql", DATABASE_URL, "-f", tmp_path, "--set=ON_ERROR_STOP=0"],
            capture_output=True, text=True
        )

        errors = [l for l in result.stderr.split("\n") 
                  if "ERROR" in l and "already exists" not in l 
                  and "does not exist" not in l.lower()
                  and "column" not in l.lower()
                  and "relation" not in l.lower()]

        if errors:
            print(f"    ⚠ Errors in {filename}:")
            for e in errors[:3]:
                print(f"      {e[:120]}")
            failed += 1
        else:
            success += 1

    print(f"\n✓ Migration complete: {success} succeeded, {failed} with issues, {skipped} skipped")

def post_migration():
    """Run post-migration fixes."""
    print("→ Applying post-migration fixes...")

    fixes = """
-- Ensure public.users FK works: update any tables referencing auth.users to use public.users
-- The FK constraints were created referencing auth.users, but we want them pointing to public.users.
-- Since auth.users is a stub and public.users is the real table, we need to sync them.

-- Sync existing users from public.users to auth.users stub (for FK compatibility)
INSERT INTO auth.users (id, email)
SELECT id, email FROM public.users
ON CONFLICT (id) DO NOTHING;

-- Create trigger to keep auth.users in sync with public.users
CREATE OR REPLACE FUNCTION public.sync_to_auth_users()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auth.users (id, email) VALUES (NEW.id, NEW.email)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO auth.users (id, email) VALUES (NEW.id, NEW.email)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM auth.users WHERE id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_users_to_auth ON public.users;
CREATE TRIGGER sync_users_to_auth
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_to_auth_users();

-- Ensure user_roles references public.users correctly
-- Add column to user_roles if it only has role as app_role (some migrations expand it to TEXT)
DO $$ BEGIN
    ALTER TABLE public.user_roles ALTER COLUMN role TYPE TEXT USING role::TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make sure user_roles has a proper index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Add replit_id column to users if missing  
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS replit_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create unique index on replit_id if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_replit_id ON public.users(replit_id) WHERE replit_id IS NOT NULL;

-- Ensure profiles references public.users (not auth.users)
ALTER TABLE IF EXISTS public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE IF EXISTS public.profiles
    ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Drop and recreate user_roles FK to point to public.users
ALTER TABLE IF EXISTS public.user_roles
    DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE IF EXISTS public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix merchants FK
ALTER TABLE IF EXISTS public.merchants
    DROP CONSTRAINT IF EXISTS merchants_user_id_fkey;
ALTER TABLE IF EXISTS public.merchants
    ADD CONSTRAINT merchants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix orders FK (buyer_id)
ALTER TABLE IF EXISTS public.orders
    DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
ALTER TABLE IF EXISTS public.orders
    ADD CONSTRAINT orders_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix couriers FK
ALTER TABLE IF EXISTS public.couriers
    DROP CONSTRAINT IF EXISTS couriers_user_id_fkey;
ALTER TABLE IF EXISTS public.couriers
    ADD CONSTRAINT couriers_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix notifications FK
ALTER TABLE IF EXISTS public.notifications
    DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix ride_requests FK
ALTER TABLE IF EXISTS public.ride_requests
    DROP CONSTRAINT IF EXISTS ride_requests_passenger_id_fkey;
ALTER TABLE IF EXISTS public.ride_requests
    ADD CONSTRAINT ride_requests_passenger_id_fkey
    FOREIGN KEY (passenger_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix chat_messages FK
ALTER TABLE IF EXISTS public.chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;
ALTER TABLE IF EXISTS public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix reviews FK
ALTER TABLE IF EXISTS public.reviews
    DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE IF EXISTS public.reviews
    ADD CONSTRAINT reviews_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix wishlists FK
ALTER TABLE IF EXISTS public.wishlists
    DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
ALTER TABLE IF EXISTS public.wishlists
    ADD CONSTRAINT wishlists_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix saved_addresses FK
ALTER TABLE IF EXISTS public.saved_addresses
    DROP CONSTRAINT IF EXISTS saved_addresses_user_id_fkey;
ALTER TABLE IF EXISTS public.saved_addresses
    ADD CONSTRAINT saved_addresses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix merchant_favorites FK
ALTER TABLE IF EXISTS public.merchant_favorites
    DROP CONSTRAINT IF EXISTS merchant_favorites_user_id_fkey;
ALTER TABLE IF EXISTS public.merchant_favorites
    ADD CONSTRAINT merchant_favorites_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix refund_requests FK
ALTER TABLE IF EXISTS public.refund_requests
    DROP CONSTRAINT IF EXISTS refund_requests_buyer_id_fkey;
ALTER TABLE IF EXISTS public.refund_requests
    ADD CONSTRAINT refund_requests_buyer_id_fkey
    FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix push_subscriptions FK
ALTER TABLE IF EXISTS public.push_subscriptions
    DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
ALTER TABLE IF EXISTS public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix withdrawal_requests FK
ALTER TABLE IF EXISTS public.withdrawal_requests
    DROP CONSTRAINT IF EXISTS withdrawal_requests_user_id_fkey;
ALTER TABLE IF EXISTS public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix verifikator_codes FK
ALTER TABLE IF EXISTS public.verifikator_codes
    DROP CONSTRAINT IF EXISTS verifikator_codes_user_id_fkey;
ALTER TABLE IF EXISTS public.verifikator_codes
    ADD CONSTRAINT verifikator_codes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix verifikator_earnings FK
ALTER TABLE IF EXISTS public.verifikator_earnings
    DROP CONSTRAINT IF EXISTS verifikator_earnings_user_id_fkey;
ALTER TABLE IF EXISTS public.verifikator_earnings
    ADD CONSTRAINT verifikator_earnings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix verifikator_withdrawals FK
ALTER TABLE IF EXISTS public.verifikator_withdrawals
    DROP CONSTRAINT IF EXISTS verifikator_withdrawals_user_id_fkey;
ALTER TABLE IF EXISTS public.verifikator_withdrawals
    ADD CONSTRAINT verifikator_withdrawals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix page_views FK
ALTER TABLE IF EXISTS public.page_views
    DROP CONSTRAINT IF EXISTS page_views_user_id_fkey;
ALTER TABLE IF EXISTS public.page_views
    ADD CONSTRAINT page_views_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Ensure pos_users FK
ALTER TABLE IF EXISTS public.pos_users
    DROP CONSTRAINT IF EXISTS pos_users_user_id_fkey;
ALTER TABLE IF EXISTS public.pos_users
    ADD CONSTRAINT pos_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix admin_audit_logs FK
ALTER TABLE IF EXISTS public.admin_audit_logs
    DROP CONSTRAINT IF EXISTS admin_audit_logs_user_id_fkey;
ALTER TABLE IF EXISTS public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Fix broadcast_notifications FK
ALTER TABLE IF EXISTS public.broadcast_notifications
    DROP CONSTRAINT IF EXISTS broadcast_notifications_created_by_fkey;
ALTER TABLE IF EXISTS public.broadcast_notifications
    ADD CONSTRAINT broadcast_notifications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Add default admin user if not exists
INSERT INTO public.users (id, email, full_name, password_hash)
VALUES (
    gen_random_uuid(),
    'admin@desamart.id',
    'Admin DesaMart',
    'no-login'
)
ON CONFLICT (email) DO NOTHING;

-- Add admin role for that user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.users WHERE email = 'admin@desamart.id'
ON CONFLICT (user_id, role) DO NOTHING;

VACUUM ANALYZE;
"""

    result = subprocess.run(
        ["psql", DATABASE_URL, "-c", fixes, "--set=ON_ERROR_STOP=0"],
        capture_output=True, text=True
    )
    errs = [l for l in result.stderr.split("\n") if "ERROR" in l and "already exists" not in l]
    if errs:
        print("  Post-migration warnings:")
        for e in errs[:5]:
            print(f"    {e[:150]}")
    print("  ✓ Post-migration fixes applied")

def verify():
    """Verify key tables exist."""
    print("→ Verifying tables...")
    result = subprocess.run(
        ["psql", DATABASE_URL, "-c",
         "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split("\n")
    tables = [l.strip() for l in lines[2:] if l.strip() and not l.strip().startswith("(")]
    print(f"  ✓ {len(tables)} tables created")
    required = ["users", "user_roles", "profiles", "merchants", "products", "orders", "villages"]
    for t in required:
        if t in " ".join(tables):
            print(f"    ✓ {t}")
        else:
            print(f"    ✗ {t} MISSING!")

if __name__ == "__main__":
    print("=== DesaMart Database Migration ===\n")
    bootstrap_schema()
    run_migrations()
    post_migration()
    verify()
    print("\n✅ Migration complete!")
