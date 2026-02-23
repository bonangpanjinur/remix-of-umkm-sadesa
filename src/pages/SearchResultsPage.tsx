import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingCartButton } from '@/components/layout/FloatingCartButton';
import { SearchBar } from '@/components/ui/SearchBar';
import { ProductCard } from '@/components/ProductCard';
import { ProductCardHorizontal } from '@/components/explore/ProductCardHorizontal';
import { TourismCardCompact } from '@/components/explore/TourismCardCompact';
import { VillageCardLarge } from '@/components/explore/VillageCardLarge';
import { CategoryTabs, ExploreCategory } from '@/components/explore/CategoryTabs';
import { FilterSheet, FilterButton, FilterOptions } from '@/components/explore/FilterSheet';
import { SortDropdown, SortOption } from '@/components/explore/SortDropdown';
import { ViewToggle, ViewMode } from '@/components/explore/ViewToggle';
import { EmptyState } from '@/components/explore/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import type { Village, Tourism, Product } from '@/types';

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [villages, setVillages] = useState<Village[]>([]);
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<ExploreCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    priceRange: null,
    districts: [],
    minRating: null,
  });

  useEffect(() => {
    async function loadData() {
      if (!initialQuery || initialQuery.length < 2) {
        setLoading(false);
        return;
      }
      try {
        const searchTerm = `%${initialQuery}%`;
        const [productsRes, villagesRes, tourismRes] = await Promise.all([
          supabase.from('products').select('id, name, description, price, image_url, stock, category, is_active, is_promo, original_price, merchant_id, merchants(name, village_id, villages(name), location_lat, location_lng, is_open, halal_status)').ilike('name', searchTerm).eq('is_active', true).limit(50),
          supabase.from('villages').select('id, name, district, regency, description, image_url, is_active').ilike('name', searchTerm).eq('is_active', true).limit(20),
          supabase.from('tourism').select('id, name, description, image_url, village_id, villages(name), location_lat, location_lng, wa_link, facilities, is_active, view_count').ilike('name', searchTerm).eq('is_active', true).limit(20),
        ]);
        
        // Map to app types
        const mappedProducts: Product[] = (productsRes.data || []).map((p: any) => ({
          id: p.id, name: p.name, description: p.description || '', price: p.price, image: p.image_url || '/placeholder.svg',
          stock: p.stock || 0, category: p.category || '', isActive: p.is_active, isPromo: p.is_promo,
          originalPrice: p.original_price, merchantId: p.merchant_id, merchantName: p.merchants?.name || '',
          merchantVillage: p.merchants?.villages?.name || '',
          locationLat: p.merchants?.location_lat, locationLng: p.merchants?.location_lng,
          isMerchantOpen: p.merchants?.is_open, isAvailable: p.is_active && p.stock > 0,
          halal_status: p.merchants?.halal_status,
        }));
        const mappedVillages: Village[] = (villagesRes.data || []).map((v: any) => ({
          id: v.id, name: v.name, district: v.district || '', regency: v.regency || '',
          description: v.description || '', image: v.image_url || '/placeholder.svg', isActive: v.is_active,
        }));
        const mappedTourism: Tourism[] = (tourismRes.data || []).map((t: any) => ({
          id: t.id, name: t.name, description: t.description || '', image: t.image_url || '/placeholder.svg',
          villageId: t.village_id || '', villageName: t.villages?.name || '',
          locationLat: t.location_lat || 0, locationLng: t.location_lng || 0,
          waLink: t.wa_link || '', facilities: t.facilities || [], isActive: t.is_active,
          viewCount: t.view_count,
        }));
        setProducts(mappedProducts);
        setVillages(mappedVillages);
        setTourismSpots(mappedTourism);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialQuery]);

  // Update URL when search changes
  useEffect(() => {
    if (searchQuery) {
      setSearchParams({ q: searchQuery });
    } else {
      setSearchParams({});
    }
  }, [searchQuery, setSearchParams]);

  // Get available districts for filter
  const availableDistricts = useMemo(() => {
    const districts = new Set<string>();
    villages.forEach(v => v.district && districts.add(v.district));
    products.forEach(p => {
      const merchant = p.merchantName;
      if (merchant) districts.add(merchant);
    });
    return Array.from(districts).slice(0, 10);
  }, [villages, products]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    // Filter villages
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
    
    // Filter tourism
    let filteredTourism = tourismSpots.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.villageName?.toLowerCase().includes(query)
    );
    
    // Filter products
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
      case 'newest':
        // Default order for now since createdAt isn't in Product type
        break;
      case 'price_low':
        filteredProducts.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        filteredProducts.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        // Default order for now since rating isn't in Product type
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

  const totalResults = 
    (showVillages ? filteredData.villages.length : 0) +
    (showTourism ? filteredData.tourism.length : 0) +
    (showProducts ? filteredData.products.length : 0);

  const activeFilterCount = 
    (filters.priceRange ? 1 : 0) + 
    (filters.districts.length > 0 ? 1 : 0) + 
    (filters.minRating ? 1 : 0);

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-card sticky top-0 z-40 shadow-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/explore" className="p-2 -ml-2 hover:bg-secondary rounded-full transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <SearchBar 
              placeholder="Cari produk, wisata, desa..." 
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Category Tabs */}
        <div className="px-4 py-3 border-b border-border/30">
          <CategoryTabs 
            activeCategory={activeCategory} 
            onCategoryChange={setActiveCategory} 
          />
        </div>

        {/* Filter, Sort, View Controls */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/30 bg-background/95 backdrop-blur sticky top-[60px] z-30">
          <div className="flex items-center gap-2">
            <FilterButton onClick={() => setIsFilterOpen(true)} activeCount={activeFilterCount} />
            <SortDropdown value={sortOption} onChange={setSortOption} />
          </div>
          <div className="flex items-center gap-3">
            {totalResults > 0 && (
              <span className="text-xs text-muted-foreground">
                {totalResults} hasil
              </span>
            )}
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mb-4" />
            <p className="text-muted-foreground text-sm">Mencari...</p>
          </div>
        ) : !hasResults ? (
          <EmptyState 
            title={searchQuery ? "Tidak ditemukan" : "Ketik untuk mencari"}
            description={searchQuery 
              ? `Tidak ada hasil untuk "${searchQuery}"`
              : "Cari produk, wisata, atau desa wisata"
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeCategory + searchQuery + viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-4 space-y-6"
            >
              {/* Villages Section */}
              {showVillages && filteredData.villages.length > 0 && (
                <section>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                    Desa ({filteredData.villages.length})
                  </h3>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
                    {filteredData.villages.map((village, idx) => (
                      <VillageCardLarge key={village.id} village={village} index={idx} />
                    ))}
                  </div>
                </section>
              )}

              {/* Tourism Section */}
              {showTourism && filteredData.tourism.length > 0 && (
                <section>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                    Wisata ({filteredData.tourism.length})
                  </h3>
                  <div className="space-y-3">
                    {filteredData.tourism.map((tourism, idx) => (
                      <TourismCardCompact key={tourism.id} tourism={tourism} index={idx} />
                    ))}
                  </div>
                </section>
              )}

              {/* Products Section */}
              {showProducts && filteredData.products.length > 0 && (
                <section>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                    Produk ({filteredData.products.length})
                  </h3>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredData.products.map((product, idx) => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          index={idx}
                          showCategoryBadge 
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredData.products.map((product, idx) => (
                        <ProductCardHorizontal key={product.id} product={product} index={idx} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Filter Sheet */}
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
