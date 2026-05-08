export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  costPrice: number;
  unit: string;
  qty: number;
  discount: number;
  taxRate: number;
  notes: string;
}

export interface HeldBill {
  id: string;
  label: string;
  customer_name: string | null;
  items: CartItem[];
  discount_amount: number;
  notes: string;
  customer_id?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  is_member: boolean;
  loyalty_points?: number;
  loyalty_tier?: string;
}

export interface LoyaltyProgram {
  id: string;
  is_active: boolean;
  earn_per_rupiah: number;
  redeem_rate: number;
  min_redeem_points: number;
  max_redeem_percent: number;
  tiers: { name: string; min_points: number; discount_percent: number; color: string }[];
}

export interface Promotion {
  id: string;
  name: string;
  type: string;
  discount_percent: number;
  discount_amount: number;
  min_purchase: number;
  max_discount: number | null;
  buy_qty: number;
  get_qty: number;
  bundle_price: number | null;
  happy_hour_start: string | null;
  happy_hour_end: string | null;
  happy_hour_days: number[];
  applies_to: string;
}

export interface Voucher {
  id: string;
  code: string;
  name: string;
  type: string;
  discount_percent: number;
  discount_amount: number;
  min_purchase: number;
  max_discount: number | null;
  per_customer_limit: number;
  used_count: number;
  usage_limit: number | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost_price: number;
  unit: string;
  tax_rate: number;
  is_stock_tracked: boolean;
  has_variants: boolean;
  image_url: string | null;
  is_active: boolean;
  pos_categories?: { name: string } | null;
  pos_stock?: { quantity: number }[];
}

export interface Variant {
  id: string;
  name: string;
  price: number | null;
  cost_price: number | null;
  is_active: boolean;
}
