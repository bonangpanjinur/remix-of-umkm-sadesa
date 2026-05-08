import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Package, Tag,
  Users, Truck, Archive, BarChart3, UserCog, Settings,
  ChevronLeft, Store, RotateCcw, ShoppingBag, Wallet,
  TrendingUp, UserCheck, BoxesIcon, PieChart,
  ArrowRightLeft, GitCompare, Shield, KeyRound,
  Ticket, Star, Globe, Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOS } from '@/contexts/POSContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export function POSSidebar() {
  const location = useLocation();
  const { tenant, outlets, activeOutlet, setActiveOutlet } = usePOS();

  const menuItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/pos', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Kasir (POS)', href: '/pos/kasir', icon: <ShoppingCart className="h-4 w-4" /> },
    { label: 'Transaksi', href: '/pos/transaksi', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Retur', href: '/pos/retur', icon: <RotateCcw className="h-4 w-4" /> },
    { label: 'Pembelian', href: '/pos/pembelian', icon: <ShoppingBag className="h-4 w-4" /> },
    { label: 'Kas Harian', href: '/pos/kas', icon: <Wallet className="h-4 w-4" /> },
    { label: 'Produk', href: '/pos/produk', icon: <Package className="h-4 w-4" /> },
    { label: 'Kategori', href: '/pos/kategori', icon: <Tag className="h-4 w-4" /> },
    { label: 'Customer', href: '/pos/customer', icon: <Users className="h-4 w-4" /> },
    { label: 'Supplier', href: '/pos/supplier', icon: <Truck className="h-4 w-4" /> },
    { label: 'Stok', href: '/pos/stok', icon: <Archive className="h-4 w-4" /> },
    { label: 'Lap. Penjualan', href: '/pos/laporan', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Lap. Laba Rugi', href: '/pos/laporan/laba-rugi', icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Lap. Per Kasir', href: '/pos/laporan/kasir', icon: <UserCheck className="h-4 w-4" /> },
    { label: 'Lap. Stok', href: '/pos/laporan/stok', icon: <BoxesIcon className="h-4 w-4" /> },
    { label: 'Lap. Cashflow', href: '/pos/laporan/cashflow', icon: <Banknote className="h-4 w-4" /> },
    { label: 'Analitik Pelanggan', href: '/pos/analitik', icon: <PieChart className="h-4 w-4" /> },
    { label: 'Analitik Produk', href: '/pos/analitik-produk', icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Transfer Stok', href: '/pos/transfer-stok', icon: <ArrowRightLeft className="h-4 w-4" /> },
    { label: 'Lap. Outlet', href: '/pos/laporan/outlet', icon: <GitCompare className="h-4 w-4" /> },
    { label: 'Audit Trail', href: '/pos/audit', icon: <Shield className="h-4 w-4" /> },
    { label: 'Manajemen Akses', href: '/pos/akses', icon: <KeyRound className="h-4 w-4" /> },
    { label: 'Promosi & Voucher', href: '/pos/promosi', icon: <Ticket className="h-4 w-4" /> },
    { label: 'Program Loyalty', href: '/pos/loyalty', icon: <Star className="h-4 w-4" /> },
    { label: 'Integrasi Marketplace', href: '/pos/integrasi', icon: <Globe className="h-4 w-4" /> },
    { label: 'Pengguna', href: '/pos/pengguna', icon: <UserCog className="h-4 w-4" /> },
    { label: 'Pengaturan', href: '/pos/pengaturan', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="w-64 h-screen bg-card border-r border-border flex flex-col sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Store className="h-5 w-5 text-emerald-600" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{tenant?.name || 'DesaMart POS'}</p>
            <p className="text-xs text-muted-foreground">Sistem Kasir UMKM</p>
          </div>
        </div>
        {outlets.length > 1 && (
          <Select
            value={activeOutlet?.id}
            onValueChange={(val) => {
              const outlet = outlets.find(o => o.id === val);
              if (outlet) setActiveOutlet(outlet);
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Pilih outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets.map(o => (
                <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {outlets.length === 1 && activeOutlet && (
          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded truncate">
            📍 {activeOutlet.name}
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = item.href === '/pos'
            ? location.pathname === '/pos'
            : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-600 text-white'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.label}
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-white/20 text-white' : 'bg-destructive text-white'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Kembali ke Marketplace
        </Link>
      </div>
    </div>
  );
}
