import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { VillageCard } from '@/components/VillageCard';
import { TourismCard } from '@/components/TourismCard';
import { ProductCard } from '@/components/ProductCard';
import { fetchVillages, fetchTourism, fetchProducts } from '@/lib/api';
import type { Village, Tourism, Product } from '@/types';

export default function ExplorePage() {
  const [villages, setVillages] = useState<Village[]>([]);
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [villagesData, tourismData, productsData] = await Promise.all([
          fetchVillages(),
          fetchTourism(),
          fetchProducts(),
        ]);
        setVillages(villagesData);
        setTourismSpots(tourismData);
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading data:', error);
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
          <h1 className="text-xl font-bold text-foreground mb-1">Jelajahi</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Temukan desa, wisata, dan produk UMKM
          </p>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Villages */}
              {villages.length > 0 && (
                <section className="mb-6">
                  <h2 className="font-bold text-sm text-foreground mb-3">Desa Wisata</h2>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                    {villages.map(village => (
                      <VillageCard key={village.id} village={village} />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Tourism */}
              {tourismSpots.length > 0 && (
                <section className="mb-6">
                  <h2 className="font-bold text-sm text-foreground mb-3">Destinasi Wisata</h2>
                  <div className="space-y-3">
                    {tourismSpots.map((tourism, idx) => (
                      <TourismCard key={tourism.id} tourism={tourism} index={idx} />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Products */}
              {products.length > 0 && (
                <section>
                  <h2 className="font-bold text-sm text-foreground mb-3">Produk Pilihan</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {products.slice(0, 4).map((product, idx) => (
                      <ProductCard key={product.id} product={product} index={idx} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </motion.div>
      </div>
      
      <BottomNav />
    </div>
  );
}
