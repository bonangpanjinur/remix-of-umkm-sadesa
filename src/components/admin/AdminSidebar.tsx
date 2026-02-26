import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  MapPin, 
  Bike, 
  Megaphone, 
  Settings, 
  TicketCheck,
  ChevronLeft,
  ShieldCheck,
  Receipt,
  Users,
  FileText,
  RotateCcw,
  ScrollText,
  Package,
  Percent,
  DollarSign,
  Image,
  Bell,
  Shield,
  Database,
  Tags,
  Wallet,
  Activity,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface AdminSidebarProps {
  pendingMerchants?: number;
  pendingVillages?: number;
  pendingCouriers?: number;
  pendingOrders?: number;
  pendingRefunds?: number;
  pendingWithdrawals?: number;
  pendingVerifikatorWithdrawals?: number;
  onClose?: () => void;
}

export function AdminSidebar({ 
  pendingMerchants = 0, 
  pendingVillages = 0, 
  pendingCouriers = 0, 
  pendingOrders = 0, 
  pendingRefunds = 0, 
  pendingWithdrawals = 0, 
  pendingVerifikatorWithdrawals = 0,
  onClose 
}: AdminSidebarProps) {
  const location = useLocation();

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Pesanan', href: '/admin/orders', icon: <Receipt className="h-4 w-4" />, badge: pendingOrders },
    { label: 'Pengguna', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
    { label: 'Role & Permission', href: '/admin/roles', icon: <Shield className="h-4 w-4" /> },
    { label: 'Merchant', href: '/admin/merchants', icon: <Store className="h-4 w-4" />, badge: pendingMerchants },
    { label: 'Sertifikasi Halal', href: '/admin/halal', icon: <ShieldCheck className="h-4 w-4" /> },
    { label: 'Regulasi Halal', href: '/admin/halal-regulation', icon: <FileText className="h-4 w-4" /> },
    { label: 'Desa Wisata', href: '/admin/villages', icon: <MapPin className="h-4 w-4" />, badge: pendingVillages },
    { label: 'Kurir', href: '/admin/couriers', icon: <Bike className="h-4 w-4" />, badge: pendingCouriers },
    { label: 'Paket Kuota', href: '/admin/transaction-quota', icon: <Package className="h-4 w-4" /> },
    { label: 'Kategori Produk', href: '/admin/categories', icon: <Tags className="h-4 w-4" /> },
    { label: 'Komisi Verifikator', href: '/admin/verifikator-commissions', icon: <Percent className="h-4 w-4" />, badge: pendingVerifikatorWithdrawals },
    { label: 'WD Verifikator', href: '/admin/verifikator-withdrawals', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Penarikan Merchant', href: '/admin/withdrawals', icon: <RotateCcw className="h-4 w-4" />, badge: pendingWithdrawals },
    { label: 'Laporan Keuangan', href: '/admin/finance', icon: <DollarSign className="h-4 w-4" /> },
    { label: 'Refund', href: '/admin/refunds', icon: <RotateCcw className="h-4 w-4" />, badge: pendingRefunds },
    { label: 'Laporan', href: '/admin/reports', icon: <FileText className="h-4 w-4" /> },
    { label: 'Banner Homepage', href: '/admin/banners', icon: <Image className="h-4 w-4" /> },
    { label: 'Promosi', href: '/admin/promotions', icon: <Megaphone className="h-4 w-4" /> },
    { label: 'Broadcast', href: '/admin/broadcast', icon: <Bell className="h-4 w-4" /> },
    { label: 'Kode Verifikator', href: '/admin/codes', icon: <TicketCheck className="h-4 w-4" /> },
    { label: 'Backup Data', href: '/admin/backup', icon: <Database className="h-4 w-4" /> },
    { label: 'Kasir POS', href: '/admin/pos', icon: <Receipt className="h-4 w-4" /> },
    { label: 'System Logs', href: '/admin/logs', icon: <ScrollText className="h-4 w-4" /> },
    { label: 'Kesehatan Sistem', href: '/admin/system-health', icon: <Activity className="h-4 w-4" /> },
    { label: 'Pengaturan', href: '/admin/settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="w-full sm:w-64 h-screen bg-card border-r border-border flex flex-col sticky top-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm sm:text-lg truncate">Admin Panel</span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 hover:bg-secondary rounded-md transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 sm:p-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/admin' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors group",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="truncate hidden sm:inline">{item.label}</span>
                <span className="truncate sm:hidden">{item.label.substring(0, 3)}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  "text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ml-1",
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

      {/* Back to App */}
      <div className="p-2 sm:p-3 border-t border-border">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4 flex-shrink-0" />
          <span className="truncate hidden sm:inline">Kembali ke Aplikasi</span>
          <span className="truncate sm:hidden">Kembali</span>
        </Link>
      </div>
    </div>
  );
}
