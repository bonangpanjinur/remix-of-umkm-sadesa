import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

// Map emoji/icon from DB to lucide icon key for homepage display
const iconMap: Record<string, string> = {
  '🍔': 'utensils',
  '🍜': 'utensils',
  '🥘': 'utensils',
  '🍽': 'utensils',
  '👕': 'shirt',
  '👗': 'shirt',
  '🎨': 'shapes',
  '🏺': 'shapes',
  '🧶': 'shapes',
  '🗺': 'map-location-dot',
  '🏔': 'map-location-dot',
  '🏖': 'map-location-dot',
};

// Generate a consistent color class based on category index
const colorClasses = [
  'category-kuliner',
  'category-fashion',
  'category-kriya',
  'category-wisata',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

export function useCategories() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, icon, description')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get categories formatted for homepage display
  const getHomepageCategories = () => {
    return categories.map((cat, index) => ({
      id: cat.slug,
      name: cat.name,
      icon: (cat.icon ? iconMap[cat.icon] : null) || getDefaultIcon(index),
      colorClass: colorClasses[index % colorClasses.length],
    }));
  };

  return { categories, loading, getHomepageCategories, refetch: fetchCategories };
}

function getDefaultIcon(index: number): string {
  const defaults = ['utensils', 'shirt', 'shapes', 'map-location-dot'];
  return defaults[index % defaults.length];
}
