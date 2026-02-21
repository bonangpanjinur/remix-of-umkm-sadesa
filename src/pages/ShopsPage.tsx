import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search as SearchIcon, Store as StoreIcon, Star as StarIcon, MapPin as MapPinIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { BottomNav } from '../components/layout/BottomNav';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ShopFilterSheet, type ShopFilters } from '../components/shop/ShopFilterSheet';
import { supabase } from '../integrations/supabase/client';
import { useUserLocation, calculateDistance } from '../hooks/useUserLocation';

interface ShopData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  ratingAvg: number;
  ratingCount: number;
  isOpen: boolean;
  badge: string | null;
  imageUrl: string | null;
  villageId: string | null;
  villageName: string | null;
  productCount: number;
  categories: string[];
  locationLat: number | null;
  locationLng: number | null;
  slug: string | null;
  businessCategory: string | null;
}

export default function ShopsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [shops, setShops] = useState<ShopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ShopFilters>({
    minRating: 0,
    villages: [],
    categories: [],
    isOpen: null,
  });
  const { location: userLocation } = useUserLocation();

  useEffect(() => {
    async function fetchShops() {
      try {
        // Fetch shops
        // Fetch merchants with their products and location
        // Note: villages table has location_lat and location_lng (not lat/lng)
        const { data: merchantsData, error } = await supabase
          .from('merchants')
          .select(`
            id, name, address, phone, rating_avg, rating_count, is_open, badge, image_url,
            village_id, location_lat, location_lng, slug, business_category,
            villages(name, location_lat, location_lng),
            products(id, category)
          `);

        
        if (error) {
          console.error('Supabase error fetching shops:', error);
          throw error;
        }

        const mappedShops: ShopData[] = (merchantsData || []).map((m) => {
          const products = m.products || [];
          const categories = [...new Set(products.map((p: any) => p.category))];
          const village = m.villages as any;
          
          // Get location - prefer merchant, fallback to village
          const locationLat = m.location_lat 
            ? Number(m.location_lat) 
            : (village?.location_lat ? Number(village.location_lat) : null);
          const locationLng = m.location_lng 
            ? Number(m.location_lng) 
            : (village?.location_lng ? Number(village.location_lng) : null);
          
          return {
            id: m.id,
            name: m.name,
            address: m.address,
            phone: m.phone,
            ratingAvg: Number(m.rating_avg) || 0,
            ratingCount: m.rating_count || 0,
            isOpen: m.is_open,
            badge: m.badge,
            imageUrl: m.image_url,
            villageId: m.village_id,
            villageName: village?.name || null,
            productCount: products.length,
            categories,
            locationLat,
            locationLng,
            slug: m.slug || null,
            businessCategory: m.business_category || null,
          };
        });

        
        setShops(mappedShops);
      } catch (error) {
        console.error('Error fetching shops:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchShops();
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value) {
      searchParams.set('q', value);
    } else {
      searchParams.delete('q');
    }
    setSearchParams(searchParams);
  };

  // Sort shops by proximity first, then filter
  const sortedAndFilteredShops = useMemo(() => {
    // First sort by distance
    let sorted = [...shops];
    if (userLocation) {
      sorted.sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.locationLat, a.locationLng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.locationLat, b.locationLng);
        return distA - distB;
      });
    }

    // Then filter
    return sorted.filter((shop) => {
      // Search filter - match name, address, village, or business category
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = shop.name.toLowerCase().includes(query);
        const matchAddress = shop.address?.toLowerCase().includes(query);
        const matchVillage = shop.villageName?.toLowerCase().includes(query);
        const matchCategory = shop.categories.some(cat => cat.toLowerCase().includes(query));
        const matchBusinessCategory = shop.businessCategory?.toLowerCase().includes(query);
        if (!matchName && !matchAddress && !matchVillage && !matchCategory && !matchBusinessCategory) return false;
      }

      // Rating filter
      if (filters.minRating > 0 && shop.ratingAvg < filters.minRating) {
        return false;
      }

      // Village filter
      if (filters.villages.length > 0 && !filters.villages.includes(shop.villageId || '')) {
        return false;
      }

      // Category filter
      if (filters.categories.length > 0) {
        const hasCategory = filters.categories.some((cat) => shop.categories.includes(cat));
        if (!hasCategory) return false;
      }

      // Open status filter
      if (filters.isOpen !== null && shop.isOpen !== filters.isOpen) {
        return false;
      }

      return true;
    });
  }, [shops, searchQuery, filters, userLocation]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minRating > 0) count++;
    if (filters.villages.length > 0) count++;
    if (filters.categories.length > 0) count++;
    if (filters.isOpen !== null) count++;
    return count;
  }, [filters]);

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />

      {/* Search & Filter Bar */}
      <div className="px-4 py-3 bg-card border-b border-border space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari nama toko, lokasi..."
              className="pl-10"
            />
          </div>
          <ShopFilterSheet
            filters={filters}
            onFiltersChange={setFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.minRating > 0 && (
              <Badge variant="secondary" className="text-xs">
                ⭐ ≥ {filters.minRating}
              </Badge>
            )}
            {filters.isOpen === true && (
              <Badge variant="secondary" className="text-xs">
                🟢 Buka
              </Badge>
            )}
            {filters.isOpen === false && (
              <Badge variant="secondary" className="text-xs">
                🔴 Tutup
              </Badge>
            )}
            {filters.categories.map((cat) => (
              <Badge key={cat} variant="secondary" className="text-xs capitalize">
                {cat}
              </Badge>
            ))}
            {filters.villages.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filters.villages.length} desa
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results Count with Location Indicator */}
      <div className="px-4 py-2 text-sm text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StoreIcon className="h-4 w-4" />
          <span>
            {loading ? 'Memuat...' : `${sortedAndFilteredShops.length} toko ditemukan`}
          </span>
        </div>
        {userLocation && !loading && (
          <div className="flex items-center gap-1 text-xs">
            <MapPinIcon className="h-3 w-3 text-primary" />
            <span>{userLocation.source === 'gps' ? 'GPS' : 'Terdekat'}</span>
          </div>
        )}
      </div>

      {/* Shop List */}
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 space-y-3"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedAndFilteredShops.length === 0 ? (
            <div className="text-center py-12">
              <StoreIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Tidak ada toko ditemukan</p>
              {activeFilterCount > 0 && (
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() =>
                    setFilters({
                      minRating: 0,
                      villages: [],
                      categories: [],
                      isOpen: null,
                    })
                  }
                >
                  Reset filter
                </Button>
              )}
            </div>
          ) : (
            sortedAndFilteredShops.map((shop, idx) => (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link
                  to={`/merchant/${shop.slug || shop.id}`}
                  className="block bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-3">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {shop.imageUrl ? (
                        <img
                          src={shop.imageUrl}
                          alt={shop.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <StoreIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {shop.name}
                            </h3>
                            {shop.badge && (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-none">
                                {shop.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPinIcon className="h-3 w-3" />
                            <span className="truncate">{shop.villageName || 'Lokasi tidak tersedia'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-secondary/50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                          <StarIcon className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium">{shop.ratingAvg.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex gap-1.5 overflow-hidden">
                          {shop.categories.slice(0, 2).map((cat) => (
                            <span key={cat} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize whitespace-nowrap">
                              {cat}
                            </span>
                          ))}
                          {shop.categories.length > 2 && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              +{shop.categories.length - 2}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-primary text-xs font-medium">
                          <span>Lihat Toko</span>
                          <ChevronRightIcon className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
