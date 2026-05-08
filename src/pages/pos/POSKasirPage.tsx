import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPrinter, printReceiptBrowser, ThermalPrinter } from '@/lib/thermalPrinter';
import type { ReceiptData } from '@/lib/thermalPrinter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, User, Banknote, QrCode,
  CreditCard, Printer, PauseCircle, PlayCircle, Barcode,
  X, CheckCircle2, Package, ChevronLeft, Tag, Receipt,
  Star, Ticket, Gift, Crown, Award, Percent, ChevronDown
} from 'lucide-react';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { cn } from '@/lib/utils';

// ============================================================
// INTERFACES
// ============================================================
interface Product {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; cost_price: number; unit: string; tax_rate: number;
  is_stock_tracked: boolean; has_variants: boolean; image_url: string | null;
  is_active: boolean;
  pos_categories?: { name: string } | null;
  pos_stock?: { quantity: number }[];
}

interface Variant { id: string; name: string; price: number | null; cost_price: number | null; is_active: boolean; }

interface CartItem {
  productId: string; variantId?: string; name: string; variantName?: string;
  price: number; costPrice: number; unit: string; qty: number;
  discount: number; taxRate: number; notes: string;
}

interface HeldBill {
  id: string; label: string; customer_name: string | null;
  items: CartItem[]; discount_amount: number; notes: string;
  customer_id?: string | null;
}

interface Customer {
  id: string; name: string; phone: string | null; is_member: boolean;
  loyalty_points?: number; loyalty_tier?: string;
}

interface LoyaltyProgram {
  id: string; is_active: boolean;
  earn_per_rupiah: number; redeem_rate: number;
  min_redeem_points: number; max_redeem_percent: number;
  tiers: { name: string; min_points: number; discount_percent: number; color: string }[];
}

interface Promotion {
  id: string; name: string; type: string;
  discount_percent: number; discount_amount: number;
  min_purchase: number; max_discount: number | null;
  buy_qty: number; get_qty: number;
  bundle_price: number | null;
  happy_hour_start: string | null; happy_hour_end: string | null;
  happy_hour_days: number[];
  applies_to: string;
}

interface Voucher {
  id: string; code: string; name: string; type: string;
  discount_percent: number; discount_amount: number;
  min_purchase: number; max_discount: number | null;
  per_customer_limit: number; used_count: number; usage_limit: number | null;
}

const TIER_COLORS: Record<string, string> = {
  Bronze: '#92400e', Silver: '#6b7280', Gold: '#d97706', Platinum: '#7c3aed',
};

const paymentMethods = [
  { value: 'cash',     label: 'Tunai',    icon: <Banknote  className="h-4 w-4" /> },
  { value: 'qris',     label: 'QRIS',     icon: <QrCode    className="h-4 w-4" /> },
  { value: 'transfer', label: 'Transfer', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'debit',    label: 'Debit',    icon: <CreditCard className="h-4 w-4" /> },
];

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export default function POSKasirPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const { user } = useAuth();
  const navigate = useNavigate();

  // — Produk & UI —
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // — Cart —
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0); // diskon manual (global)
  const [notes, setNotes] = useState('');

  // — Customer —
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // — Loyalty —
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [customerTier, setCustomerTier] = useState('Bronze');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // — Promosi & Voucher —
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherError, setVoucherError] = useState('');
  const [promoVoucherOpen, setPromoVoucherOpen] = useState(false);

  // — Printer —
  const [thermalConnected, setThermalConnected] = useState(false);
  const [thermalConnecting, setThermalConnecting] = useState(false);

  // — Pembayaran —
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitMethod2, setSplitMethod2] = useState('transfer');
  const [splitAmount1, setSplitAmount1] = useState('');
  const [splitAmount2, setSplitAmount2] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  // — Hold Bill —
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [heldBillsDialog, setHeldBillsDialog] = useState(false);

  // — Varian —
  const [variantDialog, setVariantDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);

  // ============================================================
  // FETCH DATA
  // ============================================================
  useEffect(() => {
    if (tenant && activeOutlet) {
      fetchProducts();
      fetchCategories();
      fetchHeldBills();
    }
  }, [tenant, activeOutlet]);

  useEffect(() => {
    if (tenant) {
      fetchLoyaltyProgram();
      fetchActivePromos();
    }
  }, [tenant]);

  // Ambil poin pelanggan ketika customer dipilih
  useEffect(() => {
    if (selectedCustomer && tenant) {
      fetchCustomerPoints(selectedCustomer.id);
    } else {
      setCustomerPoints(0);
      setCustomerTier('Bronze');
      setUsePoints(false);
      setPointsToRedeem(0);
    }
    // Reset voucher saat ganti customer
    setAppliedVoucher(null);
    setVoucherDiscount(0);
    setVoucherCode('');
    setVoucherError('');
  }, [selectedCustomer]);

  // Hitung ulang diskon promosi saat cart berubah
  useEffect(() => {
    if (appliedPromo) {
      const pd = calcPromoDiscount(appliedPromo);
      setPromoDiscount(pd);
    } else {
      autoApplyBestPromo();
    }
  }, [cart, appliedPromo]);

  const fetchProducts = async () => {
    if (!tenant || !activeOutlet) return;
    const { data } = await supabase
      .from('pos_products' as any)
      .select('*, pos_categories(name), pos_stock(quantity)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('name');
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('pos_categories' as any).select('id, name')
      .eq('tenant_id', tenant.id).order('name');
    setCategories((data || []) as unknown as { id: string; name: string }[]);
  };

  const fetchHeldBills = async () => {
    if (!tenant || !activeOutlet || !user) return;
    const { data } = await supabase
      .from('pos_held_bills' as any).select('*')
      .eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id)
      .eq('cashier_id', user.id).order('created_at');
    setHeldBills((data || []).map((h: any) => ({ ...h, items: h.items || [] })));
  };

  const fetchLoyaltyProgram = async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('pos_loyalty_programs' as any).select('*')
      .eq('tenant_id', tenant.id).eq('is_active', true).maybeSingle();
    setLoyaltyProgram(data as unknown as LoyaltyProgram | null);
  };

  const fetchActivePromos = async () => {
    if (!tenant) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('pos_promotions' as any).select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);
    setActivePromos((data || []) as unknown as Promotion[]);
  };

  const fetchCustomerPoints = async (customerId: string) => {
    if (!tenant) return;
    const { data } = await supabase
      .from('pos_customers' as any).select('loyalty_points, loyalty_tier')
      .eq('id', customerId).eq('tenant_id', tenant.id).maybeSingle();
    if (data) {
      setCustomerPoints((data as any).loyalty_points || 0);
      setCustomerTier((data as any).loyalty_tier || 'Bronze');
    }
  };

  // ============================================================
  // KALKULASI HARGA
  // ============================================================
  const subtotal = cart.reduce((s, i) => s + (i.price * i.qty - i.discount), 0);
  const taxAmount = cart.reduce((s, i) => s + ((i.price * i.qty - i.discount) * i.taxRate / 100), 0);

  // Hitung diskon poin yang bisa digunakan
  const maxPointsDiscount = loyaltyProgram && selectedCustomer
    ? Math.min(
        Math.floor(customerPoints / loyaltyProgram.redeem_rate),                    // nilai maks dari saldo poin
        Math.floor((subtotal + taxAmount) * loyaltyProgram.max_redeem_percent / 100) // maks % dari subtotal
      )
    : 0;

  const pointsDiscount = usePoints && loyaltyProgram
    ? Math.min(
        Math.floor(pointsToRedeem / loyaltyProgram.redeem_rate),
        maxPointsDiscount
      )
    : 0;

  const totalBeforePoints = Math.max(0, subtotal + taxAmount - discount - promoDiscount - voucherDiscount);
  const total = Math.max(0, totalBeforePoints - pointsDiscount);

  // Poin yang akan diperoleh dari transaksi ini
  const pointsEarned = loyaltyProgram && selectedCustomer
    ? Math.floor(total / loyaltyProgram.earn_per_rupiah)
    : 0;

  const change = paymentMethod === 'cash' ? Math.max(0, (Number(paymentAmount) || 0) - total) : 0;

  // ============================================================
  // KALKULASI PROMOSI
  // ============================================================
  function calcPromoDiscount(promo: Promotion): number {
    if (subtotal < promo.min_purchase) return 0;

    const now = new Date();
    if (promo.type === 'happy_hour') {
      if (!promo.happy_hour_start || !promo.happy_hour_end) return 0;
      const day = now.getDay();
      if (!(promo.happy_hour_days || []).includes(day)) return 0;
      const [sh, sm] = promo.happy_hour_start.split(':').map(Number);
      const [eh, em] = promo.happy_hour_end.split(':').map(Number);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (nowMin < startMin || nowMin > endMin) return 0;
      const disc = subtotal * promo.discount_percent / 100;
      return promo.max_discount ? Math.min(disc, promo.max_discount) : disc;
    }
    if (promo.type === 'discount_percent') {
      const disc = subtotal * promo.discount_percent / 100;
      return promo.max_discount ? Math.min(disc, promo.max_discount) : disc;
    }
    if (promo.type === 'discount_amount') {
      return Math.min(promo.discount_amount, subtotal);
    }
    if (promo.type === 'bundle' && promo.bundle_price !== null) {
      return Math.max(0, subtotal - promo.bundle_price);
    }
    return 0;
  }

  // Auto-apply promosi terbaik (discount terbesar yang berlaku)
  function autoApplyBestPromo() {
    if (activePromos.length === 0 || subtotal === 0) {
      setPromoDiscount(0);
      setAppliedPromo(null);
      return;
    }
    let best: Promotion | null = null;
    let bestDisc = 0;
    for (const p of activePromos) {
      const d = calcPromoDiscount(p);
      if (d > bestDisc) { bestDisc = d; best = p; }
    }
    setAppliedPromo(best);
    setPromoDiscount(bestDisc);
  }

  // ============================================================
  // VOUCHER
  // ============================================================
  const applyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code || !tenant) return;
    setVoucherError('');
    const { data } = await supabase
      .from('pos_vouchers' as any).select('*')
      .eq('tenant_id', tenant.id).eq('code', code).eq('is_active', true).maybeSingle();

    if (!data) { setVoucherError('Kode voucher tidak valid atau tidak aktif'); return; }
    const v = data as unknown as Voucher;

    const now = new Date();
    if ((v as any).start_date && now < new Date((v as any).start_date)) {
      setVoucherError('Voucher belum berlaku'); return;
    }
    if ((v as any).end_date && now > new Date((v as any).end_date)) {
      setVoucherError('Voucher sudah kedaluwarsa'); return;
    }
    if (v.usage_limit && v.used_count >= v.usage_limit) {
      setVoucherError('Voucher sudah habis'); return;
    }
    if (subtotal < v.min_purchase) {
      setVoucherError(`Min. pembelian ${formatCurrency(v.min_purchase)}`); return;
    }

    let disc = 0;
    if (v.type === 'discount_percent') {
      disc = subtotal * v.discount_percent / 100;
      if (v.max_discount) disc = Math.min(disc, v.max_discount);
    } else {
      disc = Math.min(v.discount_amount, subtotal);
    }
    setAppliedVoucher(v);
    setVoucherDiscount(disc);
    toast.success(`Voucher "${v.name}" berhasil diterapkan! Diskon ${formatCurrency(disc)}`);
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherDiscount(0);
    setVoucherCode('');
    setVoucherError('');
  };

  // ============================================================
  // LOYALTY — POIN
  // ============================================================
  const handleTogglePoints = (checked: boolean) => {
    setUsePoints(checked);
    if (checked && loyaltyProgram) {
      // Default: tukarkan semua poin sampai batas maksimum
      const maxPtsUsable = Math.min(
        customerPoints,
        loyaltyProgram.min_redeem_points <= customerPoints ? customerPoints : 0
      );
      setPointsToRedeem(maxPtsUsable);
    } else {
      setPointsToRedeem(0);
    }
  };

  const handlePointsInput = (val: string) => {
    if (!loyaltyProgram) return;
    let pts = parseInt(val) || 0;
    pts = Math.max(loyaltyProgram.min_redeem_points, Math.min(pts, customerPoints));
    setPointsToRedeem(pts);
  };

  // ============================================================
  // CART ACTIONS
  // ============================================================
  const addToCart = async (product: Product, variantId?: string, variantName?: string, variantPrice?: number) => {
    if (product.has_variants && !variantId) {
      const { data } = await supabase.from('pos_product_variants' as any)
        .select('*').eq('product_id', product.id).eq('is_active', true);
      setVariants((data || []) as unknown as Variant[]);
      setSelectedProduct(product);
      setVariantDialog(true);
      return;
    }
    const price = variantPrice ?? product.price;
    const existingIdx = cart.findIndex(c => c.productId === product.id && c.variantId === variantId);
    if (existingIdx >= 0) {
      const newCart = [...cart];
      newCart[existingIdx].qty += 1;
      setCart(newCart);
    } else {
      setCart(prev => [...prev, {
        productId: product.id, variantId, name: product.name, variantName,
        price, costPrice: product.cost_price, unit: product.unit,
        qty: 1, discount: 0, taxRate: product.tax_rate, notes: '',
      }]);
    }
    setSearch('');
  };

  const updateQty = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx].qty = Math.max(0.5, newCart[idx].qty + delta);
    if (newCart[idx].qty <= 0) newCart.splice(idx, 1);
    setCart(newCart);
  };

  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const updateItemDiscount = (idx: number, val: number) => {
    const newCart = [...cart];
    newCart[idx].discount = Math.min(val, newCart[idx].price * newCart[idx].qty);
    setCart(newCart);
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setAppliedPromo(null);
    setPromoDiscount(0);
    setAppliedVoucher(null);
    setVoucherDiscount(0);
    setVoucherCode('');
    setUsePoints(false);
    setPointsToRedeem(0);
  };

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'F2') { e.preventDefault(); openPayment(); }
      if (e.key === 'F3') { e.preventDefault(); holdBill(); }
      if (e.key === 'F8') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart, discount, notes, selectedCustomer, customerName, paymentMethod, paymentAmount]);

  // ============================================================
  // CUSTOMER SEARCH
  // ============================================================
  const searchCustomers = async (q: string) => {
    if (!tenant || !q) { setCustomers([]); return; }
    const { data } = await supabase
      .from('pos_customers' as any)
      .select('id, name, phone, is_member, loyalty_points, loyalty_tier')
      .eq('tenant_id', tenant.id)
      .ilike('name', `%${q}%`)
      .limit(6);
    setCustomers((data || []) as unknown as Customer[]);
  };

  // ============================================================
  // PROSES PEMBAYARAN
  // ============================================================
  const openPayment = () => {
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }
    setPaymentAmount(String(total));
    setPaymentDialog(true);
  };

  const processPayment = async () => {
    if (!tenant || !activeOutlet || !user) return;
    if (isSplitPayment) {
      const a1 = Number(splitAmount1) || 0;
      const a2 = Number(splitAmount2) || 0;
      if (a1 + a2 < total) { toast.error('Total bayar kurang dari total transaksi'); return; }
    } else if (paymentMethod === 'cash' && (Number(paymentAmount) || 0) < total) {
      toast.error('Jumlah bayar kurang dari total'); return;
    }
    // Validasi poin minimum
    if (usePoints && loyaltyProgram && pointsToRedeem < loyaltyProgram.min_redeem_points) {
      toast.error(`Min. tukar ${loyaltyProgram.min_redeem_points} poin`); return;
    }

    try {
      const saleNumber = `TRX-${Date.now()}`;

      // Simpan transaksi
      const { data: sale, error } = await supabase.from('pos_sales' as any).insert({
        tenant_id: tenant.id, outlet_id: activeOutlet.id, sale_number: saleNumber,
        cashier_id: user.id, cashier_name: user.email,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || customerName || null,
        subtotal,
        discount_amount: discount,
        tax_amount: taxAmount,
        total,
        payment_method: isSplitPayment ? `split:${paymentMethod}+${splitMethod2}` : paymentMethod,
        payment_amount: isSplitPayment ? (Number(splitAmount1) + Number(splitAmount2)) : (Number(paymentAmount) || total),
        change_amount: isSplitPayment ? Math.max(0, (Number(splitAmount1) + Number(splitAmount2)) - total) : change,
        status: 'completed',
        notes: notes || null,
        // Kolom loyalty & promo (Phase 5)
        promotion_id: appliedPromo?.id || null,
        promotion_discount: promoDiscount,
        voucher_id: appliedVoucher?.id || null,
        voucher_code: appliedVoucher?.code || null,
        voucher_discount: voucherDiscount,
        loyalty_points_earned: pointsEarned,
        loyalty_points_redeemed: usePoints ? pointsToRedeem : 0,
        loyalty_discount: pointsDiscount,
      }).select().single();
      if (error) throw error;

      const saleId = (sale as any).id;

      // Simpan item
      await supabase.from('pos_sale_items' as any).insert(
        cart.map(item => ({
          sale_id: saleId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          product_name: item.name,
          variant_name: item.variantName || null,
          qty: item.qty,
          price: item.price,
          cost_price: item.costPrice,
          discount: item.discount,
          tax_amount: (item.price * item.qty - item.discount) * item.taxRate / 100,
          subtotal: item.price * item.qty - item.discount,
        }))
      );

      // Update stok
      for (const item of cart) {
        if (item.variantId) {
          const { data: stockD } = await supabase.from('pos_stock' as any).select('id, quantity')
            .eq('product_id', item.productId).eq('variant_id', item.variantId)
            .eq('outlet_id', activeOutlet.id).single();
          if (stockD) {
            await supabase.from('pos_stock' as any)
              .update({ quantity: Math.max(0, (stockD as any).quantity - item.qty) })
              .eq('id', (stockD as any).id);
          }
        } else {
          const { data: stockD } = await supabase.from('pos_stock' as any).select('id, quantity')
            .eq('product_id', item.productId).eq('outlet_id', activeOutlet.id)
            .is('variant_id', null).single();
          if (stockD) {
            const newQty = Math.max(0, (stockD as any).quantity - item.qty);
            await supabase.from('pos_stock' as any).update({ quantity: newQty }).eq('id', (stockD as any).id);
            await supabase.from('pos_stock_mutations' as any).insert({
              tenant_id: tenant.id, product_id: item.productId, outlet_id: activeOutlet.id,
              type: 'sale', quantity: -item.qty,
              quantity_before: (stockD as any).quantity, quantity_after: newQty,
              reference_id: saleId, reference_type: 'pos_sale', created_by: user.id,
            });
          }
        }
      }

      // Update statistik & poin pelanggan
      if (selectedCustomer) {
        const { data: cust } = await supabase
          .from('pos_customers' as any)
          .select('total_purchase, transaction_count, loyalty_points')
          .eq('id', selectedCustomer.id).single();

        if (cust) {
          const currentPts = (cust as any).loyalty_points || 0;
          const newPts = Math.max(0, currentPts - (usePoints ? pointsToRedeem : 0) + pointsEarned);

          // Tentukan tier baru berdasarkan total poin kumulatif
          let newTier = 'Bronze';
          if (loyaltyProgram) {
            const allTimePoints = newPts;
            const tiers = [...loyaltyProgram.tiers].sort((a, b) => b.min_points - a.min_points);
            for (const t of tiers) {
              if (allTimePoints >= t.min_points) { newTier = t.name; break; }
            }
          }

          await supabase.from('pos_customers' as any).update({
            total_purchase: ((cust as any).total_purchase || 0) + total,
            transaction_count: ((cust as any).transaction_count || 0) + 1,
            last_purchase_at: new Date().toISOString(),
            loyalty_points: newPts,
            loyalty_tier: newTier,
          }).eq('id', selectedCustomer.id);
        }
      }

      // Update voucher used_count
      if (appliedVoucher) {
        await supabase.from('pos_vouchers' as any)
          .update({ used_count: (appliedVoucher.used_count || 0) + 1 })
          .eq('id', appliedVoucher.id);
        await supabase.from('pos_voucher_usages' as any).insert({
          voucher_id: appliedVoucher.id,
          sale_id: saleId,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || customerName || null,
          discount_given: voucherDiscount,
        });
      }

      // Update promosi used_count
      if (appliedPromo && promoDiscount > 0) {
        await supabase.from('pos_promotions' as any)
          .update({ used_count: (appliedPromo as any).used_count + 1 })
          .eq('id', appliedPromo.id);
      }

      // Simpan di lastSale untuk success dialog
      setLastSale({
        saleNumber, total, change, paymentMethod,
        customerName: selectedCustomer?.name || customerName || 'Umum',
        items: [...cart],
        pointsEarned,
        pointsRedeemed: usePoints ? pointsToRedeem : 0,
        pointsDiscount,
        promoDiscount,
        voucherDiscount,
        appliedPromoName: appliedPromo?.name || null,
        appliedVoucherCode: appliedVoucher?.code || null,
        newPointsBalance: selectedCustomer
          ? Math.max(0, customerPoints - (usePoints ? pointsToRedeem : 0) + pointsEarned)
          : null,
      });

      // Reset state
      clearCart();
      setNotes('');
      setSelectedCustomer(null);
      setCustomerName('');
      setPaymentAmount('');
      setPaymentDialog(false);
      setSuccessDialog(true);
      fetchProducts();

    } catch (err: any) {
      toast.error('Gagal memproses transaksi: ' + err.message);
    }
  };

  // ============================================================
  // HOLD BILL
  // ============================================================
  const holdBill = async () => {
    if (!tenant || !activeOutlet || !user || cart.length === 0) return;
    await supabase.from('pos_held_bills' as any).insert({
      tenant_id: tenant.id, outlet_id: activeOutlet.id, cashier_id: user.id,
      label: `Bill ${heldBills.length + 1}`,
      customer_name: selectedCustomer?.name || customerName || null,
      customer_id: selectedCustomer?.id || null,
      items: cart, discount_amount: discount, notes,
    });
    clearCart();
    setNotes('');
    setSelectedCustomer(null);
    setCustomerName('');
    await fetchHeldBills();
    toast.success('Transaksi ditahan');
  };

  const resumeBill = async (bill: HeldBill) => {
    setCart(bill.items);
    setDiscount(bill.discount_amount);
    setNotes(bill.notes);
    setCustomerName(bill.customer_name || '');
    await supabase.from('pos_held_bills' as any).delete().eq('id', bill.id);
    await fetchHeldBills();
    setHeldBillsDialog(false);
    toast.success('Transaksi dilanjutkan');
  };

  // ============================================================
  // FILTER PRODUK
  // ============================================================
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));
    const matchCat = filterCat === 'all' ||
      (p as any).category_id === filterCat;
    return matchSearch && matchCat;
  });

  const onBarcodeDetect = useCallback((barcode: string) => {
    const match = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (match) {
      addToCart(match);
      toast.success(`✓ ${match.name} ditambahkan`);
    } else {
      setSearch(barcode);
      setScannerOpen(false);
      toast.info(`Barcode "${barcode}" — pilih produk secara manual`);
    }
  }, [products]);

  // S2-01: Thermal Printer (Web Serial API) + fallback ke browser print
  const connectThermalPrinter = async () => {
    if (!ThermalPrinter.isSupported()) {
      toast.error('Browser tidak mendukung Web Serial API. Gunakan Chrome atau Edge terbaru.');
      return;
    }
    setThermalConnecting(true);
    try {
      const printer = getPrinter();
      const ok = await printer.connect();
      if (ok) {
        setThermalConnected(true);
        toast.success('Printer thermal terhubung!');
      }
    } catch (err: any) {
      toast.error('Gagal menghubungkan printer: ' + (err.message || 'Coba lagi'));
    } finally {
      setThermalConnecting(false);
    }
  };

  const printReceipt = async () => {
    if (!lastSale) return;
    const settings = tenant;
    const receiptData: ReceiptData = {
      storeName: (settings as any)?.name || 'Toko',
      storeAddress: (settings as any)?.address || undefined,
      storePhone: (settings as any)?.phone || undefined,
      receiptHeader: (settings as any)?.receipt_header || undefined,
      receiptFooter: (settings as any)?.receipt_footer || undefined,
      invoiceNo: lastSale.saleNumber,
      date: new Date(),
      cashierName: user?.email || undefined,
      customerName: lastSale.customerName !== 'Umum' ? lastSale.customerName : undefined,
      items: lastSale.items.map((i: any) => ({
        name: i.variantName ? `${i.name} (${i.variantName})` : i.name,
        qty: i.qty,
        price: i.price,
        discount: i.discount || 0,
      })),
      subtotal: lastSale.subtotal ?? lastSale.total,
      discountAmount: lastSale.promoDiscount + lastSale.voucherDiscount + lastSale.pointsDiscount,
      taxAmount: lastSale.taxAmount ?? 0,
      total: lastSale.total,
      paidAmount: lastSale.paidAmount ?? lastSale.total,
      changeAmount: lastSale.change ?? 0,
      paymentMethod: lastSale.paymentMethod,
    };

    if (thermalConnected) {
      try {
        const printer = getPrinter();
        await printer.printReceipt(receiptData);
        return;
      } catch {
        toast.error('Printer thermal gagal. Beralih ke cetak browser.');
        setThermalConnected(false);
      }
    }
    await printReceiptBrowser(receiptData);
  };

  // Tier icon
  const tierIcon = (tier: string) => {
    if (tier === 'Platinum') return <Crown className="h-3 w-3" />;
    if (tier === 'Gold') return <Award className="h-3 w-3" />;
    return <Star className="h-3 w-3" />;
  };

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Buat usaha terlebih dahulu</p>
          <Button onClick={() => navigate('/pos/pengaturan')} className="bg-emerald-600 hover:bg-emerald-700">Buat Usaha</Button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transform transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <POSSidebar />
      </div>

      <div className="flex flex-1 min-w-0 overflow-hidden">

        {/* ═══════════════ PANEL PRODUK ═══════════════ */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-3 border-b bg-background space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  className="pl-9 pr-9 h-9"
                  placeholder="Cari produk / scan barcode... (F8)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                onClick={() => setScannerOpen(true)} title="Scan Barcode Kamera">
                <Barcode className="h-4 w-4 text-emerald-600" />
              </Button>
              {heldBills.length > 0 && (
                <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-shrink-0" onClick={() => setHeldBillsDialog(true)}>
                  <PauseCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs">{heldBills.length}</span>
                </Button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <Button size="sm" variant={filterCat === 'all' ? 'default' : 'outline'}
                className={cn('h-7 text-xs flex-shrink-0', filterCat === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
                onClick={() => setFilterCat('all')}>Semua</Button>
              {categories.map(c => (
                <Button key={c.id} size="sm" variant={filterCat === c.id ? 'default' : 'outline'}
                  className={cn('h-7 text-xs flex-shrink-0', filterCat === c.id ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
                  onClick={() => setFilterCat(c.id)}>{c.name}</Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[...Array(12)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Package className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{search ? 'Produk tidak ditemukan' : 'Belum ada produk'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredProducts.map(p => {
                  const stock = p.pos_stock?.[0]?.quantity ?? 0;
                  const isLowStock = p.is_stock_tracked && stock <= 5;
                  const outOfStock = p.is_stock_tracked && stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !outOfStock && addToCart(p)}
                      disabled={outOfStock}
                      className={cn(
                        'text-left p-3 rounded-xl border transition-all hover:shadow-md active:scale-[0.97]',
                        outOfStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400',
                      )}
                    >
                      <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center mb-2">
                        {p.image_url
                          ? <img src={p.image_url} className="w-full h-full object-cover rounded-lg" />
                          : <Package className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 mb-1">{p.name}</p>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.price)}</p>
                      {p.is_stock_tracked && (
                        <p className={cn('text-xs mt-0.5', isLowStock ? 'text-amber-500' : 'text-muted-foreground')}>
                          {outOfStock ? 'Habis' : `Stok: ${stock}`}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════ PANEL CART ═══════════════ */}
        <div className="w-80 xl:w-96 flex flex-col bg-card">

          {/* Header cart */}
          <div className="p-3 border-b space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-sm">Pesanan</span>
                {cart.length > 0 && <Badge className="bg-emerald-600 text-white text-xs">{cart.length}</Badge>}
              </div>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={clearCart}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Bersihkan
                </Button>
              )}
            </div>

            {/* Pilih customer */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              onClick={() => setCustomerDialog(true)}
            >
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="truncate flex-1 text-left">
                {selectedCustomer ? selectedCustomer.name : customerName || 'Pilih customer (opsional)'}
              </span>
              {selectedCustomer && loyaltyProgram && (
                <Badge
                  className="text-[10px] px-1.5 py-0 ml-auto flex-shrink-0"
                  style={{ backgroundColor: TIER_COLORS[customerTier] || '#6b7280', color: 'white' }}
                >
                  {tierIcon(customerTier)} {customerTier}
                </Badge>
              )}
            </button>

            {/* Info poin pelanggan */}
            {selectedCustomer && loyaltyProgram && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <Star className="h-3 w-3" />
                    <span className="font-medium">{customerPoints.toLocaleString('id-ID')} poin</span>
                    <span className="text-emerald-500">tersedia</span>
                  </span>
                  {customerPoints >= loyaltyProgram.min_redeem_points && cart.length > 0 && (
                    <button
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full transition-colors',
                        usePoints
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      )}
                      onClick={() => handleTogglePoints(!usePoints)}
                    >
                      {usePoints ? '✓ Pakai Poin' : 'Tukar Poin'}
                    </button>
                  )}
                </div>
                {usePoints && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-emerald-600">Tukar:</span>
                    <Input
                      type="number"
                      className="h-6 text-xs flex-1"
                      min={loyaltyProgram.min_redeem_points}
                      max={customerPoints}
                      value={pointsToRedeem}
                      onChange={e => handlePointsInput(e.target.value)}
                    />
                    <span className="text-xs text-emerald-600">poin = {formatCurrency(pointsDiscount)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Item list */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Pilih produk untuk mulai transaksi</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-background border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                        <p className="text-xs text-emerald-600">{formatCurrency(item.price)} / {item.unit}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeItem(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(idx, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{item.qty}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(idx, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <Input type="number" className="h-6 w-20 text-xs" placeholder="Diskon"
                          value={item.discount || ''}
                          onChange={e => updateItemDiscount(idx, Number(e.target.value))} />
                      </div>
                      <p className="text-sm font-bold">{formatCurrency(item.price * item.qty - item.discount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary + Actions */}
          <div className="border-t p-3 space-y-2">

            {/* Ringkasan harga */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} item)</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Pajak</span><span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {/* Diskon manual */}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" />Diskon
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Rp</span>
                  <Input type="number" className="h-7 w-24 text-xs"
                    value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              {/* Promosi */}
              {promoDiscount > 0 && appliedPromo && (
                <div className="flex justify-between text-orange-600 text-xs">
                  <span className="flex items-center gap-1">
                    <Percent className="h-3 w-3" />{appliedPromo.name}
                  </span>
                  <span>-{formatCurrency(promoDiscount)}</span>
                </div>
              )}
              {/* Voucher */}
              {voucherDiscount > 0 && appliedVoucher && (
                <div className="flex justify-between text-purple-600 text-xs">
                  <span className="flex items-center gap-1">
                    <Ticket className="h-3 w-3" />{appliedVoucher.code}
                    <button onClick={removeVoucher} className="ml-1 hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
                  </span>
                  <span>-{formatCurrency(voucherDiscount)}</span>
                </div>
              )}
              {/* Poin */}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs">
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />{pointsToRedeem.toLocaleString('id-ID')} poin
                  </span>
                  <span>-{formatCurrency(pointsDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Total</span>
                <span className="text-emerald-600">{formatCurrency(total)}</span>
              </div>
              {/* Estimasi poin yang akan diperoleh */}
              {selectedCustomer && loyaltyProgram && pointsEarned > 0 && (
                <div className="flex justify-between text-xs text-emerald-500 bg-emerald-50 rounded px-2 py-1">
                  <span className="flex items-center gap-1"><Gift className="h-3 w-3" />Poin diperoleh</span>
                  <span className="font-medium">+{pointsEarned.toLocaleString('id-ID')} poin</span>
                </div>
              )}
            </div>

            {/* Toggle promo & voucher */}
            <button
              onClick={() => setPromoVoucherOpen(p => !p)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <span className="flex items-center gap-1">
                <Ticket className="h-3.5 w-3.5" />
                {appliedVoucher ? `Voucher: ${appliedVoucher.code}` : 'Masukkan kode voucher'}
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', promoVoucherOpen && 'rotate-180')} />
            </button>
            {promoVoucherOpen && (
              <div className="space-y-1.5 px-1">
                <div className="flex gap-1.5">
                  <Input
                    className="h-8 text-xs font-mono uppercase"
                    placeholder="KODE VOUCHER"
                    value={voucherCode}
                    onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(''); }}
                    onKeyDown={e => e.key === 'Enter' && applyVoucher()}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={applyVoucher}>
                    Pakai
                  </Button>
                  {appliedVoucher && (
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive px-2" onClick={removeVoucher}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {voucherError && <p className="text-xs text-destructive">{voucherError}</p>}
                {appliedPromo && promoDiscount > 0 && (
                  <div className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 flex items-center gap-1">
                    <Percent className="h-3 w-3" />Promo aktif: {appliedPromo.name}
                  </div>
                )}
              </div>
            )}

            {/* Tombol tahan & bayar */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={holdBill} disabled={cart.length === 0} title="Tahan transaksi (F3)">
                <PauseCircle className="h-4 w-4 mr-1.5" />Tahan <span className="ml-1 text-[10px] text-muted-foreground hidden sm:inline">F3</span>
              </Button>
              <Button className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700" onClick={openPayment} disabled={cart.length === 0} title="Proses pembayaran (F2)">
                <Receipt className="h-4 w-4 mr-1.5" />Bayar <span className="ml-1 text-[10px] text-emerald-200 hidden sm:inline">F2</span>
              </Button>
            </div>

            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Catatan transaksi..." rows={1} className="text-xs resize-none" />
          </div>
        </div>
      </div>

      {/* ════════ DIALOG PEMBAYARAN ════════ */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Proses Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Ringkasan tagihan */}
            <div className="bg-muted rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {taxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Pajak</span><span>{formatCurrency(taxAmount)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Diskon manual</span><span>-{formatCurrency(discount)}</span></div>}
              {promoDiscount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span className="flex items-center gap-1"><Percent className="h-3 w-3" />{appliedPromo?.name}</span>
                  <span>-{formatCurrency(promoDiscount)}</span>
                </div>
              )}
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-purple-600">
                  <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{appliedVoucher?.code}</span>
                  <span>-{formatCurrency(voucherDiscount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" />{pointsToRedeem.toLocaleString('id-ID')} poin</span>
                  <span>-{formatCurrency(pointsDiscount)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span>Total Tagihan</span>
                <span className="text-emerald-600">{formatCurrency(total)}</span>
              </div>
              {selectedCustomer && loyaltyProgram && pointsEarned > 0 && (
                <div className="flex justify-between text-xs text-emerald-500 bg-emerald-50 rounded px-2 py-1">
                  <span className="flex items-center gap-1"><Gift className="h-3 w-3" />Poin yang akan diperoleh</span>
                  <span className="font-medium">+{pointsEarned.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* Metode pembayaran */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Metode Pembayaran</Label>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map(pm => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                      paymentMethod === pm.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'hover:border-muted-foreground/40'
                    )}>
                    {pm.icon}{pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Split Payment */}
            <div className="flex items-center justify-between py-1 border-t">
              <Label className="text-xs text-muted-foreground">Bayar dengan 2 metode (split)</Label>
              <button
                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', isSplitPayment ? 'bg-emerald-500' : 'bg-gray-300')}
                onClick={() => setIsSplitPayment(v => !v)}
              >
                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform', isSplitPayment ? 'translate-x-4' : 'translate-x-1')} />
              </button>
            </div>

            {!isSplitPayment && paymentMethod === 'cash' && (
              <div>
                <Label>Jumlah Bayar</Label>
                <Input className="mt-1 text-lg font-bold h-12" type="number"
                  value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0" autoFocus />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000]
                    .filter((v, i, arr) => arr.indexOf(v) === i && v >= total)
                    .slice(0, 4)
                    .map(v => (
                      <Button key={v} variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => setPaymentAmount(String(v))}>
                        {formatCurrency(v)}
                      </Button>
                    ))}
                </div>
                {Number(paymentAmount) >= total && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">Kembalian: <strong>{formatCurrency(change)}</strong></p>
                  </div>
                )}
              </div>
            )}

            {isSplitPayment && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">Pembayaran Split</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Metode 1</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(pm => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="mt-1 h-8 text-xs" type="number" value={splitAmount1} onChange={e => setSplitAmount1(e.target.value)} placeholder="Jumlah" />
                  </div>
                  <div>
                    <Label className="text-xs">Metode 2</Label>
                    <Select value={splitMethod2} onValueChange={setSplitMethod2}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(pm => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="mt-1 h-8 text-xs" type="number" value={splitAmount2} onChange={e => setSplitAmount2(e.target.value)} placeholder="Jumlah" />
                  </div>
                </div>
                {(Number(splitAmount1) + Number(splitAmount2)) > 0 && (
                  <div className={cn('text-xs rounded p-2', (Number(splitAmount1) + Number(splitAmount2)) >= total ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                    Total dibayar: {formatCurrency(Number(splitAmount1) + Number(splitAmount2))} / {formatCurrency(total)}
                    {(Number(splitAmount1) + Number(splitAmount2)) >= total && ` · Kembalian: ${formatCurrency((Number(splitAmount1) + Number(splitAmount2)) - total)}`}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={processPayment}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ DIALOG SUKSES ════════ */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-2">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold mb-1">Transaksi Berhasil!</h2>
            {lastSale && (
              <div className="bg-muted rounded-xl p-4 mt-3 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Transaksi</span>
                  <span className="font-mono font-bold text-xs">{lastSale.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{lastSale.customerName}</span>
                </div>
                {lastSale.promoDiscount > 0 && (
                  <div className="flex justify-between text-orange-600 text-xs">
                    <span className="flex items-center gap-1"><Percent className="h-3 w-3" />Promo</span>
                    <span>-{formatCurrency(lastSale.promoDiscount)}</span>
                  </div>
                )}
                {lastSale.voucherDiscount > 0 && (
                  <div className="flex justify-between text-purple-600 text-xs">
                    <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{lastSale.appliedVoucherCode}</span>
                    <span>-{formatCurrency(lastSale.voucherDiscount)}</span>
                  </div>
                )}
                {lastSale.pointsDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 text-xs">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3" />Poin ditukar</span>
                    <span>-{formatCurrency(lastSale.pointsDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Dibayar</span>
                  <span className="text-emerald-600">{formatCurrency(lastSale.total)}</span>
                </div>
                {lastSale.paymentMethod === 'cash' && lastSale.change > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kembalian</span>
                    <span className="font-bold">{formatCurrency(lastSale.change)}</span>
                  </div>
                )}
                {/* Ringkasan poin */}
                {lastSale.pointsEarned > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2 space-y-1">
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />Ringkasan Poin
                    </p>
                    {lastSale.pointsRedeemed > 0 && (
                      <div className="flex justify-between text-xs text-red-600">
                        <span>Ditukar</span><span>-{lastSale.pointsRedeemed.toLocaleString('id-ID')} poin</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Diperoleh</span><span>+{lastSale.pointsEarned.toLocaleString('id-ID')} poin</span>
                    </div>
                    {lastSale.newPointsBalance !== null && (
                      <div className="flex justify-between text-xs font-bold text-emerald-700 border-t pt-1">
                        <span>Saldo Poin</span><span>{lastSale.newPointsBalance.toLocaleString('id-ID')} poin</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-2" />Cetak Struk
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { setSuccessDialog(false); searchRef.current?.focus(); }}>
                Transaksi Baru
              </Button>
            </div>
            {ThermalPrinter.isSupported() && (
              <Button
                variant="ghost"
                size="sm"
                className={`w-full mt-1 text-xs ${thermalConnected ? 'text-emerald-600' : 'text-muted-foreground'}`}
                onClick={connectThermalPrinter}
                disabled={thermalConnecting}
              >
                <Printer className="h-3 w-3 mr-1.5" />
                {thermalConnected ? '● Printer Thermal Terhubung' : thermalConnecting ? 'Menghubungkan...' : 'Hubungkan Printer Thermal (ESC/POS)'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════ DIALOG HELD BILLS ════════ */}
      <Dialog open={heldBillsDialog} onOpenChange={setHeldBillsDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transaksi Tertahan ({heldBills.length})</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {heldBills.map(bill => (
              <div key={bill.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{bill.label}</p>
                  {bill.customer_name && <p className="text-xs text-muted-foreground">{bill.customer_name}</p>}
                  <p className="text-xs text-muted-foreground">{bill.items.length} item</p>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => resumeBill(bill)}>
                  <PlayCircle className="h-4 w-4 mr-1.5" />Lanjutkan
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════ DIALOG VARIAN ════════ */}
      <Dialog open={variantDialog} onOpenChange={setVariantDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih Varian — {selectedProduct?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {variants.map(v => (
              <button key={v.id} className="p-3 border rounded-lg text-left hover:border-emerald-400 transition-colors"
                onClick={() => { addToCart(selectedProduct!, v.id, v.name, v.price ?? selectedProduct?.price); setVariantDialog(false); }}>
                <p className="font-medium text-sm">{v.name}</p>
                <p className="text-emerald-600 text-sm">{formatCurrency(v.price ?? selectedProduct?.price ?? 0)}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════ DIALOG CUSTOMER ════════ */}
      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Cari nama customer..."
              value={customerSearch || customerName}
              onChange={e => {
                const v = e.target.value;
                setCustomerName(v);
                setCustomerSearch(v);
                searchCustomers(v);
              }}
              autoFocus
            />
            {customers.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {customers.map(c => (
                  <button key={c.id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerName('');
                      setCustomerSearch('');
                      setCustomerDialog(false);
                    }}>
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                      c.is_member ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                    )}>
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.is_member && (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Member</Badge>
                      )}
                      {loyaltyProgram && (c.loyalty_points || 0) > 0 && (
                        <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5" />{(c.loyalty_points || 0).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                <div>
                  <span className="text-sm font-medium">{selectedCustomer.name}</span>
                  {loyaltyProgram && (
                    <span className="ml-2 text-xs text-emerald-600">
                      {customerPoints.toLocaleString('id-ID')} poin
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                  onClick={() => { setSelectedCustomer(null); setCustomerName(''); }}>
                  Hapus
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setCustomerDialog(false)}>Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ BARCODE SCANNER ════════ */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetect={onBarcodeDetect}
      />
    </div>
  );
}
