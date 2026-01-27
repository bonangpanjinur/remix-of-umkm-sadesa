import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  ChevronLeft,
  Bike
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function CourierSidebar() {
  const location = useLocation();

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/courier', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Pendapatan', href: '/courier/earnings', icon: <Wallet className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bike className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Dashboard Kurir</span>
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
