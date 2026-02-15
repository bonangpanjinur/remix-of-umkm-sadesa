import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sparkles, Flame, TrendingUp, MapPin } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingCartButton } from '@/components/layout/FloatingCartButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useCategories } from '@/hooks/useCategories';
import { VillageCard } from '@/components/VillageCard';
import { ProductCard } from '@/components/ProductCard';
import { HeroCarousel, type BannerSlide } from '@/components/home/HeroCarousel';
import { TourismCarousel } from '@/components/home/TourismCarousel';
import { 
  fetchProducts, 
  fetchVillages, 
  fetchTourism,
} from '@/lib/api';
import { fetchBannerPromotions } from '@/lib/promotions';
import { useHomepageLayout } from '@/hooks/useHomepageLayout';
import { useUserLocation, sortByDistance } from '@/hooks/useUserLocation';
import type { Product, Village, Tourism } from '@/types';

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { 
    isSectionEnabled, 
    getEnabledSections, 
    isCategoryVisible, 
    loading: layoutLoading 
  } = useHomepageLayout();

  const { location: userLocation, loading: locationLoading } = useUserLocation();
  const { getHomepageCategories } = useCategories();

  useEffect(() => {
    async function loadData() {
      try {
        const [productsData, villagesData, tourismData, promotionsData] = await Promise.all([
          fetchProducts(),
          fetchVillages(),
          fetchTourism(),
          fetchBannerPromotions(),
        ]);
        setProducts(productsData);
        setVillages(villagesData);
        setTourismSpots(tourismData);
        
        // Transform promotions to banner slides
        const slides: BannerSlide[] = promotionsData.map(p => ({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          image: p.imageUrl,
          linkUrl: p.linkUrl,
        }));
        setBannerSlides(slides);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sort data by proximity to user location
  const sortedProducts = useMemo(() => {
    if (!userLocation) return products;
    return sortByDistance(products, userLocation.lat, userLocation.lng);
  }, [products, userLocation]);

  const sortedVillages = useMemo(() => {
    if (!userLocation) return villages;
    return sortByDistance(villages, userLocation.lat, userLocation.lng);
  }, [villages, userLocation]);

  const sortedTourism = useMemo(() => {
    if (!userLocation) return tourismSpots;
    return sortByDistance(tourismSpots, userLocation.lat, userLocation.lng);
  }, [tourismSpots, userLocation]);

  const promoProducts = sortedProducts.filter(p => p.isPromo);
  // Sort tourism by proximity first, then by view count
  const popularTourism = sortedTourism;
  
  // Filter categories based on admin settings - now dynamic from database
  const homepageCategories = getHomepageCategories();
  const visibleCategories = homepageCategories.filter(cat => isCategoryVisible(cat.id));

  // Build sections in order based on admin settings
  const enabledSections = getEnabledSections();

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero':
        return <HeroCarousel slides={bannerSlides} autoPlayInterval={5000} />;
      
      case 'categories':
        return visibleCategories.length > 0 ? (
          <section className="mt-4 px-5">
            <div className="flex justify-between gap-2 overflow-x-auto hide-scrollbar pb-2">
              {visibleCategories.map((cat) => (
                <CategoryIcon key={cat.id} {...cat} />
              ))}
            </div>
          </section>
        ) : null;
      
      case 'popular_tourism':
        return popularTourism.length > 0 ? (
          <section className="mt-6 px-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Flame className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-foreground">Wisata Terdekat</h2>
                  <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    {userLocation?.source === 'gps' ? 'Berdasarkan lokasi Anda' : 'Sekitar Anda'}
                  </p>
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
            <TourismCarousel tourismSpots={popularTourism} maxSlots={3} />
          </section>
        ) : null;
      
      case 'promo':
        return promoProducts.length > 0 ? (
          <section className="mt-6 px-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-rose-400 to-pink-500 rounded-lg flex items-center justify-center shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
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
        ) : null;
      
      case 'recommendations':
        return sortedProducts.length > 0 ? (
          <section className="mt-6 px-5">
            <div className="flex items-center gap-2 mb-4 sticky top-0 z-20 bg-background/95 backdrop-blur py-3 -mx-5 px-5 border-b border-border">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
                <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-foreground">Produk Terdekat</h2>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  {userLocation?.source === 'gps' ? 'Berdasarkan lokasi Anda' : 'Sekitar Anda'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {sortedProducts.map((product, idx) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  index={idx} 
                  showCategoryBadge={true}
                />
              ))}
            </div>
          </section>
        ) : null;
      
      case 'villages':
        return sortedVillages.length > 0 ? (
          <section className="mt-4 px-5 pb-6">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-sm">🏘️</span>
                </div>
                <div>
                  <h2 className="font-bold text-sm text-foreground">Desa Terdekat</h2>
                  <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    {userLocation?.source === 'gps' ? 'Berdasarkan lokasi Anda' : 'Sekitar Anda'}
                  </p>
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
              {sortedVillages.map((village) => (
                <VillageCard key={village.id} village={village} />
              ))}
            </div>
          </section>
        ) : null;
      
      default:
        return null;
    }
  };

  const isLoading = loading || layoutLoading;

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="space-y-4">
            {/* Hero Skeleton */}
            <div className="h-44 bg-muted animate-pulse rounded-b-2xl" />
            {/* Category Pills Skeleton */}
            <div className="flex gap-2 px-5 overflow-hidden">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                  <div className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
                  <div className="w-10 h-2 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
            {/* Section Header Skeleton */}
            <div className="px-5 flex items-center gap-2 mt-2">
              <div className="w-7 h-7 bg-muted animate-pulse rounded-lg" />
              <div className="w-28 h-4 bg-muted animate-pulse rounded" />
            </div>
            {/* Product Grid Skeleton */}
            <div className="grid grid-cols-2 gap-3 px-5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="h-32 bg-muted animate-pulse" />
                  <div className="p-2.5 space-y-2">
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      <div className="h-6 w-6 bg-muted animate-pulse rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {enabledSections.map((section) => (
              <div key={section.id}>
                {renderSection(section.id)}
              </div>
            ))}
          </>
        )}
      </div>

      <FloatingCartButton />
      <BottomNav />
    </div>
  );
};

export default Index;
