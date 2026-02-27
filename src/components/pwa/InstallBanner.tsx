import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';
import { Link } from 'react-router-dom';

export function InstallBanner() {
  const { canInstall, isInstalled, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner before
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      const dismissedDate = new Date(wasDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }

    // Delay showing banner
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      handleDismiss();
    }
  };

  // Don't show if already installed, dismissed, or not ready
  if (isInstalled || dismissed || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-[480px] mx-auto z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">Install Aplikasi DesaMart</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Akses lebih cepat langsung dari homescreen
            </p>
            <div className="flex gap-2 mt-3">
              {canInstall ? (
                <Button size="sm" onClick={handleInstall} className="text-xs h-8">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Install
                </Button>
              ) : (
                <Link to="/install">
                  <Button size="sm" className="text-xs h-8">
                    Cara Install
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs h-8">
                Nanti
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
