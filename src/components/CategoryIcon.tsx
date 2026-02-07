import { Link } from 'react-router-dom';
import { UtensilsCrossed, Shirt, Shapes, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  utensils: UtensilsCrossed,
  shirt: Shirt,
  shapes: Shapes,
  'map-location-dot': MapPin,
};

interface CategoryIconProps {
  id: string;
  name: string;
  icon: string;
  colorClass: string;
}

export function CategoryIcon({ id, name, icon, colorClass }: CategoryIconProps) {
  const Icon = icons[icon] || Package;
  
  return (
    <Link
      to={id === 'wisata' ? '/tourism' : `/products?category=${id}`}
      className="flex flex-col items-center gap-1.5 min-w-[60px] cursor-pointer group"
    >
      <div 
        className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center border transition shadow-sm',
          'group-hover:scale-105 group-active:scale-95',
          colorClass
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
    </Link>
  );
}
