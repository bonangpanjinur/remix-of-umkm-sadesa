import { useState, useEffect, useCallback } from 'react';
import { Upload, X, Star, GripVertical, Image as ImageIcon } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
}

interface MultipleImageUploadProps {
  productId: string;
  merchantId: string;
  maxImages?: number;
  onImagesChange?: (images: ProductImage[]) => void;
}

export function MultipleImageUpload({
  productId,
  merchantId,
  maxImages = 5,
  onImagesChange,
}: MultipleImageUploadProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchImages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_images' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const images = (data || []) as unknown as ProductImage[];
      setImages(images);
      onImagesChange?.(images);
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  }, [productId, onImagesChange]);

  useEffect(() => {
    if (productId) {
      fetchImages();
    }
  }, [productId, fetchImages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast.error(`Maksimal ${maxImages} gambar`);
      return;
    }

    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${merchantId}/${productId}/${Date.now()}-${i}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        // Insert to database
        const { error: dbError } = await supabase.from('product_images' as any).insert({
          product_id: productId,
          image_url: publicUrl,
          sort_order: images.length + i,
          is_primary: images.length === 0 && i === 0,
        });

        if (dbError) throw dbError;
      }

      toast.success('Gambar berhasil diupload');
      fetchImages();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Gagal mengupload gambar');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string, imageUrl: string) => {
    try {
      // Delete from storage
      const path = imageUrl.split('/product-images/')[1];
      if (path) {
        await supabase.storage.from('product-images').remove([path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('product_images' as any)
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      toast.success('Gambar dihapus');
      fetchImages();
    } catch (error) {
      toast.error('Gagal menghapus gambar');
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      // Remove primary from all
      await supabase
        .from('product_images' as any)
        .update({ is_primary: false })
        .eq('product_id', productId);

      // Set new primary
      const { error } = await supabase
        .from('product_images' as any)
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;

      toast.success('Gambar utama diubah');
      fetchImages();
    } catch (error) {
      toast.error('Gagal mengubah gambar utama');
    }
  };

  const handleReorder = async (newOrder: ProductImage[]) => {
    setImages(newOrder);

    try {
      // Update sort order in database
      for (let i = 0; i < newOrder.length; i++) {
        await supabase
          .from('product_images' as any)
          .update({ sort_order: i })
          .eq('id', newOrder[i].id);
      }
    } catch (error) {
      console.error('Error reordering:', error);
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Gambar Produk ({images.length}/{maxImages})
        </span>
      </div>

      {/* Image Grid */}
      <Reorder.Group
        axis="x"
        values={images}
        onReorder={handleReorder}
        className="flex flex-wrap gap-2"
      >
        {images.map((image) => (
          <Reorder.Item
            key={image.id}
            value={image}
            className="relative group"
          >
            <div className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted">
              <img
                src={image.image_url}
                alt="Product"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Primary badge */}
            {image.is_primary && (
              <div className="absolute -top-1 -left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                <Star className="h-3 w-3 fill-current" />
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
              <button
                onClick={() => handleSetPrimary(image.id)}
                className="p-1 bg-white/20 rounded hover:bg-white/40"
                title="Jadikan utama"
              >
                <Star className="h-3 w-3 text-white" />
              </button>
              <button
                onClick={() => handleDelete(image.id, image.image_url)}
                className="p-1 bg-white/20 rounded hover:bg-destructive"
                title="Hapus"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>

            {/* Drag handle */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center py-0.5 cursor-grab">
              <GripVertical className="h-3 w-3 text-white" />
            </div>
          </Reorder.Item>
        ))}

        {/* Upload Button */}
        {images.length < maxImages && (
          <label
            className={cn(
              'w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors',
              uploading && 'opacity-50 pointer-events-none'
            )}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
              </>
            )}
          </label>
        )}
      </Reorder.Group>

      <p className="text-xs text-muted-foreground">
        Drag untuk mengubah urutan. Klik ⭐ untuk jadikan gambar utama.
      </p>
    </div>
  );
}
