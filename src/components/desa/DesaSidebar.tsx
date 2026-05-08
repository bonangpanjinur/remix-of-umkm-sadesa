import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Mountain, Store, ChevronLeft, Home,
  TrendingUp, Calendar, Award, Megaphone, Map, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function DesaSidebar() {
  const location = useLocation();

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard',          href: '/desa',                    icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Wisata',             href: '/desa/tourism',            icon: <Mountain className="h-4 w-4" /> },
    { label: 'Laporan Ekonomi',    href: '/desa/ekonomi',            icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Event Desa',         href: '/desa/event',              icon: <Calendar className="h-4 w-4" /> },
    { label: 'Keanggotaan UMKM',   href: '/desa/keanggotaan',        icon: <Award className="h-4 w-4" /> },
    { label: 'Broadcast',          href: '/desa/broadcast',          icon: <Megaphone className="h-4 w-4" /> },
    { label: 'Peta Interaktif',    href: '/desa/peta',               icon: <Map className="h-4 w-4" /> },
    { label: 'Laporan Wisata',     href: '/desa/laporan-wisata',     icon: <BarChart3 className="h-4 w-4" /> },
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
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
