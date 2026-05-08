-- P4-04: Add key_value column to api_keys table for public API validation
-- The AdminApiKeysPage already manages api_keys table; this adds the hashed key value for server validation.
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_value TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON public.api_keys (key_value) WHERE key_value IS NOT NULL;
