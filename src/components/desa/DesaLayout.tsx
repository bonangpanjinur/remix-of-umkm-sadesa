import { ReactNode, useState } from 'react';
import { DesaSidebar } from './DesaSidebar';
import { Menu } from 'lucide-react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DesaLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DesaLayout({ children, title, subtitle, actions }: DesaLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transform transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <DesaSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header (Fixed) */}
        <div className="flex items-center justify-between p-4 lg:px-8 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold lg:text-xl truncate">{title}</h1>
              {subtitle && <p className="hidden lg:block text-muted-foreground text-xs">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <NotificationDropdown />
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
