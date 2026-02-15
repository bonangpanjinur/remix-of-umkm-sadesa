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
  Wallet as WalletIcon
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

  useEffect(() => {
    const fetchBadges = async () => {
      if (!user) return;
      
      // Get merchant for this user
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (merchant) {
        // Pending orders
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .in('status', ['NEW', 'PENDING_CONFIRMATION']);
        
        setPendingOrders(ordersCount || 0);

        // Unreplied reviews
        const { count: reviewsCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchant.id)
          .is('merchant_reply', null);
        
        setUnrepliedReviews(reviewsCount || 0);

        // Pending refunds - get via order_id that belongs to this merchant
        const { data: merchantOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('merchant_id', merchant.id);
        
        if (merchantOrders && merchantOrders.length > 0) {
          const orderIds = merchantOrders.map(o => o.id);
          const { count: refundsCount } = await supabase
            .from('refund_requests')
            .select('*', { count: 'exact', head: true })
            .in('order_id', orderIds)
            .eq('status', 'PENDING');
          
          setPendingRefunds(refundsCount || 0);
        }
      }
    };
    fetchBadges();
  }, [user]);

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/merchant', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Kasir POS', href: '/merchant/pos', icon: <Receipt className="h-4 w-4" /> },
    { label: 'Produk', href: '/merchant/products', icon: <Package className="h-4 w-4" /> },
    { label: 'Pesanan', href: '/merchant/orders', icon: <Receipt className="h-4 w-4" />, badge: pendingOrders },
    { label: 'Chat', href: '/merchant/chat', icon: <MessageCircle className="h-4 w-4" /> },
    { label: 'Refund', href: '/merchant/refunds', icon: <RotateCcw className="h-4 w-4" />, badge: pendingRefunds },
    { label: 'Flash Sale', href: '/merchant/flash-sale', icon: <Zap className="h-4 w-4" /> },
    { label: 'Jadwal Promo', href: '/merchant/scheduled-promo', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Voucher', href: '/merchant/vouchers', icon: <Ticket className="h-4 w-4" /> },
    { label: 'Statistik Pengunjung', href: '/merchant/visitor-stats', icon: <Eye className="h-4 w-4" /> },
    { label: 'Kuota', href: '/merchant/subscription', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Analitik', href: '/merchant/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Ulasan', href: '/merchant/reviews', icon: <Star className="h-4 w-4" />, badge: unrepliedReviews },
    { label: 'Promo', href: '/merchant/promo', icon: <Percent className="h-4 w-4" /> },
    { label: 'Iuran Kas', href: '/merchant/dues', icon: <WalletIcon className="h-4 w-4" /> },
    { label: 'Penarikan', href: '/merchant/withdrawal', icon: <Wallet className="h-4 w-4" /> },
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
          const isActive = location.pathname === item.href;
          
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
