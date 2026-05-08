-- Phase 1: POS SaaS Tables
-- Platform UMKM - POS, Master Data, Stok Dasar

-- Tenant (usaha / bisnis)
CREATE TABLE IF NOT EXISTS pos_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  logo_url text,
  phone text,
  address text,
  timezone text DEFAULT 'Asia/Jakarta',
  language text DEFAULT 'id',
  currency text DEFAULT 'IDR',
  receipt_header text,
  receipt_footer text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Outlet / Cabang
CREATE TABLE IF NOT EXISTS pos_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- POS Users (role dalam sistem POS)
CREATE TABLE IF NOT EXISTS pos_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'kasir' CHECK (role IN ('owner','manager','kasir','staff_gudang','purchasing','finance','auditor')),
  pin text,
  outlet_id uuid REFERENCES pos_outlets(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Kategori Produk
CREATE TABLE IF NOT EXISTS pos_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES pos_categories(id),
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Brand
CREATE TABLE IF NOT EXISTS pos_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Produk
CREATE TABLE IF NOT EXISTS pos_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES pos_categories(id),
  brand_id uuid REFERENCES pos_brands(id),
  name text NOT NULL,
  sku text,
  barcode text,
  unit text DEFAULT 'pcs',
  price numeric(15,2) NOT NULL DEFAULT 0,
  cost_price numeric(15,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  is_stock_tracked boolean DEFAULT true,
  has_variants boolean DEFAULT false,
  image_url text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Varian Produk
CREATE TABLE IF NOT EXISTS pos_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES pos_products(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sku text,
  barcode text,
  price numeric(15,2),
  cost_price numeric(15,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Stok per Produk per Outlet
CREATE TABLE IF NOT EXISTS pos_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES pos_product_variants(id),
  outlet_id uuid REFERENCES pos_outlets(id) ON DELETE CASCADE NOT NULL,
  quantity numeric(15,3) DEFAULT 0,
  min_stock numeric(15,3) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, variant_id, outlet_id)
);

-- Mutasi Stok
CREATE TABLE IF NOT EXISTS pos_stock_mutations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id) NOT NULL,
  variant_id uuid REFERENCES pos_product_variants(id),
  outlet_id uuid REFERENCES pos_outlets(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('initial','purchase','sale','adjustment','return_sale','return_purchase','transfer_in','transfer_out','opname')),
  quantity numeric(15,3) NOT NULL,
  quantity_before numeric(15,3),
  quantity_after numeric(15,3),
  reference_id uuid,
  reference_type text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Customer
CREATE TABLE IF NOT EXISTS pos_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  is_member boolean DEFAULT false,
  total_purchase numeric(15,2) DEFAULT 0,
  transaction_count int DEFAULT 0,
  last_purchase_at timestamptz,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Supplier
CREATE TABLE IF NOT EXISTS pos_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  contact_person text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transaksi Penjualan (Header)
CREATE TABLE IF NOT EXISTS pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) NOT NULL,
  sale_number text NOT NULL,
  cashier_id uuid REFERENCES auth.users(id),
  cashier_name text,
  customer_id uuid REFERENCES pos_customers(id),
  customer_name text,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash','qris','transfer','debit','credit','split')),
  payment_amount numeric(15,2) DEFAULT 0,
  change_amount numeric(15,2) DEFAULT 0,
  status text DEFAULT 'completed' CHECK (status IN ('completed','void','refunded')),
  notes text,
  voided_by uuid REFERENCES auth.users(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz DEFAULT now()
);

-- Item Transaksi Penjualan
CREATE TABLE IF NOT EXISTS pos_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES pos_sales(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES pos_products(id),
  variant_id uuid REFERENCES pos_product_variants(id),
  product_name text NOT NULL,
  variant_name text,
  sku text,
  qty numeric(15,3) NOT NULL DEFAULT 1,
  price numeric(15,2) NOT NULL,
  cost_price numeric(15,2) DEFAULT 0,
  discount numeric(15,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  subtotal numeric(15,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Bill Ditahan (Hold Bill)
CREATE TABLE IF NOT EXISTS pos_held_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) NOT NULL,
  cashier_id uuid REFERENCES auth.users(id),
  label text,
  customer_name text,
  customer_id uuid REFERENCES pos_customers(id),
  items jsonb NOT NULL DEFAULT '[]',
  discount_amount numeric(15,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Retur Penjualan
CREATE TABLE IF NOT EXISTS pos_sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES pos_tenants(id) ON DELETE CASCADE NOT NULL,
  sale_id uuid REFERENCES pos_sales(id) NOT NULL,
  outlet_id uuid REFERENCES pos_outlets(id) NOT NULL,
  return_number text NOT NULL,
  reason text,
  refund_method text DEFAULT 'cash' CHECK (refund_method IN ('cash','store_credit')),
  total_refund numeric(15,2) NOT NULL DEFAULT 0,
  restock boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pos_sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid REFERENCES pos_sale_returns(id) ON DELETE CASCADE NOT NULL,
  sale_item_id uuid REFERENCES pos_sale_items(id) NOT NULL,
  product_id uuid REFERENCES pos_products(id),
  product_name text NOT NULL,
  qty numeric(15,3) NOT NULL,
  price numeric(15,2) NOT NULL,
  subtotal numeric(15,2) NOT NULL
);

-- RLS Policies
ALTER TABLE pos_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_held_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_return_items ENABLE ROW LEVEL SECURITY;

-- Tenant owner can manage their own tenant
CREATE POLICY "tenant_owner_all" ON pos_tenants FOR ALL USING (user_id = auth.uid());

-- Users within a tenant can access tenant data
CREATE POLICY "tenant_users_select_outlets" ON pos_outlets FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_outlets" ON pos_outlets FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_categories" ON pos_categories FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_categories" ON pos_categories FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_brands" ON pos_brands FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_brands" ON pos_brands FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_products" ON pos_products FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_products" ON pos_products FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_variants" ON pos_product_variants FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_variants" ON pos_product_variants FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_stock" ON pos_stock FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_stock" ON pos_stock FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_mutations" ON pos_stock_mutations FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_mutations" ON pos_stock_mutations FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_customers" ON pos_customers FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_customers" ON pos_customers FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_suppliers" ON pos_suppliers FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_suppliers" ON pos_suppliers FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_sales" ON pos_sales FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_owner_manage_sales" ON pos_sales FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_sale_items" ON pos_sale_items FOR SELECT USING (
  sale_id IN (SELECT id FROM pos_sales WHERE tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid()))
);
CREATE POLICY "tenant_owner_manage_sale_items" ON pos_sale_items FOR ALL USING (
  sale_id IN (SELECT id FROM pos_sales WHERE tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid()))
);

CREATE POLICY "tenant_owner_manage_held_bills" ON pos_held_bills FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_users_select_held_bills" ON pos_held_bills FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM pos_users WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "tenant_users_select_pos_users" ON pos_users FOR SELECT USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "tenant_owner_manage_pos_users" ON pos_users FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);

CREATE POLICY "tenant_owner_manage_returns" ON pos_sale_returns FOR ALL USING (
  tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid())
);
CREATE POLICY "tenant_owner_manage_return_items" ON pos_sale_return_items FOR ALL USING (
  return_id IN (SELECT id FROM pos_sale_returns WHERE tenant_id IN (SELECT id FROM pos_tenants WHERE user_id = auth.uid()))
);

-- Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_pos_products_tenant ON pos_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_category ON pos_products(category_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_product_outlet ON pos_stock(product_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_tenant_created ON pos_sales(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_outlet ON pos_sales(outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_mutations_product ON pos_stock_mutations(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_customers_tenant ON pos_customers(tenant_id);
