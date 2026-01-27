import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { SearchBar } from '@/components/ui/SearchBar';
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
  const [searchQuery, setSearchQuery] = useState('');
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

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      {/* Search Bar */}
      <div className="px-5 py-3 bg-card border-b border-border">
        <SearchBar 
          value={searchQuery} 
          onChange={setSearchQuery}
          placeholder="Cari keripik, kopi, atau desa..."
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero Banner */}
        <section className="relative h-40 overflow-hidden">
          <img 
            src={heroImage} 
            alt="Desa Wisata"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 to-transparent flex items-center">
            <div className="px-5">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-primary-foreground font-bold text-xl leading-tight">
                  Jelajahi Produk<br />Asli Desa
                </h2>
                <p className="text-primary-foreground/80 text-xs mt-1">
                  Dukung UMKM lokal Indonesia
                </p>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg mt-3 hover:bg-brand-dark transition shadow-brand"
                >
                  Belanja Sekarang
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Categories */}
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
            {/* Explore Villages */}
            {villages.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-sm text-foreground">Jelajahi Desa</h2>
                  <Link 
                    to="/explore"
                    className="text-[10px] text-primary font-bold hover:underline"
                  >
                    Lihat Semua
                  </Link>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                  {villages.map((village) => (
                    <VillageCard key={village.id} village={village} />
                  ))}
                </div>
              </section>
            )}

            {/* Promo Products */}
            {promoProducts.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-destructive/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-destructive" />
                  </div>
                  <h2 className="font-bold text-sm text-foreground">Promo Spesial</h2>
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

            {/* Tourism Spots */}
            {tourismSpots.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-bold text-sm text-foreground">Wisata Populer</h2>
                  <Link 
                    to="/tourism"
                    className="text-[10px] text-primary font-bold hover:underline"
                  >
                    Lihat Semua
                  </Link>
                </div>
                <div className="space-y-3">
                  {tourismSpots.slice(0, 2).map((tourism, idx) => (
                    <TourismCard key={tourism.id} tourism={tourism} index={idx} />
                  ))}
                </div>
              </section>
            )}

            {/* Product Grid */}
            {products.length > 0 && (
              <section className="mt-6 px-5">
                <div className="flex items-center gap-2 mb-4 sticky top-0 z-20 bg-background/95 backdrop-blur py-2 -mx-5 px-5 border-b border-border">
                  <h2 className="font-bold text-sm text-foreground">Rekomendasi Pilihan</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 pb-6">
                  {products.map((product, idx) => (
                    <ProductCard key={product.id} product={product} index={idx} />
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
