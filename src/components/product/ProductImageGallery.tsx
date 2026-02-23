import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ProductImageGalleryProps {
  productId: string;
  mainImage: string;
  productName: string;
}

export function ProductImageGallery({ productId, mainImage, productName }: ProductImageGalleryProps) {
  const [images, setImages] = useState<string[]>([mainImage]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    async function fetchImages() {
      const { data } = await supabase
        .from('product_images')
        .select('image_url, sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

      if (data && data.length > 0) {
        const urls = data.map(d => d.image_url);
        // Put main image first, then additional images (avoid duplicates)
        const allImages = [mainImage, ...urls.filter(u => u !== mainImage)];
        setImages(allImages);
      }
    }
    fetchImages();
  }, [productId, mainImage]);

  return (
    <div className="relative">
      {/* Main Image */}
      <div className="relative h-72 bg-muted">
        <img 
          src={images[activeIndex]} 
          alt={productName}
          className="w-full h-full object-cover"
        />
        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  idx === activeIndex ? 'bg-primary-foreground w-4' : 'bg-primary-foreground/50'
                )}
              />
            ))}
          </div>
        )}
      </div>
      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto hide-scrollbar bg-card">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition',
                idx === activeIndex ? 'border-primary' : 'border-transparent opacity-60'
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
