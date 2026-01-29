import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Eye, EyeOff, Save, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HomepageSection {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

interface HomepageLayoutSettings {
  sections: HomepageSection[];
  visible_categories: string[];
}

const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: 'hero', name: 'Hero Banner', enabled: true, order: 0 },
  { id: 'categories', name: 'Kategori', enabled: true, order: 1 },
  { id: 'popular_tourism', name: 'Wisata Populer', enabled: true, order: 2 },
  { id: 'promo', name: 'Promo Spesial', enabled: true, order: 3 },
  { id: 'recommendations', name: 'Rekomendasi Pilihan', enabled: true, order: 4 },
  { id: 'villages', name: 'Jelajahi Desa', enabled: true, order: 5 },
];

const ALL_CATEGORIES = [
  { id: 'kuliner', name: 'Kuliner' },
  { id: 'fashion', name: 'Fashion' },
  { id: 'kriya', name: 'Kriya' },
  { id: 'wisata', name: 'Wisata' },
];

export default function AdminHomepageLayoutPage() {
  const [sections, setSections] = useState<HomepageSection[]>(DEFAULT_SECTIONS);
  const [visibleCategories, setVisibleCategories] = useState<string[]>(ALL_CATEGORIES.map(c => c.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

      if (error) throw error;

      if (data?.value) {
        const settings = data.value as unknown as HomepageLayoutSettings;
        if (settings.sections) {
          setSections(settings.sections.sort((a, b) => a.order - b.order));
        }
        if (settings.visible_categories) {
          setVisibleCategories(settings.visible_categories);
        }
      }
    } catch (error) {
      console.error('Error loading homepage layout settings:', error);
      toast.error('Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings: HomepageLayoutSettings = {
        sections: sections.map((s, index) => ({ ...s, order: index })),
        visible_categories: visibleCategories,
      };

      const { error } = await supabase
        .from('app_settings')
        .update({ value: settings as unknown as import('@/integrations/supabase/types').Json })
        .eq('key', 'homepage_layout');

      if (error) throw error;

      toast.success('Pengaturan berhasil disimpan');
    } catch (error) {
      console.error('Error saving homepage layout settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setSections(DEFAULT_SECTIONS);
    setVisibleCategories(ALL_CATEGORIES.map(c => c.id));
    toast.info('Pengaturan direset ke default');
  };

  const toggleSection = (id: string) => {
    setSections(prev =>
      prev.map(section =>
        section.id === id ? { ...section, enabled: !section.enabled } : section
      )
    );
  };

  const toggleCategory = (categoryId: string) => {
    setVisibleCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSections = [...sections];
    const draggedSection = newSections[draggedIndex];
    newSections.splice(draggedIndex, 1);
    newSections.splice(index, 0, draggedSection);
    
    setSections(newSections);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setSections(newSections);
  };

  if (loading) {
    return (
      <AdminLayout title="Pengaturan Homepage" subtitle="Mengatur tampilan halaman utama">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Pengaturan Homepage" subtitle="Mengatur tampilan dan urutan section di halaman utama">
      <div className="space-y-6">
        {/* Section Order */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GripVertical className="h-5 w-5" />
              Urutan Section
            </CardTitle>
            <CardDescription>
              Drag & drop atau gunakan tombol panah untuk mengubah urutan. Toggle switch untuk menyembunyikan/menampilkan section.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    draggedIndex === index 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-card hover:bg-muted/50'
                  } cursor-grab active:cursor-grabbing transition-colors`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm font-medium w-6 text-center text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className={`font-medium ${!section.enabled ? 'text-muted-foreground line-through' : ''}`}>
                      {section.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveSection(index, 'up')}
                      disabled={index === 0}
                    >
                      <span className="sr-only">Move up</span>
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveSection(index, 'down')}
                      disabled={index === sections.length - 1}
                    >
                      <span className="sr-only">Move down</span>
                      ↓
                    </Button>
                    <div className="flex items-center gap-2 ml-2">
                      {section.enabled ? (
                        <Eye className="h-4 w-4 text-green-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Switch
                        checked={section.enabled}
                        onCheckedChange={() => toggleSection(section.id)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Visibility */}
        <Card>
          <CardHeader>
            <CardTitle>Kategori yang Ditampilkan</CardTitle>
            <CardDescription>
              Pilih kategori mana saja yang muncul di section Kategori homepage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ALL_CATEGORIES.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category.id}`}
                    checked={visibleCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                  />
                  <Label
                    htmlFor={`category-${category.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {category.name}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview Urutan</CardTitle>
            <CardDescription>
              Tampilan urutan section yang akan terlihat di homepage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sections
                .filter(s => s.enabled)
                .map((section, index) => (
                  <div
                    key={section.id}
                    className="flex items-center gap-3 p-2 rounded bg-muted/50"
                  >
                    <span className="text-xs font-medium text-muted-foreground w-6 text-center">
                      {index + 1}
                    </span>
                    <span className="text-sm">{section.name}</span>
                  </div>
                ))}
            </div>
            {sections.filter(s => !s.enabled).length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Section yang disembunyikan:</p>
                <div className="flex flex-wrap gap-2">
                  {sections
                    .filter(s => !s.enabled)
                    .map(section => (
                      <span
                        key={section.id}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                      >
                        {section.name}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={resetToDefault}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Default
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
