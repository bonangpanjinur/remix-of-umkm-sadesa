import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Store, Star, MapPin, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShopFilterSheet, type ShopFilters } from '@/components/shop/ShopFilterSheet';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    async function fetchShops() {
      try {
        // Fetch merchants with their products
        const { data: merchantsData, error } = await supabase
          .from('merchants')
          .select(`
            id, name, address, phone, rating_avg, rating_count, is_open, badge, image_url,
            village_id, villages(name),
            products(id, category)
          `)
          .eq('status', 'ACTIVE')
          .eq('registration_status', 'APPROVED');

        if (error) throw error;

        const mappedShops: ShopData[] = (merchantsData || []).map((m) => {
          const products = m.products || [];
          const categories = [...new Set(products.map((p: any) => p.category))];
          
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
            villageName: (m.villages as any)?.name || null,
            productCount: products.length,
            categories,
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

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = shop.name.toLowerCase().includes(query);
        const matchAddress = shop.address?.toLowerCase().includes(query);
        const matchVillage = shop.villageName?.toLowerCase().includes(query);
        if (!matchName && !matchAddress && !matchVillage) return false;
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
  }, [shops, searchQuery, filters]);

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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

      {/* Results Count */}
      <div className="px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
        <Store className="h-4 w-4" />
        <span>
          {loading ? 'Memuat...' : `${filteredShops.length} toko ditemukan`}
        </span>
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
          ) : filteredShops.length === 0 ? (
            <div className="text-center py-12">
              <Store className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
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
            filteredShops.map((shop, idx) => (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link
                  to={`/merchant/${shop.id}`}
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
                          <Store className="h-6 w-6 text-muted-foreground" />
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
                              <Badge variant="secondary" className="text-[10px] px-1.5">
                                {shop.badge}
                              </Badge>
                            )}
                          </div>
                          {shop.villageName && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{shop.villageName}</span>
                            </div>
                          )}
                        </div>
                        <div
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            shop.isOpen
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {shop.isOpen ? 'Buka' : 'Tutup'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <span className="font-medium">{shop.ratingAvg.toFixed(1)}</span>
                          <span className="text-muted-foreground text-xs">
                            ({shop.ratingCount})
                          </span>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {shop.productCount} produk
                        </span>
                      </div>

                      {/* Categories */}
                      {shop.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {shop.categories.slice(0, 3).map((cat) => (
                            <Badge
                              key={cat}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 capitalize"
                            >
                              {cat}
                            </Badge>
                          ))}
                          {shop.categories.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{shop.categories.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground self-center flex-shrink-0" />
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
