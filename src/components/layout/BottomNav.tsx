import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Receipt, User, Store, MessageCircle } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useChatUnread } from '@/hooks/useChatUnread';

const navItems = [
  { path: '/', icon: Home, label: 'Beranda' },
  { path: '/explore', icon: Compass, label: 'Jelajah' },
  { path: '/buyer/chat', icon: MessageCircle, label: 'Chat' },
  { path: '/orders', icon: Receipt, label: 'Pesanan' },
  { path: '/account', icon: User, label: 'Akun' },
];

export function BottomNav() {
  const location = useLocation();
  const { getItemCount } = useCart();
  const { user } = useAuth();
  const itemCount = getItemCount();
  const chatUnread = useChatUnread();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const fetchBadges = async () => {
      // Unread notifications
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(notifCount || 0);

      // Active orders
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', user.id)
        .in('status', ['NEW', 'PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'PROCESSING', 'PROCESSED', 'ASSIGNED', 'PICKED_UP', 'ON_DELIVERY', 'SENT', 'DELIVERED']);
      setActiveOrders(ordersCount || 0);
    };

    fetchBadges();

    // Refresh every 30s
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const getBadgeCount = (path: string) => {
    if (path === '/orders') return activeOrders;
    if (path === '/account') return unreadCount;
    if (path === '/buyer/chat') return chatUnread;
    return 0;
  };

  return (
    <nav className="glass border-t border-border flex justify-around py-2 pb-3 z-30 fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto">
      {navItems.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path;
        const badgeCount = getBadgeCount(path);
        
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex flex-col items-center transition-all relative pt-1',
              'text-[10px] font-medium',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            )}
          >
            {/* Active indicator bar */}
            <div className={cn(
              'absolute -top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-300',
              isActive ? 'w-6 bg-primary' : 'w-0 bg-transparent'
            )} />
            <Icon className={cn(
              "h-5 w-5 mb-0.5 transition-transform duration-200",
              isActive && "scale-110"
            )} />
            <span className={cn(isActive && "font-semibold")}>{label}</span>
            {badgeCount > 0 && (
              <span className="absolute -top-0 right-1 w-4 h-4 bg-destructive rounded-full text-[8px] flex items-center justify-center text-destructive-foreground font-bold">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
