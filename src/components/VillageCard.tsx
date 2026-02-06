import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { Village } from '@/types';

interface VillageCardProps {
  village: Village;
}

export function VillageCard({ village }: VillageCardProps) {
  return (
    <Link
      to={`/village/${village.name.toLowerCase().replace(/\s+/g, '-')}`}
      className="min-w-[200px] h-32 rounded-2xl overflow-hidden relative shadow-sm cursor-pointer group flex-shrink-0"
    >
      <img 
        src={village.image} 
        alt={village.name}
        className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent p-3 flex flex-col justify-end">
        <h3 className="text-primary-foreground font-bold text-xs">{village.name}</h3>
        <div className="flex items-center gap-1 text-primary-foreground/70 text-[9px] mt-0.5">
          <MapPin className="h-2.5 w-2.5" />
          {village.district}, {village.regency}
        </div>
      </div>
    </Link>
  );
}
