-- Phase 2: Bahan Baku (Raw Materials) & Resep/BOM

-- Tabel Bahan Baku
CREATE TABLE IF NOT EXISTS pos_raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'gram',
  current_stock numeric(15,3) DEFAULT 0,
  min_stock numeric(15,3) DEFAULT 0,
  cost_per_unit numeric(15,4) DEFAULT 0,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabel Resep / Bill of Materials (BOM)
CREATE TABLE IF NOT EXISTS pos_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id) ON DELETE CASCADE NOT NULL,
  raw_material_id uuid REFERENCES pos_raw_materials(id) ON DELETE CASCADE NOT NULL,
  qty_needed numeric(15,4) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, raw_material_id)
);

-- Tabel Mutasi Bahan Baku
CREATE TABLE IF NOT EXISTS pos_raw_material_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES pos_raw_materials(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('initial','purchase','usage','adjustment','waste','return')),
  qty numeric(15,4) NOT NULL,
  qty_before numeric(15,4) DEFAULT 0,
  qty_after numeric(15,4) DEFAULT 0,
  reference_id uuid,
  reference_type text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE pos_raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_raw_material_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_raw_materials" ON pos_raw_materials
  FOR ALL USING (
    tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_recipes" ON pos_recipes
  FOR ALL USING (
    tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "tenant_raw_material_mutations" ON pos_raw_material_mutations
  FOR ALL USING (
    tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_materials_tenant ON pos_raw_materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_outlet ON pos_raw_materials(outlet_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON pos_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_material ON pos_recipes(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_raw_mut_material ON pos_raw_material_mutations(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_raw_mut_tenant ON pos_raw_material_mutations(tenant_id);
