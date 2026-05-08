-- Phase 4: Multi-outlet & Audit Trail
-- Transfer Stok, Audit Log, Notifikasi, Akses Per Outlet

-- ============================================================
-- TRANSFER STOK ANTAR OUTLET
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  transfer_number text NOT NULL,
  from_outlet_id uuid REFERENCES pos_outlets(id) NOT NULL,
  to_outlet_id uuid REFERENCES pos_outlets(id) NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','approved','completed','rejected','cancelled')),
  notes text,
  rejection_reason text,
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  completed_by uuid REFERENCES auth.users(id),
  requested_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid REFERENCES pos_stock_transfers(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id) NOT NULL,
  variant_id uuid REFERENCES pos_product_variants(id),
  product_name text NOT NULL,
  sku text,
  unit text DEFAULT 'pcs',
  qty_requested numeric(15,3) NOT NULL DEFAULT 0,
  qty_sent numeric(15,3) DEFAULT 0,
  qty_received numeric(15,3) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- AUDIT LOG (Jejak Aktivitas User)
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id),
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  action text NOT NULL,
  module text NOT NULL,
  entity_type text,
  entity_id text,
  description text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- NOTIFIKASI IN-APP
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL DEFAULT 'info'
    CHECK (type IN ('info','warning','error','success')),
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- AKSES USER PER OUTLET (granular)
-- ============================================================

CREATE TABLE IF NOT EXISTS pos_user_outlet_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  pos_user_id uuid REFERENCES pos_users(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'kasir'
    CHECK (role IN ('owner','manager','kasir','staff_gudang','purchasing','finance','auditor')),
  is_active boolean DEFAULT true,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pos_user_id, outlet_id)
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE pos_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_user_outlet_access ENABLE ROW LEVEL SECURITY;

-- Stock Transfers
CREATE POLICY "tenant_owner_manage_transfers" ON pos_stock_transfers FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_users_select_transfers" ON pos_stock_transfers FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_users_create_transfers" ON pos_stock_transfers FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "tenant_owner_manage_transfer_items" ON pos_stock_transfer_items FOR ALL USING (
  transfer_id IN (
    SELECT id FROM pos_stock_transfers
    WHERE tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  )
);
CREATE POLICY "tenant_users_select_transfer_items" ON pos_stock_transfer_items FOR SELECT USING (
  transfer_id IN (
    SELECT id FROM pos_stock_transfers
    WHERE tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
  )
);

-- Audit Logs (read-only untuk semua, insert untuk semua)
CREATE POLICY "tenant_owner_read_audit" ON pos_audit_logs FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_users_read_audit" ON pos_audit_logs FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_users_write_audit" ON pos_audit_logs FOR INSERT WITH CHECK (
  tenant_id IN (
    SELECT id FROM pos_tenants WHERE user_id = auth.uid()
    UNION
    SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Notifications
CREATE POLICY "tenant_owner_manage_notif" ON pos_notifications FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "user_own_notif" ON pos_notifications FOR ALL USING (
  user_id = auth.uid()
);

-- User Outlet Access
CREATE POLICY "tenant_owner_manage_access" ON pos_user_outlet_access FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_users_read_access" ON pos_user_outlet_access FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pos_transfers_tenant ON pos_stock_transfers(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_from ON pos_stock_transfers(from_outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_to ON pos_stock_transfers(to_outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_status ON pos_stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_pos_transfer_items ON pos_stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_pos_audit_tenant ON pos_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_audit_user ON pos_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_audit_module ON pos_audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_pos_notif_user ON pos_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_pos_notif_tenant ON pos_notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_access ON pos_user_outlet_access(pos_user_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_access_outlet ON pos_user_outlet_access(outlet_id);
