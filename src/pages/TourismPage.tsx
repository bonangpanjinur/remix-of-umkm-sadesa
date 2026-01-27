import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { TourismCard } from '@/components/TourismCard';
import { fetchTourism } from '@/lib/api';
import type { Tourism } from '@/types';

export default function TourismPage() {
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchTourism();
        setTourismSpots(data);
      } catch (error) {
        console.error('Error loading tourism:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 py-4"
        >
          <h1 className="text-xl font-bold text-foreground mb-1">Wisata Desa</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Jelajahi destinasi wisata alam dan budaya
          </p>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : tourismSpots.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Belum ada wisata tersedia</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tourismSpots.map((tourism, idx) => (
                <TourismCard key={tourism.id} tourism={tourism} index={idx} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
      
      <BottomNav />
    </div>
  );
}
