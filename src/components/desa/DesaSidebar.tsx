import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Mountain, ChevronLeft, Home,
  TrendingUp, Calendar, Award, Megaphone, Map, BarChart3,
  ShieldCheck, Building2, Package, User, DollarSign
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

export function DesaSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [pendingMerchants, setPendingMerchants] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchPending = async () => {
      const { data: uv } = await supabase
        .from('user_villages')
        .select('village_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!uv?.village_id) return;

      const { count } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true })
        .eq('village_id', uv.village_id)
        .eq('registration_status', 'PENDING');
      setPendingMerchants(count || 0);
    };

    fetchPending();

    // P1.2: Real-time badge — update saat ada merchant baru daftar atau diapprove
    const channel = supabase
      .channel('desa-sidebar-merchants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'merchants' }, () => {
        fetchPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard',           href: '/desa',                     icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Profil Desa',         href: '/desa/profil',              icon: <Building2 className="h-4 w-4" /> },
    { label: 'Destinasi Wisata',    href: '/desa/tourism',             icon: <Mountain className="h-4 w-4" /> },
    { label: 'Paket Wisata',        href: '/desa/paket-wisata',        icon: <Package className="h-4 w-4" /> },
    { label: 'Pemandu Wisata',      href: '/desa/pemandu',             icon: <User className="h-4 w-4" /> },
    { label: 'Verifikasi Merchant', href: '/desa/merchants',           icon: <ShieldCheck className="h-4 w-4" />, badge: pendingMerchants },
    { label: 'Laporan Keuangan',    href: '/desa/laporan-keuangan',    icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Laporan Ekonomi',     href: '/desa/ekonomi',             icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Event Desa',          href: '/desa/event',               icon: <Calendar className="h-4 w-4" /> },
    { label: 'Keanggotaan UMKM',    href: '/desa/keanggotaan',         icon: <Award className="h-4 w-4" /> },
    { label: 'Broadcast',           href: '/desa/broadcast',           icon: <Megaphone className="h-4 w-4" /> },
    { label: 'Peta Interaktif',     href: '/desa/peta',                icon: <Map className="h-4 w-4" /> },
    { label: 'Laporan Wisata',      href: '/desa/laporan-wisata',      icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 h-screen bg-card border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Home className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Admin Desa</span>
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
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
