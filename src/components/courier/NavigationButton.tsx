import { Navigation, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavigationButtonProps {
  lat: number;
  lng: number;
  address?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function NavigationButton({ 
  lat, 
  lng, 
  address,
  variant = 'default',
  size = 'default',
  className 
}: NavigationButtonProps) {
  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const openWaze = () => {
    const url = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(url, '_blank');
  };

  const openAppleMaps = () => {
    const url = `http://maps.apple.com/?daddr=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const openOSM = () => {
    const url = `https://www.openstreetmap.org/directions?engine=graphhopper_car&route=;${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Navigation className="h-4 w-4 mr-2" />
          Navigasi
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={openGoogleMaps} className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">Google Maps</p>
              <p className="text-xs text-muted-foreground">Buka di Google Maps</p>
            </div>
            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={openWaze} className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-info/10 rounded-full flex items-center justify-center">
              <Navigation className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="font-medium">Waze</p>
              <p className="text-xs text-muted-foreground">Navigasi real-time</p>
            </div>
            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={openAppleMaps} className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Apple Maps</p>
              <p className="text-xs text-muted-foreground">Untuk perangkat iOS</p>
            </div>
            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={openOSM} className="cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center">
              <MapPin className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="font-medium">OpenStreetMap</p>
              <p className="text-xs text-muted-foreground">Peta terbuka</p>
            </div>
            <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
          </div>
        </DropdownMenuItem>

        {address && (
          <div className="px-2 py-2 border-t border-border mt-1">
            <p className="text-xs text-muted-foreground line-clamp-2">{address}</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
