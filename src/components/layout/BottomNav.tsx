import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Receipt, User, Heart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Beranda' },
  { path: '/explore', icon: Compass, label: 'Jelajah' },
  { path: '/wishlist', icon: Heart, label: 'Wishlist' },
  { path: '/orders', icon: Receipt, label: 'Pesanan' },
  { path: '/account', icon: User, label: 'Akun' },
];

export function BottomNav() {
  const location = useLocation();
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <nav className="glass border-t border-border flex justify-around py-3 z-30 fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto">
      {navItems.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname === path;
        const isOrders = path === '/orders';
        
        return (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex flex-col items-center transition-colors relative',
              'text-[10px] font-medium',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            )}
          >
            <Icon className="h-5 w-5 mb-1" />
            {label}
            {isOrders && itemCount > 0 && (
              <span className="absolute -top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[8px] flex items-center justify-center text-destructive-foreground font-bold">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
