import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles, Flame, TrendingUp } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { CategoryIcon } from '@/components/CategoryIcon';
import { VillageCard } from '@/components/VillageCard';
import { ProductCard } from '@/components/ProductCard';
import { TourismCard } from '@/components/TourismCard';
import { 
  heroImage, 
  fetchProducts, 
  fetchVillages, 
  fetchTourism,
  categories 
} from '@/lib/api';
import type { Product, Village, Tourism } from '@/types';

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, villagesData, tourismData] = await Promise.all([
          fetchProducts(),
          fetchVillages(),
          fetchTourism(),
        ]);
        setProducts(productsData);
        setVillages(villagesData);
        setTourismSpots(tourismData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const promoProducts = products.filter(p => p.isPromo);
  // Sort tourism by view count for "popular" effect
  const popularTourism = [...tourismSpots].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero Banner - Enhanced */}
        <section className="relative h-44 overflow-hidden">
          <img 
            src={heroImage} 
            alt="Desa Wisata"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent flex items-center">
            <div className="px-5">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="bg-primary/20 text-primary-foreground text-[9px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                    🌾 Produk Desa Asli
                  </span>
                </div>
                <h2 className="text-primary-foreground font-bold text-xl leading-tight">
                  Jelajahi Produk<br />Asli Desa
                </h2>
                <p className="text-primary-foreground/80 text-xs mt-1.5 max-w-[200px]">
                  Dukung UMKM lokal & ekonomi desa Indonesia
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl mt-3 hover:bg-brand-dark transition shadow-brand"
                >
                  Belanja Sekarang
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Categories - Enhanced with gradient background */}
        <section className="mt-4 px-5">
          <div className="flex justify-between gap-2 overflow-x-auto hide-scrollbar pb-2">
            {categories.map((cat) => (
              <CategoryIcon key={cat.id} {...cat} />
            ))}
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Popular Tourism - Right after categories */}
            {popularTourism.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Flame className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-foreground">Wisata Populer</h2>
                      <p className="text-[9px] text-muted-foreground">Destinasi favorit pengunjung</p>
                    </div>
                  </div>
                  <Link 
                    to="/tourism"
                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                  >
                    Semua
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {popularTourism.slice(0, 2).map((tourism, idx) => (
                    <TourismCard key={tourism.id} tourism={tourism} index={idx} />
                  ))}
                </div>
              </section>
            )}

            {/* Promo Products */}
            {promoProducts.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gradient-to-br from-rose-400 to-pink-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-foreground">Promo Spesial</h2>
                    <p className="text-[9px] text-muted-foreground">Hemat lebih banyak hari ini</p>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                  {promoProducts.map((product, idx) => (
                    <div key={product.id} className="min-w-[160px]">
                      <ProductCard product={product} index={idx} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Product Grid - Rekomendasi with Category Badges */}
            {products.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex items-center gap-2 mb-4 sticky top-0 z-20 bg-background/95 backdrop-blur py-3 -mx-5 px-5 border-b border-border">
                  <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-foreground">Rekomendasi Pilihan</h2>
                    <p className="text-[9px] text-muted-foreground">Produk terbaik dari desa</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pb-4">
                  {products.map((product, idx) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      index={idx} 
                      showCategoryBadge={true}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Explore Villages - At the bottom */}
            {villages.length > 0 && (
              <section className="mt-4 px-5 pb-6">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                      <span className="text-sm">🏘️</span>
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-foreground">Jelajahi Desa</h2>
                      <p className="text-[9px] text-muted-foreground">Temukan desa wisata menarik</p>
                    </div>
                  </div>
                  <Link 
                    to="/explore"
                    className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
                  >
                    Semua
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                  {villages.map((village) => (
                    <VillageCard key={village.id} village={village} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
