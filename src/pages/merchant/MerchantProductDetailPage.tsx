import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, ImageIcon, Layers } from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { ProductVariantManager } from '@/components/merchant/ProductVariantManager';
import { MultipleImageUpload } from '@/components/merchant/MultipleImageUpload';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

interface ProductData {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
  category: string;
  is_active: boolean;
  merchant_id: string;
}

export default function MerchantProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !productId) return;

      try {
        // Get merchant
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!merchant) {
          navigate('/merchant/products');
          return;
        }

        setMerchantId(merchant.id);

        // Get product
        const { data: productData, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('merchant_id', merchant.id)
          .maybeSingle();

        if (error || !productData) {
          navigate('/merchant/products');
          return;
        }

        setProduct(productData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, productId, navigate]);

  if (loading) {
    return (
      <MerchantLayout title="Detail Produk" subtitle="Kelola produk">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  if (!product || !merchantId) {
    return null;
  }

  return (
    <MerchantLayout title="Detail Produk" subtitle={product.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/merchant/products')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-4">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-20 h-20 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center border border-border">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              
              <div>
                <h2 className="text-xl font-bold">{product.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-semibold text-primary">
                    {formatPrice(product.price)}
                  </span>
                  <Badge variant={product.is_active ? 'default' : 'secondary'}>
                    {product.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Stok: {product.stock} • Kategori: {product.category}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="images" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Gambar
            </TabsTrigger>
            <TabsTrigger value="variants" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Varian
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="images" className="mt-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <h3 className="font-semibold mb-4">Kelola Gambar Produk</h3>
              <MultipleImageUpload
                productId={product.id}
                merchantId={merchantId}
                maxImages={5}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="variants" className="mt-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <h3 className="font-semibold mb-4">Kelola Varian Produk</h3>
              <ProductVariantManager
                productId={product.id}
                basePrice={product.price}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MerchantLayout>
  );
}
