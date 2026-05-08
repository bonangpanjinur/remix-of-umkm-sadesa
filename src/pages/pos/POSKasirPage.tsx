import { useState, useEffect, useRef, useCallback } from 'react';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPrinter, printReceiptBrowser, ThermalPrinter } from '@/lib/thermalPrinter';
import type { ReceiptData } from '@/lib/thermalPrinter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ChevronLeft, Barcode, CheckCircle2, Star, Ticket, Percent, Printer, Gift, MessageCircle, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { POSCart } from '@/components/pos/kasir/POSCart';
import { POSPaymentDialog } from '@/components/pos/kasir/POSPaymentDialog';
import { POSHeldBills } from '@/components/pos/kasir/POSHeldBills';
import { cn } from '@/lib/utils';
import type {
  CartItem, HeldBill, Customer, LoyaltyProgram,
  Promotion, Voucher, Product, Variant,
} from '@/components/pos/kasir/types';

export default function POSKasirPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const { user } = useAuth();
  const navigate = useNavigate();

  // UI
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Loyalty
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [customerTier, setCustomerTier] = useState('Bronze');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Promo & Voucher
  const [activePromos, setActivePromos] = useState<Promotion[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherError, setVoucherError] = useState('');

  // Printer
  const [thermalConnected, setThermalConnected] = useState(false);
  const [thermalConnecting, setThermalConnecting] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitMethod2, setSplitMethod2] = useState('transfer');
  const [splitAmount1, setSplitAmount1] = useState('');
  const [splitAmount2, setSplitAmount2] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  // Hold Bill
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [heldBillsDialog, setHeldBillsDialog] = useState(false);

  // Variant
  const [variantDialog, setVariantDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);

  // ── Kalkulasi ────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + (i.price * i.qty - i.discount), 0);
  const taxAmount = cart.reduce((s, i) => s + ((i.price * i.qty - i.discount) * i.taxRate / 100), 0);
  const maxPointsDiscount = loyaltyProgram && selectedCustomer
    ? Math.min(
        Math.floor(customerPoints / loyaltyProgram.redeem_rate),
        Math.floor((subtotal + taxAmount) * loyaltyProgram.max_redeem_percent / 100)
      )
    : 0;
  const pointsDiscount = usePoints && loyaltyProgram
    ? Math.min(Math.floor(pointsToRedeem / loyaltyProgram.redeem_rate), maxPointsDiscount)
    : 0;
  const total = Math.max(0, subtotal + taxAmount - discount - promoDiscount - voucherDiscount - pointsDiscount);
  const pointsEarned = loyaltyProgram && selectedCustomer ? Math.floor(total / loyaltyProgram.earn_per_rupiah) : 0;
  const change = paymentMethod === 'cash' ? Math.max(0, (Number(paymentAmount) || 0) - total) : 0;

  // ── Fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (tenant && activeOutlet) { fetchProducts(); fetchCategories(); fetchHeldBills(); }
  }, [tenant, activeOutlet]);

  useEffect(() => {
    if (tenant) { fetchLoyaltyProgram(); fetchActivePromos(); }
  }, [tenant]);

  useEffect(() => {
    if (selectedCustomer && tenant) fetchCustomerPoints(selectedCustomer.id);
    else { setCustomerPoints(0); setCustomerTier('Bronze'); setUsePoints(false); setPointsToRedeem(0); }
    setAppliedVoucher(null); setVoucherDiscount(0); setVoucherCode(''); setVoucherError('');
  }, [selectedCustomer]);

  useEffect(() => {
    if (appliedPromo) setPromoDiscount(calcPromoDiscount(appliedPromo));
    else autoApplyBestPromo();
  }, [cart, appliedPromo]);

  const fetchProducts = async () => {
    if (!tenant || !activeOutlet) return;
    const { data } = await supabase.from('pos_products' as any)
      .select('*, pos_categories(name), pos_stock(quantity)')
      .eq('tenant_id', tenant.id).eq('is_active', true).order('name');
    setProducts((data || []) as unknown as Product[]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_categories' as any).select('id, name')
      .eq('tenant_id', tenant.id).order('name');
    setCategories((data || []) as unknown as { id: string; name: string }[]);
  };

  const fetchHeldBills = async () => {
    if (!tenant || !activeOutlet || !user) return;
    const { data } = await supabase.from('pos_held_bills' as any).select('*')
      .eq('tenant_id', tenant.id).eq('outlet_id', activeOutlet.id)
      .eq('cashier_id', user.id).order('created_at');
    setHeldBills((data || []).map((h: any) => ({ ...h, items: h.items || [] })));
  };

  const fetchLoyaltyProgram = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_loyalty_programs' as any).select('*')
      .eq('tenant_id', tenant.id).eq('is_active', true).maybeSingle();
    setLoyaltyProgram(data as unknown as LoyaltyProgram | null);
  };

  const fetchActivePromos = async () => {
    if (!tenant) return;
    const now = new Date().toISOString();
    const { data } = await supabase.from('pos_promotions' as any).select('*')
      .eq('tenant_id', tenant.id).eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`);
    setActivePromos((data || []) as unknown as Promotion[]);
  };

  const fetchCustomerPoints = async (customerId: string) => {
    if (!tenant) return;
    const { data } = await supabase.from('pos_customers' as any)
      .select('loyalty_points, loyalty_tier').eq('id', customerId).eq('tenant_id', tenant.id).maybeSingle();
    if (data) { setCustomerPoints((data as any).loyalty_points || 0); setCustomerTier((data as any).loyalty_tier || 'Bronze'); }
  };

  // ── Promosi ──────────────────────────────────────────────
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
      if (nowMin < sh * 60 + sm || nowMin > eh * 60 + em) return 0;
      const disc = subtotal * promo.discount_percent / 100;
      return promo.max_discount ? Math.min(disc, promo.max_discount) : disc;
    }
    if (promo.type === 'discount_percent') {
      const disc = subtotal * promo.discount_percent / 100;
      return promo.max_discount ? Math.min(disc, promo.max_discount) : disc;
    }
    if (promo.type === 'discount_amount') return Math.min(promo.discount_amount, subtotal);
    if (promo.type === 'bundle' && promo.bundle_price !== null) return Math.max(0, subtotal - promo.bundle_price);
    return 0;
  }

  function autoApplyBestPromo() {
    if (activePromos.length === 0 || subtotal === 0) { setPromoDiscount(0); setAppliedPromo(null); return; }
    let best: Promotion | null = null; let bestDisc = 0;
    for (const p of activePromos) { const d = calcPromoDiscount(p); if (d > bestDisc) { bestDisc = d; best = p; } }
    setAppliedPromo(best); setPromoDiscount(bestDisc);
  }

  // ── Voucher ──────────────────────────────────────────────
  const applyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code || !tenant) return;
    setVoucherError('');
    const { data } = await supabase.from('pos_vouchers' as any).select('*')
      .eq('tenant_id', tenant.id).eq('code', code).eq('is_active', true).maybeSingle();
    if (!data) { setVoucherError('Kode voucher tidak valid atau tidak aktif'); return; }
    const v = data as unknown as Voucher;
    const now = new Date();
    if ((v as any).start_date && now < new Date((v as any).start_date)) { setVoucherError('Voucher belum berlaku'); return; }
    if ((v as any).end_date && now > new Date((v as any).end_date)) { setVoucherError('Voucher sudah kedaluwarsa'); return; }
    if (v.usage_limit && v.used_count >= v.usage_limit) { setVoucherError('Voucher sudah habis'); return; }
    if (subtotal < v.min_purchase) { setVoucherError(`Min. pembelian ${formatCurrency(v.min_purchase)}`); return; }
    let disc = v.type === 'discount_percent'
      ? Math.min(subtotal * v.discount_percent / 100, v.max_discount || Infinity)
      : Math.min(v.discount_amount, subtotal);
    setAppliedVoucher(v); setVoucherDiscount(disc);
    toast.success(`Voucher "${v.name}" berhasil diterapkan! Diskon ${formatCurrency(disc)}`);
  };

  const removeVoucher = () => { setAppliedVoucher(null); setVoucherDiscount(0); setVoucherCode(''); setVoucherError(''); };

  // ── Cart actions ─────────────────────────────────────────
  const addToCart = async (product: Product, variantId?: string, variantName?: string, variantPrice?: number) => {
    if (product.has_variants && !variantId) {
      const { data } = await supabase.from('pos_product_variants' as any).select('*').eq('product_id', product.id).eq('is_active', true);
      setVariants((data || []) as unknown as Variant[]); setSelectedProduct(product); setVariantDialog(true); return;
    }
    const price = variantPrice ?? product.price;
    const existingIdx = cart.findIndex(c => c.productId === product.id && c.variantId === variantId);
    if (existingIdx >= 0) {
      const newCart = [...cart]; newCart[existingIdx].qty += 1; setCart(newCart);
    } else {
      setCart(prev => [...prev, { productId: product.id, variantId, name: product.name, variantName, price, costPrice: product.cost_price, unit: product.unit, qty: 1, discount: 0, taxRate: product.tax_rate, notes: '' }]);
    }
    setSearch('');
  };

  const updateQty = (idx: number, delta: number) => {
    const newCart = [...cart]; newCart[idx].qty = Math.max(0.5, newCart[idx].qty + delta);
    if (newCart[idx].qty <= 0) newCart.splice(idx, 1); setCart(newCart);
  };
  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));
  const updateItemDiscount = (idx: number, val: number) => {
    const newCart = [...cart]; newCart[idx].discount = Math.min(val, newCart[idx].price * newCart[idx].qty); setCart(newCart);
  };
  const clearCart = () => {
    setCart([]); setDiscount(0); setAppliedPromo(null); setPromoDiscount(0);
    setAppliedVoucher(null); setVoucherDiscount(0); setVoucherCode(''); setUsePoints(false); setPointsToRedeem(0);
  };

  // ── Loyalty ──────────────────────────────────────────────
  const handleTogglePoints = (checked: boolean) => {
    setUsePoints(checked);
    if (checked && loyaltyProgram) {
      const maxPtsUsable = Math.min(customerPoints, loyaltyProgram.min_redeem_points <= customerPoints ? customerPoints : 0);
      setPointsToRedeem(maxPtsUsable);
    } else setPointsToRedeem(0);
  };
  const handlePointsInput = (val: string) => {
    if (!loyaltyProgram) return;
    let pts = parseInt(val) || 0;
    pts = Math.max(loyaltyProgram.min_redeem_points, Math.min(pts, customerPoints));
    setPointsToRedeem(pts);
  };

  // ── Keyboard shortcuts ───────────────────────────────────
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

  // ── Customer search ──────────────────────────────────────
  const searchCustomers = async (q: string) => {
    if (!tenant || !q) { setCustomers([]); return; }
    const { data } = await supabase.from('pos_customers' as any)
      .select('id, name, phone, is_member, loyalty_points, loyalty_tier')
      .eq('tenant_id', tenant.id).ilike('name', `%${q}%`).limit(6);
    setCustomers((data || []) as unknown as Customer[]);
  };

  // ── Payment ──────────────────────────────────────────────
  const openPayment = () => {
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }
    setPaymentAmount(String(total)); setPaymentDialog(true);
  };

  const handlePaymentChange = (field: string, value: string | boolean) => {
    if (field === 'paymentMethod') setPaymentMethod(value as string);
    else if (field === 'paymentAmount') setPaymentAmount(value as string);
    else if (field === 'isSplitPayment') setIsSplitPayment(value === 'true' || value === true);
    else if (field === 'splitMethod2') setSplitMethod2(value as string);
    else if (field === 'splitAmount1') setSplitAmount1(value as string);
    else if (field === 'splitAmount2') setSplitAmount2(value as string);
  };

  const processPayment = async () => {
    if (!tenant || !activeOutlet || !user) return;
    if (isSplitPayment) {
      if (Number(splitAmount1) + Number(splitAmount2) < total) { toast.error('Total bayar kurang dari total transaksi'); return; }
    } else if (paymentMethod === 'cash' && (Number(paymentAmount) || 0) < total) {
      toast.error('Jumlah bayar kurang dari total'); return;
    }
    if (usePoints && loyaltyProgram && pointsToRedeem < loyaltyProgram.min_redeem_points) {
      toast.error(`Min. tukar ${loyaltyProgram.min_redeem_points} poin`); return;
    }
    try {
      const saleNumber = `TRX-${Date.now()}`;
      const { data: sale, error } = await supabase.from('pos_sales' as any).insert({
        tenant_id: tenant.id, outlet_id: activeOutlet.id, sale_number: saleNumber,
        cashier_id: user.id, cashier_name: user.email,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || customerName || null,
        subtotal, discount_amount: discount, tax_amount: taxAmount, total,
        payment_method: isSplitPayment ? `split:${paymentMethod}+${splitMethod2}` : paymentMethod,
        payment_amount: isSplitPayment ? (Number(splitAmount1) + Number(splitAmount2)) : (Number(paymentAmount) || total),
        change_amount: isSplitPayment ? Math.max(0, (Number(splitAmount1) + Number(splitAmount2)) - total) : change,
        status: 'completed', notes: notes || null,
        promotion_id: appliedPromo?.id || null, promotion_discount: promoDiscount,
        voucher_id: appliedVoucher?.id || null, voucher_code: appliedVoucher?.code || null, voucher_discount: voucherDiscount,
        loyalty_points_earned: pointsEarned, loyalty_points_redeemed: usePoints ? pointsToRedeem : 0, loyalty_discount: pointsDiscount,
      }).select().single();
      if (error) throw error;
      const saleId = (sale as any).id;

      await supabase.from('pos_sale_items' as any).insert(
        cart.map(item => ({
          sale_id: saleId, product_id: item.productId, variant_id: item.variantId || null,
          product_name: item.name, variant_name: item.variantName || null, qty: item.qty,
          price: item.price, cost_price: item.costPrice, discount: item.discount,
          tax_amount: (item.price * item.qty - item.discount) * item.taxRate / 100,
          subtotal: item.price * item.qty - item.discount,
        }))
      );

      for (const item of cart) {
        const stockQuery = supabase.from('pos_stock' as any).select('id, quantity').eq('product_id', item.productId).eq('outlet_id', activeOutlet.id);
        const { data: stockD } = item.variantId
          ? await stockQuery.eq('variant_id', item.variantId).single()
          : await stockQuery.is('variant_id', null).single();
        if (stockD) {
          const newQty = Math.max(0, (stockD as any).quantity - item.qty);
          await supabase.from('pos_stock' as any).update({ quantity: newQty }).eq('id', (stockD as any).id);
          if (!item.variantId) {
            await supabase.from('pos_stock_mutations' as any).insert({
              tenant_id: tenant.id, product_id: item.productId, outlet_id: activeOutlet.id,
              type: 'sale', quantity: -item.qty, quantity_before: (stockD as any).quantity, quantity_after: newQty,
              reference_id: saleId, reference_type: 'pos_sale', created_by: user.id,
            });
          }
        }
      }

      // Kurangi bahan baku otomatis berdasarkan resep produk
      try {
        const productIds = [...new Set(cart.map(i => i.productId))];
        const { data: recipes } = await supabase
          .from('pos_recipes' as any)
          .select('*, pos_raw_materials(id, name, current_stock, unit)')
          .in('product_id', productIds)
          .eq('tenant_id', tenant.id);

        if (recipes && recipes.length > 0) {
          for (const item of cart) {
            const itemRecipes = (recipes as any[]).filter(r => r.product_id === item.productId);
            for (const recipe of itemRecipes) {
              const mat = recipe.pos_raw_materials as any;
              if (!mat) continue;
              const totalUsage = recipe.qty_needed * item.qty;
              const qtyBefore = mat.current_stock;
              const qtyAfter = Math.max(0, qtyBefore - totalUsage);
              await supabase
                .from('pos_raw_materials' as any)
                .update({ current_stock: qtyAfter, updated_at: new Date().toISOString() })
                .eq('id', mat.id);
              await supabase.from('pos_raw_material_mutations' as any).insert({
                tenant_id: tenant.id,
                outlet_id: activeOutlet.id,
                raw_material_id: mat.id,
                type: 'usage',
                qty: -totalUsage,
                qty_before: qtyBefore,
                qty_after: qtyAfter,
                reference_id: saleId,
                reference_type: 'pos_sale',
                notes: `Penjualan: ${item.name} x${item.qty}`,
                created_by: user.id,
              });
            }
          }
        }
      } catch {
        // Silent — jangan gagalkan transaksi karena BOM
      }

      if (selectedCustomer) {
        const { data: cust } = await supabase.from('pos_customers' as any)
          .select('total_purchase, transaction_count, loyalty_points').eq('id', selectedCustomer.id).single();
        if (cust) {
          const currentPts = (cust as any).loyalty_points || 0;
          const newPts = Math.max(0, currentPts - (usePoints ? pointsToRedeem : 0) + pointsEarned);
          let newTier = 'Bronze';
          if (loyaltyProgram) {
            const tiers = [...loyaltyProgram.tiers].sort((a, b) => b.min_points - a.min_points);
            for (const t of tiers) { if (newPts >= t.min_points) { newTier = t.name; break; } }
          }
          await supabase.from('pos_customers' as any).update({
            total_purchase: ((cust as any).total_purchase || 0) + total,
            transaction_count: ((cust as any).transaction_count || 0) + 1,
            last_purchase_at: new Date().toISOString(), loyalty_points: newPts, loyalty_tier: newTier,
          }).eq('id', selectedCustomer.id);
        }
      }

      if (appliedVoucher) {
        await supabase.from('pos_vouchers' as any).update({ used_count: (appliedVoucher.used_count || 0) + 1 }).eq('id', appliedVoucher.id);
        await supabase.from('pos_voucher_usages' as any).insert({ voucher_id: appliedVoucher.id, sale_id: saleId, customer_id: selectedCustomer?.id || null, discount_given: voucherDiscount });
      }
      if (appliedPromo && promoDiscount > 0) {
        await supabase.from('pos_promotions' as any).update({ used_count: (appliedPromo as any).used_count + 1 }).eq('id', appliedPromo.id);
      }

      setLastSale({
        saleNumber, total, change, paymentMethod,
        customerName: selectedCustomer?.name || customerName || 'Umum',
        items: [...cart], pointsEarned, pointsRedeemed: usePoints ? pointsToRedeem : 0,
        pointsDiscount, promoDiscount, voucherDiscount,
        appliedPromoName: appliedPromo?.name || null, appliedVoucherCode: appliedVoucher?.code || null,
        newPointsBalance: selectedCustomer ? Math.max(0, customerPoints - (usePoints ? pointsToRedeem : 0) + pointsEarned) : null,
      });

      clearCart(); setNotes(''); setSelectedCustomer(null); setCustomerName('');
      setPaymentAmount(''); setPaymentDialog(false); setSuccessDialog(true); fetchProducts();
    } catch (err: any) { toast.error('Gagal memproses transaksi: ' + err.message); }
  };

  // ── Hold Bill ────────────────────────────────────────────
  const holdBill = async () => {
    if (!tenant || !activeOutlet || !user || cart.length === 0) return;
    await supabase.from('pos_held_bills' as any).insert({
      tenant_id: tenant.id, outlet_id: activeOutlet.id, cashier_id: user.id,
      label: `Bill ${heldBills.length + 1}`,
      customer_name: selectedCustomer?.name || customerName || null,
      customer_id: selectedCustomer?.id || null, items: cart, discount_amount: discount, notes,
    });
    clearCart(); setNotes(''); setSelectedCustomer(null); setCustomerName('');
    await fetchHeldBills(); toast.success('Transaksi ditahan');
  };

  const resumeBill = async (bill: HeldBill) => {
    setCart(bill.items); setDiscount(bill.discount_amount); setNotes(bill.notes); setCustomerName(bill.customer_name || '');
    await supabase.from('pos_held_bills' as any).delete().eq('id', bill.id);
    await fetchHeldBills(); setHeldBillsDialog(false); toast.success('Transaksi dilanjutkan');
  };

  // ── Product filter + barcode ─────────────────────────────
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.barcode && p.barcode.includes(search));
    const matchCat = filterCat === 'all' || (p as any).category_id === filterCat;
    return matchSearch && matchCat;
  });

  const onBarcodeDetect = useCallback((barcode: string) => {
    const match = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (match) { addToCart(match); toast.success(`✓ ${match.name} ditambahkan`); }
    else { setSearch(barcode); setScannerOpen(false); toast.info(`Barcode "${barcode}" — pilih produk secara manual`); }
  }, [products]);

  // ── Thermal printer ──────────────────────────────────────
  const connectThermalPrinter = async () => {
    if (!ThermalPrinter.isSupported()) { toast.error('Browser tidak mendukung Web Serial API.'); return; }
    setThermalConnecting(true);
    try {
      const ok = await getPrinter().connect();
      if (ok) { setThermalConnected(true); toast.success('Printer thermal terhubung!'); }
    } catch (err: any) { toast.error('Gagal menghubungkan printer: ' + (err.message || 'Coba lagi')); }
    finally { setThermalConnecting(false); }
  };

  const printReceipt = async () => {
    if (!lastSale) return;
    const receiptData: ReceiptData = {
      storeName: (tenant as any)?.name || 'Toko', storeAddress: (tenant as any)?.address,
      storePhone: (tenant as any)?.phone, receiptHeader: (tenant as any)?.receipt_header,
      receiptFooter: (tenant as any)?.receipt_footer, invoiceNo: lastSale.saleNumber,
      date: new Date(), cashierName: user?.email,
      customerName: lastSale.customerName !== 'Umum' ? lastSale.customerName : undefined,
      items: lastSale.items.map((i: any) => ({ name: i.variantName ? `${i.name} (${i.variantName})` : i.name, qty: i.qty, price: i.price, discount: i.discount || 0 })),
      subtotal: lastSale.subtotal ?? lastSale.total,
      discountAmount: lastSale.promoDiscount + lastSale.voucherDiscount + lastSale.pointsDiscount,
      taxAmount: lastSale.taxAmount ?? 0, total: lastSale.total,
      paidAmount: lastSale.paidAmount ?? lastSale.total, changeAmount: lastSale.change ?? 0,
      paymentMethod: lastSale.paymentMethod,
    };
    if (thermalConnected) {
      try { await getPrinter().printReceipt(receiptData); return; }
      catch { toast.error('Printer thermal gagal. Beralih ke cetak browser.'); setThermalConnected(false); }
    }
    await printReceiptBrowser(receiptData);
  };

  const sendReceiptViaWhatsApp = () => {
    if (!lastSale) return;
    const storeName = (tenant as any)?.name || 'Toko';
    const storePhone = (tenant as any)?.phone || '';
    const now = new Date();
    const tgl = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const payLabel: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit' };
    const methodLabel = payLabel[lastSale.paymentMethod] || lastSale.paymentMethod;

    const lines: string[] = [];
    lines.push(`🧾 *STRUK PEMBAYARAN*`);
    lines.push(`*${storeName}*`);
    if (storePhone) lines.push(`📞 ${storePhone}`);
    lines.push(`─────────────────────`);
    lines.push(`No : ${lastSale.saleNumber}`);
    lines.push(`Tgl: ${tgl}`);
    if (lastSale.customerName && lastSale.customerName !== 'Umum') lines.push(`Plg: ${lastSale.customerName}`);
    lines.push(`─────────────────────`);
    for (const item of lastSale.items) {
      const name = item.variantName ? `${item.name} (${item.variantName})` : item.name;
      lines.push(`${name}`);
      const sub = item.price * item.qty - (item.discount || 0);
      lines.push(`  ${item.qty}x ${formatCurrency(item.price)}  =  ${formatCurrency(sub)}`);
      if ((item.discount || 0) > 0) lines.push(`  Diskon: -${formatCurrency(item.discount)}`);
    }
    lines.push(`─────────────────────`);
    if ((lastSale.promoDiscount || 0) > 0) lines.push(`Diskon Promo : -${formatCurrency(lastSale.promoDiscount)}`);
    if ((lastSale.voucherDiscount || 0) > 0) lines.push(`Voucher : -${formatCurrency(lastSale.voucherDiscount)}`);
    if ((lastSale.pointsDiscount || 0) > 0) lines.push(`Tukar Poin : -${formatCurrency(lastSale.pointsDiscount)}`);
    lines.push(`*TOTAL : ${formatCurrency(lastSale.total)}*`);
    lines.push(`Metode : ${methodLabel}`);
    if (lastSale.paymentMethod === 'cash' && (lastSale.change || 0) > 0) {
      lines.push(`Kembalian : ${formatCurrency(lastSale.change)}`);
    }
    if ((lastSale.pointsEarned || 0) > 0) {
      lines.push(`─────────────────────`);
      lines.push(`⭐ Poin diperoleh: +${lastSale.pointsEarned.toLocaleString('id-ID')} poin`);
      if (lastSale.newPointsBalance !== null) lines.push(`   Saldo poin: ${lastSale.newPointsBalance.toLocaleString('id-ID')} poin`);
    }
    lines.push(`─────────────────────`);
    lines.push(`Terima kasih telah berbelanja! 🙏`);

    const message = encodeURIComponent(lines.join('\n'));
    const customerPhone = selectedCustomer?.phone?.replace(/\D/g, '').replace(/^0/, '62') || '';
    const url = customerPhone
      ? `https://wa.me/${customerPhone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  const exportReceiptPDF = () => {
    if (!lastSale) return;
    const storeName = (tenant as any)?.name || 'Toko';
    const storeAddress = (tenant as any)?.address || '';
    const storePhone = (tenant as any)?.phone || '';
    const receiptHeader = (tenant as any)?.receipt_header || '';
    const receiptFooter = (tenant as any)?.receipt_footer || 'Terima kasih telah berbelanja!';
    const now = new Date();
    const tgl = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const payLabel: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', debit: 'Debit' };
    const methodLabel = payLabel[lastSale.paymentMethod] || lastSale.paymentMethod;

    const itemRows = lastSale.items.map((item: any) => {
      const name = item.variantName ? `${item.name} (${item.variantName})` : item.name;
      const sub = item.price * item.qty - (item.discount || 0);
      const discRow = (item.discount || 0) > 0
        ? `<tr><td colspan="3" style="color:#ef4444;font-size:10px;padding:0 0 2px 4px">Diskon: -${formatCurrency(item.discount)}</td></tr>`
        : '';
      return `<tr>
        <td style="padding:3px 0;vertical-align:top">${name}</td>
        <td style="text-align:center;white-space:nowrap">${item.qty}x</td>
        <td style="text-align:right;white-space:nowrap">${formatCurrency(sub)}</td>
      </tr>${discRow}`;
    }).join('');

    const discountRows = [
      (lastSale.promoDiscount || 0) > 0 ? `<tr><td colspan="2" style="color:#f97316">Diskon Promo</td><td style="text-align:right;color:#f97316">-${formatCurrency(lastSale.promoDiscount)}</td></tr>` : '',
      (lastSale.voucherDiscount || 0) > 0 ? `<tr><td colspan="2" style="color:#a855f7">Voucher (${lastSale.appliedVoucherCode})</td><td style="text-align:right;color:#a855f7">-${formatCurrency(lastSale.voucherDiscount)}</td></tr>` : '',
      (lastSale.pointsDiscount || 0) > 0 ? `<tr><td colspan="2" style="color:#10b981">Tukar Poin</td><td style="text-align:right;color:#10b981">-${formatCurrency(lastSale.pointsDiscount)}</td></tr>` : '',
    ].join('');

    const pointsSection = (lastSale.pointsEarned || 0) > 0 ? `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:8px;margin-top:8px;font-size:11px">
        <div style="color:#065f46;font-weight:bold;margin-bottom:4px">⭐ Ringkasan Poin</div>
        ${(lastSale.pointsRedeemed || 0) > 0 ? `<div style="display:flex;justify-content:space-between;color:#dc2626"><span>Ditukar</span><span>-${lastSale.pointsRedeemed.toLocaleString('id-ID')} poin</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;color:#059669"><span>Diperoleh</span><span>+${lastSale.pointsEarned.toLocaleString('id-ID')} poin</span></div>
        ${lastSale.newPointsBalance !== null ? `<div style="display:flex;justify-content:space-between;font-weight:bold;color:#065f46;border-top:1px solid #a7f3d0;margin-top:4px;padding-top:4px"><span>Saldo Poin</span><span>${lastSale.newPointsBalance.toLocaleString('id-ID')} poin</span></div>` : ''}
      </div>` : '';

    const changeRow = lastSale.paymentMethod === 'cash' && (lastSale.change || 0) > 0
      ? `<tr><td colspan="2">Kembalian</td><td style="text-align:right">${formatCurrency(lastSale.change)}</td></tr>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Struk - ${lastSale.saleNumber}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #111; width: 72mm; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .divider { border-top: 1px dashed #999; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      .total-row td { font-weight: bold; font-size: 13px; border-top: 1px solid #111; padding-top: 4px; }
      @media print {
        body { margin: 0; }
        button { display: none; }
      }
    </style>
    </head><body>
    <div class="center bold" style="font-size:14px;margin-bottom:2px">${storeName}</div>
    ${storeAddress ? `<div class="center" style="font-size:10px">${storeAddress}</div>` : ''}
    ${storePhone ? `<div class="center" style="font-size:10px">${storePhone}</div>` : ''}
    ${receiptHeader ? `<div class="center" style="font-size:10px;margin-top:2px">${receiptHeader}</div>` : ''}
    <div class="divider"></div>
    <table><tbody>
      <tr><td>No</td><td colspan="2">: ${lastSale.saleNumber}</td></tr>
      <tr><td>Tgl</td><td colspan="2">: ${tgl}</td></tr>
      ${lastSale.customerName && lastSale.customerName !== 'Umum' ? `<tr><td>Plg</td><td colspan="2">: ${lastSale.customerName}</td></tr>` : ''}
    </tbody></table>
    <div class="divider"></div>
    <table><tbody>${itemRows}</tbody></table>
    <div class="divider"></div>
    <table><tbody>
      ${discountRows}
      <tr class="total-row"><td colspan="2">TOTAL</td><td style="text-align:right">${formatCurrency(lastSale.total)}</td></tr>
      <tr><td colspan="2">Metode</td><td style="text-align:right">${methodLabel}</td></tr>
      ${changeRow}
    </tbody></table>
    ${pointsSection}
    <div class="divider"></div>
    <div class="center" style="font-size:10px;margin-top:4px">${receiptFooter}</div>
    <div style="height:8px"></div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) { toast.error('Popup diblokir. Izinkan popup untuk export PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  if (!tenant) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Buat usaha terlebih dahulu</p>
        <Button onClick={() => navigate('/pos/pengaturan')} className="bg-emerald-600 hover:bg-emerald-700">Buat Usaha</Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={cn('fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transform transition-transform duration-200', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        <POSSidebar />
      </div>

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* Panel Produk */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-3 border-b bg-background space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input ref={searchRef} className="pl-9 pr-9 h-9" placeholder="Cari produk / scan barcode... (F8)"
                  value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setScannerOpen(true)} title="Scan Barcode Kamera">
                <Barcode className="h-4 w-4 text-emerald-600" />
              </Button>
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
                    <button key={p.id} onClick={() => !outOfStock && addToCart(p)} disabled={outOfStock}
                      className={cn('text-left p-3 rounded-xl border transition-all hover:shadow-md active:scale-[0.97]', outOfStock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400')}>
                      <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center mb-2">
                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover rounded-lg" /> : <Package className="h-6 w-6 text-muted-foreground" />}
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

        {/* Panel Cart — pakai komponen POSCart */}
        <POSCart
          cart={cart} discount={discount} notes={notes}
          selectedCustomer={selectedCustomer} customerName={customerName} customerTier={customerTier}
          loyaltyProgram={loyaltyProgram} customerPoints={customerPoints}
          usePoints={usePoints} pointsToRedeem={pointsToRedeem} pointsDiscount={pointsDiscount} pointsEarned={pointsEarned}
          appliedPromo={appliedPromo} promoDiscount={promoDiscount}
          appliedVoucher={appliedVoucher} voucherDiscount={voucherDiscount}
          voucherCode={voucherCode} voucherError={voucherError}
          subtotal={subtotal} taxAmount={taxAmount} total={total}
          heldBillsCount={heldBills.length}
          formatCurrency={formatCurrency}
          onUpdateQty={updateQty} onRemoveItem={removeItem} onUpdateDiscount={updateItemDiscount}
          onSetDiscount={setDiscount} onSetNotes={setNotes}
          onOpenCustomer={() => setCustomerDialog(true)}
          onOpenHeldBills={() => setHeldBillsDialog(true)}
          onHoldBill={holdBill} onOpenPayment={openPayment} onClearCart={clearCart}
          onTogglePoints={handleTogglePoints} onPointsInput={handlePointsInput}
          onApplyVoucher={applyVoucher} onRemoveVoucher={removeVoucher}
          onSetVoucherCode={setVoucherCode} onSetVoucherError={setVoucherError}
        />
      </div>

      {/* Dialog Pembayaran */}
      <POSPaymentDialog
        open={paymentDialog} onOpenChange={setPaymentDialog}
        subtotal={subtotal} taxAmount={taxAmount} discount={discount}
        promoDiscount={promoDiscount} voucherDiscount={voucherDiscount} pointsDiscount={pointsDiscount}
        total={total} paymentMethod={paymentMethod} paymentAmount={paymentAmount}
        isSplitPayment={isSplitPayment} splitMethod2={splitMethod2} splitAmount1={splitAmount1} splitAmount2={splitAmount2}
        appliedPromo={appliedPromo} appliedVoucher={appliedVoucher}
        pointsToRedeem={pointsToRedeem} pointsEarned={pointsEarned}
        selectedCustomer={selectedCustomer} loyaltyProgram={loyaltyProgram}
        formatCurrency={formatCurrency} onChange={handlePaymentChange} onProcess={processPayment}
      />

      {/* Dialog Sukses */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-2">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold mb-1">Transaksi Berhasil!</h2>
            {lastSale && (
              <div className="bg-muted rounded-xl p-4 mt-3 text-left space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">No. Transaksi</span><span className="font-mono font-bold text-xs">{lastSale.saleNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{lastSale.customerName}</span></div>
                {lastSale.promoDiscount > 0 && <div className="flex justify-between text-orange-600 text-xs"><span className="flex items-center gap-1"><Percent className="h-3 w-3" />Promo</span><span>-{formatCurrency(lastSale.promoDiscount)}</span></div>}
                {lastSale.voucherDiscount > 0 && <div className="flex justify-between text-purple-600 text-xs"><span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{lastSale.appliedVoucherCode}</span><span>-{formatCurrency(lastSale.voucherDiscount)}</span></div>}
                {lastSale.pointsDiscount > 0 && <div className="flex justify-between text-emerald-600 text-xs"><span className="flex items-center gap-1"><Star className="h-3 w-3" />Poin ditukar</span><span>-{formatCurrency(lastSale.pointsDiscount)}</span></div>}
                <div className="flex justify-between font-bold border-t pt-2"><span>Total Dibayar</span><span className="text-emerald-600">{formatCurrency(lastSale.total)}</span></div>
                {lastSale.paymentMethod === 'cash' && lastSale.change > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Kembalian</span><span className="font-bold">{formatCurrency(lastSale.change)}</span></div>}
                {lastSale.pointsEarned > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2 space-y-1">
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><Star className="h-3.5 w-3.5" />Ringkasan Poin</p>
                    {lastSale.pointsRedeemed > 0 && <div className="flex justify-between text-xs text-red-600"><span>Ditukar</span><span>-{lastSale.pointsRedeemed.toLocaleString('id-ID')} poin</span></div>}
                    <div className="flex justify-between text-xs text-emerald-600"><span>Diperoleh</span><span>+{lastSale.pointsEarned.toLocaleString('id-ID')} poin</span></div>
                    {lastSale.newPointsBalance !== null && <div className="flex justify-between text-xs font-bold text-emerald-700 border-t pt-1"><span>Saldo Poin</span><span>{lastSale.newPointsBalance.toLocaleString('id-ID')} poin</span></div>}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" className="flex-1 text-sm" onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-1.5" />Cetak Struk
              </Button>
              <Button className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSuccessDialog(false); searchRef.current?.focus(); }}>
                Transaksi Baru
              </Button>
              <Button variant="outline" className="flex-1 text-sm border-green-500 text-green-600 hover:bg-green-50" onClick={sendReceiptViaWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-1.5" />Kirim via WA
              </Button>
              <Button variant="outline" className="flex-1 text-sm border-blue-400 text-blue-600 hover:bg-blue-50" onClick={exportReceiptPDF}>
                <FileDown className="h-4 w-4 mr-1.5" />Simpan PDF
              </Button>
            </div>
            {ThermalPrinter.isSupported() && (
              <Button variant="ghost" size="sm" className={`w-full mt-1 text-xs ${thermalConnected ? 'text-emerald-600' : 'text-muted-foreground'}`}
                onClick={connectThermalPrinter} disabled={thermalConnecting}>
                <Printer className="h-3 w-3 mr-1.5" />
                {thermalConnected ? '● Printer Thermal Terhubung' : thermalConnecting ? 'Menghubungkan...' : 'Hubungkan Printer Thermal (ESC/POS)'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Held Bills */}
      <POSHeldBills open={heldBillsDialog} onOpenChange={setHeldBillsDialog} heldBills={heldBills} onResume={resumeBill} />

      {/* Dialog Varian */}
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

      {/* Dialog Customer */}
      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pilih Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Cari nama customer..." value={customerSearch || customerName}
              onChange={e => { const v = e.target.value; setCustomerName(v); setCustomerSearch(v); searchCustomers(v); }} autoFocus />
            {customers.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {customers.map(c => (
                  <button key={c.id} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left"
                    onClick={() => { setSelectedCustomer(c); setCustomerName(''); setCustomerSearch(''); setCustomerDialog(false); }}>
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', c.is_member ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground')}>
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.is_member && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Member</Badge>}
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
                  {loyaltyProgram && <span className="ml-2 text-xs text-emerald-600">{customerPoints.toLocaleString('id-ID')} poin</span>}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => { setSelectedCustomer(null); setCustomerName(''); }}>Hapus</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setCustomerDialog(false)}>Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetect={onBarcodeDetect} />
    </div>
  );
}
