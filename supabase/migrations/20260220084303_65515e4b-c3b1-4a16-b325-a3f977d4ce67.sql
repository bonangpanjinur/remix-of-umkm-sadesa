-- Auto-generate slug on merchant insert
CREATE OR REPLACE FUNCTION auto_set_merchant_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_merchant_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_merchant_slug
  BEFORE INSERT ON merchants
  FOR EACH ROW EXECUTE FUNCTION auto_set_merchant_slug();

-- Also auto-update slug when name changes and slug was auto-generated
CREATE OR REPLACE FUNCTION auto_update_merchant_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Only auto-update if name changed and old slug was derived from old name
  IF NEW.name IS DISTINCT FROM OLD.name AND (OLD.slug IS NULL OR OLD.slug = '' OR OLD.slug = generate_merchant_slug(OLD.name)) THEN
    NEW.slug := generate_merchant_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_update_merchant_slug
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION auto_update_merchant_slug();