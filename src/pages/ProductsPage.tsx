import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, ArrowUpDown } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { BottomNav } from '../components/layout/BottomNav';
import { SearchBar } from '../components/ui/SearchBar';
import { ProductCard } from '../components/ProductCard';
import { Skeleton } from '../components/ui/skeleton';
import { fetchProducts, categories } from '../lib/api';
import { useUserLocation, sortByDistance } from '../hooks/useUserLocation';
import { cn } from '../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { Product } from '../types';

type SortMode = 'nearest' | 'cheapest' | 'expensive' | 'newest' | 'rating';

function ProductSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <Skeleton className="w-full aspect-square" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('nearest');
  const { location: userLocation } = useUserLocation();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchProducts();
        setProducts(data);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.merchantName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    switch (sortMode) {
      case 'nearest':
        if (userLocation) {
          result = sortByDistance(result, userLocation.lat, userLocation.lng);
        }
        break;
      case 'cheapest':
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case 'expensive':
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        // Keep default order (newest first from API)
        break;
      case 'rating':
        result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    return result;
  }, [products, searchQuery, selectedCategory, sortMode, userLocation]);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    if (catId === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', catId);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      {/* Search & Filters */}
      <div className="px-5 py-3 bg-card border-b border-border space-y-3">
        <SearchBar 
          value={searchQuery} 
          onChange={setSearchQuery}
          placeholder="Cari produk..."
        />
        
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <button
            onClick={() => handleCategoryChange('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap',
              selectedCategory === 'all' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            Semua
          </button>
          {categories.filter(c => c.id !== 'wisata').map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap',
                selectedCategory === cat.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 text-xs w-full">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {userLocation && <SelectItem value="nearest">Terdekat</SelectItem>}
              <SelectItem value="cheapest">Termurah</SelectItem>
              <SelectItem value="expensive">Termahal</SelectItem>
              <SelectItem value="newest">Terbaru</SelectItem>
              <SelectItem value="rating">Rating Tertinggi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Location indicator */}
      {userLocation && sortMode === 'nearest' && !loading && (
        <div className="px-5 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>
              Diurutkan berdasarkan {userLocation.source === 'gps' ? 'lokasi GPS Anda' : 'lokasi terdekat'}
            </span>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 py-4"
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Tidak ada produk ditemukan
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredAndSortedProducts.map((product, idx) => (
                <ProductCard key={product.id} product={product} index={idx} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
      
      <BottomNav />
    </div>
  );
}
