import { useState, useEffect } from 'react';
import { Filter, Star, MapPin, Store, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

export interface ShopFilters {
  minRating: number;
  villages: string[];
  categories: string[];
  isOpen: boolean | null;
}

interface Village {
  id: string;
  name: string;
}

interface ShopFilterSheetProps {
  filters: ShopFilters;
  onFiltersChange: (filters: ShopFilters) => void;
  activeFilterCount: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

export function ShopFilterSheet({ filters, onFiltersChange, activeFilterCount }: ShopFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [villages, setVillages] = useState<Village[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<CategoryOption[]>([]);
  const [localFilters, setLocalFilters] = useState<ShopFilters>(filters);

  useEffect(() => {
    async function fetchData() {
      const [villagesRes, categoriesRes] = await Promise.all([
        supabase.from('villages').select('id, name').eq('is_active', true).order('name'),
        supabase.from('categories').select('id, name, slug').eq('is_active', true).order('sort_order'),
      ]);
      setVillages(villagesRes.data || []);
      setDynamicCategories((categoriesRes.data || []).map(c => ({ id: c.slug, name: c.name })));
    }
    fetchData();
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: ShopFilters = {
      minRating: 0,
      villages: [],
      categories: [],
      isOpen: null,
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
  };

  const toggleVillage = (villageId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      villages: prev.villages.includes(villageId)
        ? prev.villages.filter((v) => v !== villageId)
        : [...prev.villages, villageId],
    }));
  };

  const toggleCategory = (catId: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter((c) => c !== catId)
        : [...prev.categories, catId],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {activeFilterCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Toko
          </SheetTitle>
          <SheetDescription>Sesuaikan pencarian toko</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4 pr-4">
          <div className="space-y-6">
            {/* Rating Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Star className="h-4 w-4 text-amber-500" />
                Rating Minimal
              </Label>
              <div className="px-2">
                <Slider
                  value={[localFilters.minRating]}
                  onValueChange={([value]) =>
                    setLocalFilters((prev) => ({ ...prev, minRating: value }))
                  }
                  max={5}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Semua</span>
                  <span className="font-medium text-foreground">
                    {localFilters.minRating > 0
                      ? `≥ ${localFilters.minRating} ⭐`
                      : 'Semua rating'}
                  </span>
                  <span>5.0</span>
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Store className="h-4 w-4" />
                Status Toko
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={localFilters.isOpen === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters((prev) => ({ ...prev, isOpen: null }))}
                >
                  Semua
                </Button>
                <Button
                  variant={localFilters.isOpen === true ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters((prev) => ({ ...prev, isOpen: true }))}
                >
                  <span className="text-green-600 mr-1">●</span> Buka
                </Button>
                <Button
                  variant={localFilters.isOpen === false ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters((prev) => ({ ...prev, isOpen: false }))}
                >
                  <span className="text-red-600 mr-1">●</span> Tutup
                </Button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Kategori Produk</Label>
              <div className="flex flex-wrap gap-2">
                {dynamicCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={localFilters.categories.includes(cat.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Village Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                Lokasi Desa
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {villages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Memuat desa...</p>
                ) : (
                  villages.map((village) => (
                    <div key={village.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`village-${village.id}`}
                        checked={localFilters.villages.includes(village.id)}
                        onCheckedChange={() => toggleVillage(village.id)}
                      />
                      <Label
                        htmlFor={`village-${village.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {village.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            Terapkan Filter
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
