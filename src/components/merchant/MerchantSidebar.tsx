import { useState, useEffect } from 'react';

import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  Settings, 
  ChevronLeft,
  Store,
  BarChart3,
  Star,
  Percent,
  Wallet,
  CreditCard,
  Zap,
  Ticket,
  Calendar,
  Eye,
  RotateCcw,
  MessageCircle,
  Wallet as WalletIcon,
  MessageSquare,
  FileSpreadsheet,
  Lightbulb,
  Megaphone,
  Images,
  TrendingUp,
  Layers,
  Clock,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export function MerchantSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [unrepliedReviews, setUnrepliedReviews] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchBadges = async () => {
      if (!user) return;
      
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!merchant) return;

      const [ordersRes, reviewsRes, lowStockRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .in('status', ['NEW', 'PENDING_CONFIRMATION']),
        supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .is('merchant_reply', null),
        supabase
          .from('products')
          .select('id, stock, low_stock_threshold')
          .eq('merchant_id', merchant.id)
          .eq('is_active', true),
      ]);

      setPendingOrders(ordersRes.count || 0);
      setUnrepliedReviews(reviewsRes.count || 0);
      const lowCount = lowStockRes.data?.filter(p => p.stock <= (p.low_stock_threshold || 5)).length || 0;
      setLowStockCount(lowCount);

      // Refund via merchant orders
      const { data: mOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('merchant_id', merchant.id);
      if (mOrders && mOrders.length > 0) {
        const { count: refCount } = await supabase
          .from('refund_requests')
          .select('*', { count: 'exact', head: true })
          .in('order_id', mOrders.map(o => o.id))
          .eq('status', 'PENDING');
        setPendingRefunds(refCount || 0);
      }
    };

    fetchBadges();

    // P1.2: Real-time badge via SSE — pesanan baru langsung muncul di sidebar
    const channel = supabase
      .channel(`merchant-sidebar-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        fetchBadges();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        fetchBadges();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, () => {
        setUnrepliedReviews((prev) => prev + 1);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'refund_requests' }, () => {
        setPendingRefunds((prev) => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/merchant', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Kasir POS', href: '/merchant/pos', icon: <Receipt className="h-4 w-4" /> },
    { label: 'Pesanan', href: '/merchant/orders', icon: <Receipt className="h-4 w-4" />, badge: pendingOrders },
    { label: 'Produk', href: '/merchant/products', icon: <Package className="h-4 w-4" />, badge: lowStockCount },
    { label: 'Manajemen Stok', href: '/merchant/stock', icon: <Layers className="h-4 w-4" />, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { label: 'Galeri Toko', href: '/merchant/gallery', icon: <Images className="h-4 w-4" /> },
    { label: 'Laporan Keuangan', href: '/merchant/finance', icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Import / Export', href: '/merchant/import-export', icon: <FileSpreadsheet className="h-4 w-4" /> },
    { label: 'Notifikasi WA', href: '/merchant/notifikasi-wa', icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Insight Bisnis', href: '/merchant/insight', icon: <Lightbulb className="h-4 w-4" /> },
    { label: 'Iklan Berbayar', href: '/merchant/iklan', icon: <Megaphone className="h-4 w-4" /> },
    { label: 'Analitik', href: '/merchant/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Statistik Pengunjung', href: '/merchant/visitor-stats', icon: <Eye className="h-4 w-4" /> },
    { label: 'Ulasan', href: '/merchant/reviews', icon: <Star className="h-4 w-4" />, badge: unrepliedReviews },
    { label: 'Chat', href: '/merchant/chat', icon: <MessageCircle className="h-4 w-4" /> },
    { label: 'Refund', href: '/merchant/refunds', icon: <RotateCcw className="h-4 w-4" />, badge: pendingRefunds },
    { label: 'Flash Sale', href: '/merchant/flash-sale', icon: <Zap className="h-4 w-4" /> },
    { label: 'Jadwal Promo', href: '/merchant/scheduled-promo', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Voucher', href: '/merchant/vouchers', icon: <Ticket className="h-4 w-4" /> },
    { label: 'Promo', href: '/merchant/promo', icon: <Percent className="h-4 w-4" /> },
    { label: 'Bundle Produk', href: '/merchant/bundle', icon: <Package className="h-4 w-4" /> },
    { label: 'Pre-order & Reservasi', href: '/merchant/preorder', icon: <Clock className="h-4 w-4" /> },
    { label: 'Grosir & B2B', href: '/merchant/grosir', icon: <Layers className="h-4 w-4" /> },
    { label: 'Laporan Pajak', href: '/merchant/pajak', icon: <FileText className="h-4 w-4" /> },
    { label: 'Kuota', href: '/merchant/subscription', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Penarikan', href: '/merchant/withdrawal', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Iuran Kas', href: '/merchant/dues', icon: <WalletIcon className="h-4 w-4" /> },
    { label: 'Pengaturan Kasir', href: '/merchant/pos/settings', icon: <Settings className="h-4 w-4" /> },
    { label: 'Pengaturan', href: '/merchant/settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 h-screen bg-card border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Toko Saya</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
        {menuItems.map((item) => {
          const isActive = item.href === '/merchant' 
            ? location.pathname === '/merchant' 
            : location.pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  isActive 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-destructive text-destructive-foreground"
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali ke Aplikasi
        </Link>
      </div>
    </div>
  );
}
