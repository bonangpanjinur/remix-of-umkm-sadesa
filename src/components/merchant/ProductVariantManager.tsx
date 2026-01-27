import { useState, useEffect } from 'react';
import { Plus, X, Palette, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VariantOption {
  value: string;
  stock: number;
  price_adj: number; // price adjustment from base price
}

interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  options: VariantOption[];
}

interface ProductVariantManagerProps {
  productId: string;
  basePrice: number;
  onVariantsChange?: (variants: ProductVariant[]) => void;
}

const commonVariantTypes = [
  { value: 'Ukuran', icon: Ruler },
  { value: 'Warna', icon: Palette },
  { value: 'Bahan', icon: null },
  { value: 'Rasa', icon: null },
  { value: 'Topping', icon: null },
];

export function ProductVariantManager({ 
  productId, 
  basePrice,
  onVariantsChange 
}: ProductVariantManagerProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVariantName, setNewVariantName] = useState('');
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [newOption, setNewOption] = useState({ value: '', stock: '10', price_adj: '0' });

  useEffect(() => {
    fetchVariants();
  }, [productId]);

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variants' as any)
        .select('*')
        .eq('product_id', productId);

      if (error) throw error;

      const mapped = ((data || []) as any[]).map(v => ({
        id: v.id,
        product_id: v.product_id,
        name: v.name,
        options: (v.options as VariantOption[]) || [],
      })) as ProductVariant[];
      setVariants(mapped);
      onVariantsChange?.(mapped);
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setLoading(false);
    }
  };

  const addVariant = async () => {
    if (!newVariantName.trim()) {
      toast.error('Masukkan nama varian');
      return;
    }

    try {
      const { error } = await supabase.from('product_variants' as any).insert({
        product_id: productId,
        name: newVariantName,
        options: [],
      });

      if (error) throw error;

      toast.success('Varian ditambahkan');
      setNewVariantName('');
      fetchVariants();
    } catch (error) {
      toast.error('Gagal menambah varian');
    }
  };

  const deleteVariant = async (variantId: string) => {
    if (!confirm('Hapus varian ini?')) return;

    try {
      const { error } = await supabase
        .from('product_variants' as any)
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      toast.success('Varian dihapus');
      fetchVariants();
    } catch (error) {
      toast.error('Gagal menghapus varian');
    }
  };

  const addOption = async (variantId: string) => {
    if (!newOption.value.trim()) {
      toast.error('Masukkan nilai opsi');
      return;
    }

    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;

    const updatedOptions = [
      ...variant.options,
      {
        value: newOption.value,
        stock: parseInt(newOption.stock) || 0,
        price_adj: parseInt(newOption.price_adj) || 0,
      },
    ];

    try {
      const { error } = await supabase
        .from('product_variants' as any)
        .update({ options: updatedOptions })
        .eq('id', variantId);

      if (error) throw error;

      toast.success('Opsi ditambahkan');
      setNewOption({ value: '', stock: '10', price_adj: '0' });
      setEditingVariant(null);
      fetchVariants();
    } catch (error) {
      toast.error('Gagal menambah opsi');
    }
  };

  const removeOption = async (variantId: string, optionValue: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;

    const updatedOptions = variant.options.filter(o => o.value !== optionValue);

    try {
      const { error } = await supabase
        .from('product_variants' as any)
        .update({ options: updatedOptions })
        .eq('id', variantId);

      if (error) throw error;

      toast.success('Opsi dihapus');
      fetchVariants();
    } catch (error) {
      toast.error('Gagal menghapus opsi');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Varian Produk</Label>
      </div>

      {/* Existing Variants */}
      {variants.map((variant) => (
        <div key={variant.id} className="border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{variant.name}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingVariant(editingVariant === variant.id ? null : variant.id)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Opsi
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteVariant(variant.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-2">
            {variant.options.map((option) => (
              <Badge
                key={option.value}
                variant="secondary"
                className="pl-2 pr-1 py-1 flex items-center gap-1"
              >
                <span>{option.value}</span>
                <span className="text-[10px] text-muted-foreground">
                  (stok: {option.stock})
                </span>
                {option.price_adj !== 0 && (
                  <span className="text-[10px] text-primary">
                    {option.price_adj > 0 ? '+' : ''}{option.price_adj.toLocaleString('id-ID')}
                  </span>
                )}
                <button
                  onClick={() => removeOption(variant.id, option.value)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Add Option Form */}
          {editingVariant === variant.id && (
            <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs">Nilai</Label>
                <Input
                  value={newOption.value}
                  onChange={(e) => setNewOption(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="M, L, Merah..."
                  className="h-8 w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stok</Label>
                <Input
                  type="number"
                  value={newOption.stock}
                  onChange={(e) => setNewOption(prev => ({ ...prev, stock: e.target.value }))}
                  className="h-8 w-16"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">+/- Harga</Label>
                <Input
                  type="number"
                  value={newOption.price_adj}
                  onChange={(e) => setNewOption(prev => ({ ...prev, price_adj: e.target.value }))}
                  className="h-8 w-20"
                />
              </div>
              <Button size="sm" onClick={() => addOption(variant.id)}>
                Tambah
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* Add New Variant */}
      <div className="flex gap-2">
        <Select value={newVariantName} onValueChange={setNewVariantName}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Pilih jenis varian" />
          </SelectTrigger>
          <SelectContent>
            {commonVariantTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={newVariantName}
          onChange={(e) => setNewVariantName(e.target.value)}
          placeholder="atau ketik manual..."
          className="flex-1"
        />
        <Button onClick={addVariant} disabled={!newVariantName}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {variants.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Belum ada varian. Tambahkan varian seperti Ukuran atau Warna.
        </p>
      )}
    </div>
  );
}
