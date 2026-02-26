import { ReactNode, useState, useEffect } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { fetchAdminStats } from '@/lib/adminApi';
import { Menu, X } from 'lucide-react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { clearAllSystemCache } from '@/lib/adminApi';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  rightElement?: ReactNode;
}

export function AdminLayout({ children, title, subtitle, rightElement }: AdminLayoutProps) {
  const [pendingMerchants, setPendingMerchants] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefreshCache = async () => {
    try {
      setIsRefreshing(true);
      
      // Clear TanStack Query cache
      await queryClient.invalidateQueries();
      
      // Clear local system caches
      await clearAllSystemCache();
      
      toast.success('Data sistem berhasil disegarkan');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Gagal menyegarkan data');
    } finally {
      setIsRefreshing(false);
    }
  };
  const [pendingVillages, setPendingVillages] = useState(0);
  const [pendingCouriers, setPendingCouriers] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [pendingVerifikatorWithdrawals, setPendingVerifikatorWithdrawals] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await fetchAdminStats();
        setPendingMerchants(stats.pendingMerchants);
        setPendingVillages(stats.pendingVillages);
        setPendingCouriers(stats.pendingCouriers);
        
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Fetch pending merchant withdrawals count
        const { count: merchantWithdrawals } = await supabase
          .from('withdrawal_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING');
        setPendingWithdrawals(merchantWithdrawals || 0);
        
        // Fetch pending verifikator withdrawals count
        const { count: verifikatorWithdrawals } = await supabase
          .from('verifikator_withdrawals')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING');
        setPendingVerifikatorWithdrawals(verifikatorWithdrawals || 0);

        // Fetch pending orders count
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'NEW');
        setPendingOrders(ordersCount || 0);

        // Fetch pending refunds count
        const { count: refundsCount } = await supabase
          .from('refund_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING');
        setPendingRefunds(refundsCount || 0);
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, []);

  // Close sidebar when window is resized to lg breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-full sm:w-64 lg:relative lg:z-0 lg:w-64 transform transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <AdminSidebar
          pendingMerchants={pendingMerchants}
          pendingVillages={pendingVillages}
          pendingCouriers={pendingCouriers}
          pendingOrders={pendingOrders}
          pendingRefunds={pendingRefunds}
          pendingWithdrawals={pendingWithdrawals}
          pendingVerifikatorWithdrawals={pendingVerifikatorWithdrawals}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header (Fixed) */}
        <div className="flex items-center justify-between p-3 sm:p-4 lg:px-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden h-8 w-8 sm:h-9 sm:w-9" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm sm:text-base lg:text-xl truncate">{title}</h1>
              {subtitle && <p className="hidden sm:block text-muted-foreground text-xs lg:text-sm">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-border bg-secondary text-secondary-foreground hover:scale-105 transition", isRefreshing && "animate-spin")}
              onClick={handleRefreshCache}
              disabled={isRefreshing}
              title="Segarkan Data"
              aria-label="Refresh data"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <div className="hidden sm:block">
              <NotificationDropdown />
            </div>
            {rightElement && <div className="hidden sm:block">{rightElement}</div>}
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 xl:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
