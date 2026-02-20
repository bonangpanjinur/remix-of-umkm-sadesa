import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { TourismCard } from '@/components/TourismCard';
import { fetchTourism, fetchVillages } from '@/lib/api';
import { useUserLocation, sortByDistance } from '@/hooks/useUserLocation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tourism, Village } from '@/types';

type SortMode = 'nearest' | 'popular' | 'newest';

export default function TourismPage() {
  const [tourismSpots, setTourismSpots] = useState<Tourism[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const { location: userLocation } = useUserLocation();

  const [search, setSearch] = useState('');
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>(userLocation ? 'nearest' : 'popular');

  useEffect(() => {
    async function loadData() {
      try {
        const [tourismData, villagesData] = await Promise.all([
          fetchTourism(),
          fetchVillages(),
        ]);
        setTourismSpots(tourismData);
        setVillages(villagesData);
      } catch (error) {
        console.error('Error loading tourism:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Extract all unique facilities
  const allFacilities = useMemo(() => {
    const set = new Set<string>();
    tourismSpots.forEach(t => t.facilities?.forEach(f => set.add(f)));
    return Array.from(set).sort();
  }, [tourismSpots]);

  const toggleFacility = (f: string) => {
    setSelectedFacilities(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  // Filter & sort
  const filteredTourism = useMemo(() => {
    let result = tourismSpots;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.villageName.toLowerCase().includes(q)
      );
    }

    // Village filter
    if (selectedVillage !== 'all') {
      result = result.filter(t => t.villageId === selectedVillage);
    }

    // Facilities filter
    if (selectedFacilities.length > 0) {
      result = result.filter(t =>
        selectedFacilities.every(f => t.facilities?.includes(f))
      );
    }

    // Sort
    if (sortMode === 'nearest' && userLocation) {
      result = sortByDistance(result, userLocation.lat, userLocation.lng);
    } else if (sortMode === 'popular') {
      result = [...result].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else {
      // newest – no specific sort field, keep default order
    }

    return result;
  }, [tourismSpots, search, selectedVillage, selectedFacilities, sortMode, userLocation]);

  const hasActiveFilters = search || selectedVillage !== 'all' || selectedFacilities.length > 0;

  const clearFilters = () => {
    setSearch('');
    setSelectedVillage('all');
    setSelectedFacilities([]);
  };

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
          <p className="text-sm text-muted-foreground mb-4">
            Jelajahi destinasi wisata alam dan budaya
          </p>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari wisata..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition placeholder:text-muted-foreground"
            />
          </div>

          {/* Sort & Village filter row */}
          <div className="flex gap-2 mb-3">
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {userLocation && <SelectItem value="nearest">Terdekat</SelectItem>}
                <SelectItem value="popular">Terpopuler</SelectItem>
                <SelectItem value="newest">Terbaru</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedVillage} onValueChange={setSelectedVillage}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Semua Desa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Desa</SelectItem>
                {villages.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Facility chips */}
          {allFacilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground mt-1" />
              {allFacilities.map(f => (
                <Badge
                  key={f}
                  variant={selectedFacilities.includes(f) ? 'default' : 'outline'}
                  className="text-[10px] cursor-pointer hover:opacity-80 transition"
                  onClick={() => toggleFacility(f)}
                >
                  {f}
                </Badge>
              ))}
            </div>
          )}

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">
                {filteredTourism.length} wisata ditemukan
              </span>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                Reset Filter
              </Button>
            </div>
          )}
          
          {userLocation && sortMode === 'nearest' && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 bg-muted/50 px-3 py-2 rounded-lg">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>
                Diurutkan berdasarkan {userLocation.source === 'gps' ? 'lokasi GPS Anda' : 'lokasi terdekat'}
              </span>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredTourism.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium mb-1">
                {hasActiveFilters ? 'Tidak ada wisata yang cocok' : 'Belum ada wisata tersedia'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" className="text-xs" onClick={clearFilters}>
                  Reset filter
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTourism.map((tourism, idx) => (
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
