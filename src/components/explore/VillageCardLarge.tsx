import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Village } from '@/types';

interface VillageCardLargeProps {
  village: Village;
  index?: number;
}

export function VillageCardLarge({ village, index = 0 }: VillageCardLargeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link
        to={`/village/${village.name.toLowerCase().replace(/\s+/g, '-')}`}
        className="block min-w-[260px] h-44 rounded-2xl overflow-hidden relative shadow-lg cursor-pointer group flex-shrink-0"
      >
        <img 
          src={village.image} 
          alt={village.name}
          className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/40 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-primary-foreground font-bold text-lg leading-tight">
                {village.name}
              </h3>
              <div className="flex items-center gap-1 text-primary-foreground/80 text-xs mt-1">
                <MapPin className="h-3 w-3" />
                {village.district}, {village.regency}
              </div>
              {village.description && (
                <p className="text-primary-foreground/70 text-xs mt-2 line-clamp-2">
                  {village.description}
                </p>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
              <ArrowRight className="h-4 w-4 text-primary-foreground group-hover:text-primary-foreground" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
