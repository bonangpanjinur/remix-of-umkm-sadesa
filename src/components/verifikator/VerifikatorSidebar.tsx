import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  ChevronLeft,
  ClipboardCheck,
  Wallet
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

export function VerifikatorSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [pendingMerchants, setPendingMerchants] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      if (!user) return;
      
      // Get code created by this verifikator
      const { data: codes } = await supabase
        .from('verifikator_codes')
        .select('code')
        .eq('verifikator_id', user.id)
        .limit(1);

      if (codes && codes.length > 0) {
        // Count pending merchants using this code
        const { count } = await supabase
          .from('merchants')
          .select('*', { count: 'exact', head: true })
          .eq('verifikator_code', codes[0].code)
          .eq('registration_status', 'PENDING');
        
        setPendingMerchants(count || 0);
      }
    };
    fetchPending();
  }, [user]);

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/verifikator', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Merchant', href: '/verifikator/merchants', icon: <Store className="h-4 w-4" />, badge: pendingMerchants },
    { label: 'Pendapatan', href: '/verifikator/earnings', icon: <Wallet className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Verifikator</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
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
