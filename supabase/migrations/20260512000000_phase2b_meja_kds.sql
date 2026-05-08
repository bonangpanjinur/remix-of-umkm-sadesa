-- Phase 2B: Manajemen Meja & Kitchen Display System

-- Tabel Meja Restoran
CREATE TABLE IF NOT EXISTS pos_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE,
  name text NOT NULL,
  section text DEFAULT 'Utama',
  capacity int DEFAULT 4,
  status text DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','cleaning')),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabel Pesanan per Meja (antrian dapur)
CREATE TABLE IF NOT EXISTS pos_table_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE,
  table_id uuid REFERENCES pos_tables(id) ON DELETE SET NULL,
  table_name text,
  order_number text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','cooking','ready','served','paid','cancelled')),
  items jsonb NOT NULL DEFAULT '[]',
  notes text,
  customer_name text,
  cashier_name text,
  sale_id uuid REFERENCES pos_sales(id) ON DELETE SET NULL,
  priority int DEFAULT 0,
  cooking_started_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE pos_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_table_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_tables" ON pos_tables
  FOR ALL USING (tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid()));

CREATE POLICY "tenant_table_orders" ON pos_table_orders
  FOR ALL USING (tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pos_tables_tenant ON pos_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_tables_outlet ON pos_tables(outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_table_orders_tenant ON pos_table_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_table_orders_table ON pos_table_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_pos_table_orders_status ON pos_table_orders(status);

-- Enable realtime for KDS
ALTER PUBLICATION supabase_realtime ADD TABLE pos_table_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_tables;
