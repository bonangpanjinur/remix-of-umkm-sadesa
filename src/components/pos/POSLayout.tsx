import { ReactNode, useState } from 'react';
import { POSSidebar } from './POSSidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePOS } from '@/contexts/POSContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface POSLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  fullWidth?: boolean;
}

export function POSLayout({ children, title, subtitle, actions, fullWidth }: POSLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { tenant, loading } = usePOS();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Memuat data usaha...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🏪</div>
          <h2 className="text-xl font-bold mb-2">Buat Usaha Anda</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Anda belum memiliki usaha yang terdaftar di sistem POS. Buat usaha terlebih dahulu untuk mulai menggunakan kasir.
          </p>
          <Button
            onClick={() => navigate('/pos/pengaturan')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Buat Usaha Sekarang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={cn(
        'fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transform transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <POSSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <div className="flex items-center justify-between px-4 py-3 lg:px-6 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-semibold text-base lg:text-lg">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground hidden lg:block">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className={fullWidth ? 'w-full' : 'max-w-7xl mx-auto'}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
