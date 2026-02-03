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
  Smartphone,
  Palette,
  Shield,
  Database,
  Globe,
  Tags,
  Clock,
  Wallet
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
}

export function AdminSidebar({ pendingMerchants = 0, pendingVillages = 0, pendingCouriers = 0, pendingOrders = 0, pendingRefunds = 0, pendingWithdrawals = 0, pendingVerifikatorWithdrawals = 0 }: AdminSidebarProps) {
  const location = useLocation();

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Pesanan', href: '/admin/orders', icon: <Receipt className="h-4 w-4" />, badge: pendingOrders },
    { label: 'Pengguna', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
    { label: 'Role & Permission', href: '/admin/roles', icon: <Shield className="h-4 w-4" /> },
    { label: 'Merchant', href: '/admin/merchants', icon: <Store className="h-4 w-4" />, badge: pendingMerchants },
    { label: 'Desa Wisata', href: '/admin/villages', icon: <MapPin className="h-4 w-4" />, badge: pendingVillages },
    { label: 'Kurir', href: '/admin/couriers', icon: <Bike className="h-4 w-4" />, badge: pendingCouriers },
    { label: 'Paket Transaksi', href: '/admin/packages', icon: <Package className="h-4 w-4" /> },
    { label: 'Pengaturan Kuota', href: '/admin/quota-settings', icon: <Settings className="h-4 w-4" /> },
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
    { label: 'Layout Homepage', href: '/admin/homepage-layout', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Backup Data', href: '/admin/backup', icon: <Database className="h-4 w-4" /> },
    { label: 'Backup Terjadwal', href: '/admin/scheduled-backup', icon: <Clock className="h-4 w-4" /> },
    { label: 'SEO Settings', href: '/admin/seo', icon: <Globe className="h-4 w-4" /> },
    { label: 'System Logs', href: '/admin/logs', icon: <ScrollText className="h-4 w-4" /> },
    { label: 'PWA Settings', href: '/admin/pwa', icon: <Smartphone className="h-4 w-4" /> },
    { label: 'Whitelabel', href: '/admin/whitelabel', icon: <Palette className="h-4 w-4" /> },
    { label: 'Pengaturan', href: '/admin/settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Admin Panel</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/admin' && location.pathname.startsWith(item.href));
          
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

      {/* Back to App */}
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
