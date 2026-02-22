import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Camera, ShoppingBag } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { BottomNav } from '../components/layout/BottomNav';
import { FloatingCartButton } from '../components/layout/FloatingCartButton';
import { SearchBarAdvanced } from '../components/explore/SearchBarAdvanced';
import { VillageCardLarge } from '../components/explore/VillageCardLarge';
import { TourismCardCompact } from '../components/explore/TourismCardCompact';
import { ProductCardHorizontal } from '../components/explore/ProductCardHorizontal';
import { SectionHeader } from '../components/explore/SectionHeader';
import { CategoryTabs, ExploreCategory } from '../components/explore/CategoryTabs';
import { FilterSheet, FilterButton, FilterOptions } from '../components/explore/FilterSheet';
import { SortDropdown, SortOption } from '../components/explore/SortDropdown';
import { EmptyState } from '../components/explore/EmptyState';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { fetchVillages, fetchTourism, fetchProducts } from '../lib/api';
import type { Village, Tourism, Product } from '../types';

const ITEMS_PER_PAGE = 10;
const POPULAR_SEARCHES = ['Kopi Arabika', 'Batik Tulis', 'Wisata Alam', 'Keripik Singkong', 'Anyaman Bambu'];

export default function ExplorePage() {
  const navigate = useNavigate();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  
  const [villages, setVillages] = useState<Village[]>([]);
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExploreCategory>('all');
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    priceRange: null,
    districts: [],
    minRating: null,
  });
  
  // Pagination state
  const [displayedProducts, setDisplayedProducts] = useState(ITEMS_PER_PAGE);
  const [displayedTourism, setDisplayedTourism] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayedProducts(ITEMS_PER_PAGE);
    setDisplayedTourism(ITEMS_PER_PAGE);
  }, [searchQuery, activeCategory, filters, sortOption]);

  // Get available districts for filter
  const availableDistricts = useMemo(() => {
    const districts = new Set<string>();
    villages.forEach(v => v.district && districts.add(v.district));
    return Array.from(districts).slice(0, 10);
  }, [villages]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    let filteredVillages = villages.filter(v => 
      v.name.toLowerCase().includes(query) ||
      v.district?.toLowerCase().includes(query) ||
      v.regency?.toLowerCase().includes(query)
    );
    
    if (filters.districts.length > 0) {
      filteredVillages = filteredVillages.filter(v => 
        filters.districts.some(d => v.district?.toLowerCase().includes(d.toLowerCase()))
      );
    }
    
    const filteredTourism = tourismSpots.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.villageName?.toLowerCase().includes(query)
    );
    
    let filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.merchantName?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
    
    if (filters.priceRange) {
      filteredProducts = filteredProducts.filter(p => 
        p.price >= filters.priceRange![0] && p.price <= filters.priceRange![1]
      );
    }

    // Sort products
    switch (sortOption) {
      case 'price_low':
        filteredProducts.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        filteredProducts.sort((a, b) => b.price - a.price);
        break;
    }

    return { 
      villages: filteredVillages, 
      tourism: filteredTourism, 
      products: filteredProducts 
    };
  }, [villages, tourismSpots, products, searchQuery, filters, sortOption]);

  const showVillages = activeCategory === 'all' || activeCategory === 'villages';
  const showTourism = activeCategory === 'all' || activeCategory === 'tourism';
  const showProducts = activeCategory === 'all' || activeCategory === 'products';

  const hasResults = 
    (showVillages && filteredData.villages.length > 0) ||
    (showTourism && filteredData.tourism.length > 0) ||
    (showProducts && filteredData.products.length > 0);

  const activeFilterCount = 
    (filters.priceRange ? 1 : 0) + 
    (filters.districts.length > 0 ? 1 : 0) + 
    (filters.minRating ? 1 : 0);

  const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      addToHistory(query);
      // Optionally navigate to dedicated search page
      // navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Infinite scroll handlers
  const hasMoreProducts = displayedProducts < filteredData.products.length;
  const hasMoreTourism = displayedTourism < filteredData.tourism.length;

  const loadMoreProducts = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedProducts(prev => Math.min(prev + ITEMS_PER_PAGE, filteredData.products.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, filteredData.products.length]);

  const loadMoreTourism = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayedTourism(prev => Math.min(prev + ITEMS_PER_PAGE, filteredData.tourism.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, filteredData.tourism.length]);

  const { lastElementRef: lastProductRef } = useInfiniteScroll({
    hasMore: hasMoreProducts,
    isLoading: isLoadingMore,
    onLoadMore: loadMoreProducts,
  });

  const { lastElementRef: lastTourismRef } = useInfiniteScroll({
    hasMore: hasMoreTourism,
    isLoading: isLoadingMore,
    onLoadMore: loadMoreTourism,
  });

  // Paginated data
  const paginatedProducts = filteredData.products.slice(0, displayedProducts);
  const paginatedTourism = filteredData.tourism.slice(0, displayedTourism);

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Search & Filter Section */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/30">
          {/* Search + Filter + Sort in one row */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <SearchBarAdvanced 
              placeholder="Cari desa, wisata, atau produk..." 
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearchSubmit}
              history={history}
              onHistoryRemove={removeFromHistory}
              onHistoryClear={clearHistory}
              popularSearches={POPULAR_SEARCHES}
            />
            <FilterButton onClick={() => setIsFilterOpen(true)} activeCount={activeFilterCount} />
            <SortDropdown value={sortOption} onChange={setSortOption} />
          </div>
          
          {/* Category Tabs - Below */}
          <div className="px-4 pb-2">
            <CategoryTabs 
              activeCategory={activeCategory} 
              onCategoryChange={setActiveCategory} 
            />
          </div>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mb-4" />
            <p className="text-muted-foreground text-sm">Memuat data...</p>
          </div>
        ) : !hasResults ? (
          <EmptyState 
            title={searchQuery ? "Tidak ditemukan" : "Belum ada data"}
            description={searchQuery 
              ? `Tidak ada hasil untuk "${searchQuery}"`
              : "Data belum tersedia saat ini"
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeCategory + searchQuery}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4 space-y-6"
            >
              {/* Villages Section */}
              {showVillages && filteredData.villages.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <SectionHeader 
                    title="Desa Wisata"
                    subtitle={`${filteredData.villages.length} desa tersedia`}
                    icon={<MapPin className="h-4 w-4" />}
                  />
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
                    {filteredData.villages.map((village, idx) => (
                      <VillageCardLarge key={village.id} village={village} index={idx} />
                    ))}
                  </div>
                </motion.section>
              )}
              
              {/* Tourism Section with Infinite Scroll */}
              {showTourism && filteredData.tourism.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <SectionHeader 
                    title="Destinasi Wisata"
                    subtitle={`${filteredData.tourism.length} tempat wisata`}
                    href="/tourism"
                    icon={<Camera className="h-4 w-4" />}
                  />
                  <div className="space-y-3">
                    {paginatedTourism.map((tourism, idx) => (
                      <div
                        key={tourism.id}
                        ref={idx === paginatedTourism.length - 1 && activeCategory === 'tourism' ? lastTourismRef : null}
                      >
                        <TourismCardCompact tourism={tourism} index={idx} />
                      </div>
                    ))}
                    {hasMoreTourism && activeCategory === 'tourism' && (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                  </div>
                </motion.section>
              )}
              
              {/* Products Section with Infinite Scroll */}
              {showProducts && filteredData.products.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <SectionHeader 
                    title="Produk UMKM"
                    subtitle={`${filteredData.products.length} produk pilihan`}
                    href="/products"
                    icon={<ShoppingBag className="h-4 w-4" />}
                  />
                  <div className="space-y-3">
                    {paginatedProducts.map((product, idx) => (
                      <div
                        key={product.id}
                        ref={idx === paginatedProducts.length - 1 && activeCategory === 'products' ? lastProductRef : null}
                      >
                        <ProductCardHorizontal product={product} index={idx} />
                      </div>
                    ))}
                    {hasMoreProducts && activeCategory === 'products' && (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                  </div>
                </motion.section>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      
      <FilterSheet 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApplyFilters={setFilters}
        availableDistricts={availableDistricts}
      />
      
      <FloatingCartButton />
      <BottomNav />
    </div>
  );
}
