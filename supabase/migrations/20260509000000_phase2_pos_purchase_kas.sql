-- Phase 2: POS SaaS — Pembelian & Kas Harian
-- Purchase Orders + Cash Session Management

-- ============================================================
-- PURCHASE ORDERS (Pembelian ke Supplier)
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES pos_suppliers(id),
  supplier_name text NOT NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','partial','received','cancelled')),
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  amount_paid numeric(15,2) DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES pos_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id),
  variant_id uuid REFERENCES pos_product_variants(id),
  product_name text NOT NULL,
  sku text,
  unit text DEFAULT 'pcs',
  qty_ordered numeric(15,3) NOT NULL DEFAULT 0,
  qty_received numeric(15,3) DEFAULT 0,
  cost_price numeric(15,2) NOT NULL DEFAULT 0,
  discount numeric(15,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Retur ke Supplier
CREATE TABLE IF NOT EXISTS pos_purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE NOT NULL,
  purchase_order_id uuid REFERENCES pos_purchase_orders(id),
  supplier_name text NOT NULL,
  return_number text NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_return_id uuid REFERENCES pos_purchase_returns(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id),
  product_name text NOT NULL,
  qty numeric(15,3) NOT NULL,
  cost_price numeric(15,2) NOT NULL,
  subtotal numeric(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- KAS HARIAN (Cash Management / Shift)
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE NOT NULL,
  cashier_id uuid REFERENCES auth.users(id),
  cashier_name text NOT NULL,
  session_number text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  closing_balance numeric(15,2),
  expected_balance numeric(15,2),
  difference numeric(15,2),
  cash_sales_total numeric(15,2) DEFAULT 0,
  non_cash_sales_total numeric(15,2) DEFAULT 0,
  cash_in_total numeric(15,2) DEFAULT 0,
  cash_out_total numeric(15,2) DEFAULT 0,
  notes_open text,
  notes_close text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Mutasi kas manual (pemasukan & pengeluaran non-transaksi penjualan)
CREATE TABLE IF NOT EXISTS pos_cash_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE NOT NULL,
  cash_session_id uuid REFERENCES pos_cash_sessions(id),
  type text NOT NULL CHECK (type IN ('in','out')),
  category text NOT NULL DEFAULT 'other',
  amount numeric(15,2) NOT NULL DEFAULT 0,
  description text NOT NULL,
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE pos_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_cash_mutations ENABLE ROW LEVEL SECURITY;

-- Purchase Orders
CREATE POLICY "tenant_owner_manage_purchase_orders" ON pos_purchase_orders FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_users_select_purchase_orders" ON pos_purchase_orders FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_po_items" ON pos_purchase_order_items FOR ALL USING (
  purchase_order_id IN (
    SELECT id FROM pos_purchase_orders
    WHERE tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  )
);
CREATE POLICY "tenant_users_select_po_items" ON pos_purchase_order_items FOR SELECT USING (
  purchase_order_id IN (
    SELECT id FROM pos_purchase_orders
    WHERE tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
  )
);

-- Purchase Returns
CREATE POLICY "tenant_owner_manage_purchase_returns" ON pos_purchase_returns FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_owner_manage_purchase_return_items" ON pos_purchase_return_items FOR ALL USING (
  purchase_return_id IN (
    SELECT id FROM pos_purchase_returns
    WHERE tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  )
);

-- Cash Sessions
CREATE POLICY "tenant_owner_manage_cash_sessions" ON pos_cash_sessions FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_users_select_cash_sessions" ON pos_cash_sessions FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_users_manage_own_sessions" ON pos_cash_sessions FOR ALL USING (
  cashier_id = auth.uid()
);

-- Cash Mutations
CREATE POLICY "tenant_owner_manage_cash_mutations" ON pos_cash_mutations FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_users_select_cash_mutations" ON pos_cash_mutations FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_users_manage_own_mutations" ON pos_cash_mutations FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pos_purchase_orders_tenant ON pos_purchase_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_orders_outlet ON pos_purchase_orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_orders_status ON pos_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_orders_supplier ON pos_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pos_po_items_po ON pos_purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_tenant ON pos_cash_sessions(tenant_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_outlet ON pos_cash_sessions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_status ON pos_cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pos_cash_mutations_session ON pos_cash_mutations(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_mutations_tenant ON pos_cash_mutations(tenant_id, created_at DESC);
