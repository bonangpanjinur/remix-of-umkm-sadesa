import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface HomepageSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export interface HomepageLayoutSettings {
  sections: HomepageSection[];
  visible_categories: string[];
}

const DEFAULT_SETTINGS: HomepageLayoutSettings = {
  sections: [
    { id: 'hero', name: 'Hero Banner', enabled: true, order: 0 },
    { id: 'categories', name: 'Kategori', enabled: true, order: 1 },
    { id: 'popular_tourism', name: 'Wisata Populer', enabled: true, order: 2 },
    { id: 'promo', name: 'Promo Spesial', enabled: true, order: 3 },
    { id: 'recommendations', name: 'Rekomendasi Pilihan', enabled: true, order: 4 },
    { id: 'villages', name: 'Jelajahi Desa', enabled: true, order: 5 },
  ],
  visible_categories: ['kuliner', 'fashion', 'kriya', 'wisata'],
};

export function useHomepageLayout() {
  const [settings, setSettings] = useState<HomepageLayoutSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'homepage_layout')
        .maybeSingle();

      if (error) {
        console.error('Error loading homepage layout:', error);
        return;
      }

      if (data?.value) {
        const loadedSettings = data.value as unknown as HomepageLayoutSettings;
        setSettings({
          sections: loadedSettings.sections?.sort((a, b) => a.order - b.order) || DEFAULT_SETTINGS.sections,
          visible_categories: loadedSettings.visible_categories || DEFAULT_SETTINGS.visible_categories,
        });
      }
    } catch (error) {
      console.error('Error loading homepage layout:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSectionEnabled = (sectionId: string): boolean => {
    const section = settings.sections.find(s => s.id === sectionId);
    return section?.enabled ?? true;
  };

  const getSectionOrder = (sectionId: string): number => {
    const section = settings.sections.find(s => s.id === sectionId);
    return section?.order ?? 0;
  };

  const getEnabledSections = (): HomepageSection[] => {
    return settings.sections
      .filter(s => s.enabled)
      .sort((a, b) => a.order - b.order);
  };

  const isCategoryVisible = (categoryId: string): boolean => {
    return settings.visible_categories.includes(categoryId);
  };

  return {
    settings,
    loading,
    isSectionEnabled,
    getSectionOrder,
    getEnabledSections,
    isCategoryVisible,
    visibleCategories: settings.visible_categories,
  };
}
