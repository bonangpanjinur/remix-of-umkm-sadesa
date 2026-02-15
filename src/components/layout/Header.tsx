import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Leaf, Search } from 'lucide-react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { InstallButton } from '@/components/pwa/InstallButton';
import { useWhitelabel } from '@/hooks/useWhitelabel';

export function Header() {
  const { settings } = useWhitelabel();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const isHomepage = location.pathname === '/';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="bg-card sticky top-0 z-40 shadow-md px-5 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt={settings.siteName} 
              className="w-8 h-8 rounded-xl object-cover shadow-brand"
            />
          ) : (
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-primary-foreground text-sm shadow-brand">
              <Leaf className="h-4 w-4" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-sm leading-none text-foreground">
              {settings.siteName}
            </h1>
            <p className="text-[9px] text-muted-foreground font-medium tracking-wide">
              {settings.siteTagline}
            </p>
          </div>
        </Link>
        
        <div className="flex items-center gap-2">
          <InstallButton />
          <NotificationDropdown />
        </div>
      </div>

      {/* Search Bar - Homepage only */}
      {isHomepage && (
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari produk, toko, atau kategori..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
          />
        </form>
      )}
    </header>
  );
}
