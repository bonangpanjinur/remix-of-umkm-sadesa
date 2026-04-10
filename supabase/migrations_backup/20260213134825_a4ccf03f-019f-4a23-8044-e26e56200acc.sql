
-- Fase 0: Add missing columns and tables

-- 1. Add has_review to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_review BOOLEAN DEFAULT false;

-- 2. Add halal columns to merchants
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS halal_status TEXT DEFAULT 'NONE';
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS halal_certificate_url TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS ktp_url TEXT;

-- 3. Create halal_regulations table
CREATE TABLE IF NOT EXISTS public.halal_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.halal_regulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read halal_regulations" ON public.halal_regulations FOR SELECT USING (true);
CREATE POLICY "Admin can manage halal_regulations" ON public.halal_regulations FOR ALL USING (public.is_admin());

-- 4. Create increment_product_view function
CREATE OR REPLACE FUNCTION public.increment_product_view(product_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = product_id;
END;
$$;

-- 5. Fix auto_assign_merchant_to_group trigger to work on UPDATE too
-- Drop and recreate trigger to include UPDATE
DROP TRIGGER IF EXISTS auto_assign_merchant_to_group ON public.merchants;

CREATE OR REPLACE FUNCTION public.auto_assign_merchant_to_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
  v_verifikator_id UUID;
BEGIN
  -- Only process if verifikator_code is set and group_id is not
  IF NEW.verifikator_code IS NOT NULL AND NEW.group_id IS NULL THEN
    -- Find the trade group and verifikator for this code
    SELECT tg.id, tg.verifikator_id INTO v_group_id, v_verifikator_id
    FROM public.trade_groups tg
    JOIN public.verifikator_codes vc ON vc.trade_group = tg.name
    WHERE vc.code = NEW.verifikator_code
    LIMIT 1;

    IF v_group_id IS NOT NULL THEN
      NEW.group_id := v_group_id;
      NEW.verifikator_id := v_verifikator_id;
      
      -- Insert into group_members if not exists
      INSERT INTO public.group_members (group_id, merchant_id, status)
      VALUES (v_group_id, NEW.id, 'ACTIVE')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_assign_merchant_to_group
  BEFORE INSERT OR UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_merchant_to_group();

-- 6. Auto-assign admin_desa role when village is approved
CREATE OR REPLACE FUNCTION public.auto_assign_village_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- When village is approved and has a user_id
  IF NEW.registration_status = 'APPROVED' AND OLD.registration_status = 'PENDING' AND NEW.user_id IS NOT NULL THEN
    -- Add admin_desa role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin_desa')
    ON CONFLICT DO NOTHING;
    
    -- Add to user_villages if not exists
    INSERT INTO public.user_villages (user_id, village_id, role)
    VALUES (NEW.user_id, NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_village_admin ON public.villages;
CREATE TRIGGER auto_assign_village_admin
  AFTER UPDATE ON public.villages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_village_admin_role();
