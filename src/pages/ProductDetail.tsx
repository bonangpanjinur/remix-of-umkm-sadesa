import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Share2, 
  Minus, 
  Plus,
  ShoppingCart,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MerchantInfo } from '@/components/MerchantInfo';
import { fetchProduct, fetchMerchant } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/utils';
import type { Product, Merchant } from '@/types';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const productData = await fetchProduct(id);
        setProduct(productData);
        
        if (productData) {
          const merchantData = await fetchMerchant(productData.merchantId);
          setMerchant(merchantData);
        }
      } catch (error) {
        console.error('Error loading product:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);
  
  if (loading) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mobile-shell flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Produk tidak ditemukan</p>
          <Button onClick={() => navigate('/')}>Kembali</Button>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    addToCart(product, quantity);
    navigate('/cart');
  };

  return (
    <div className="mobile-shell bg-card flex flex-col min-h-screen relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-36">
        {/* Product Image */}
        <div className="relative h-72 bg-muted">
          <img 
            src={product.image} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
          
          {/* Top Navigation */}
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button className="w-10 h-10 bg-foreground/20 backdrop-blur rounded-full flex items-center justify-center text-primary-foreground hover:bg-foreground/40 transition border border-primary-foreground/20">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
          
          {product.isPromo && (
            <div className="absolute bottom-4 left-4">
              <span className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">
                PROMO
              </span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 pt-4"
        >
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-bold text-foreground leading-tight flex-1">
              {product.name}
            </h2>
            <span className="bg-brand-light text-primary text-xs font-bold px-2 py-1 rounded-lg ml-2">
              Stok: {product.stock}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <p className="text-2xl font-bold text-primary">
              {formatPrice(product.price)}
            </p>
            <div className="flex items-center gap-0.5 text-gold ml-2">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-xs font-medium text-foreground">4.8</span>
            </div>
          </div>
          
          {/* Merchant Info */}
          {merchant && (
            <div className="mb-6">
              <MerchantInfo merchant={merchant} />
            </div>
          )}

          <h3 className="font-bold text-sm text-foreground mb-2">Deskripsi</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {product.description}
          </p>
        </motion.div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="absolute bottom-0 w-full bg-card border-t border-border p-4 shadow-lg z-20">
        <div className="flex items-center gap-4 mb-3">
          {/* Quantity Selector */}
          <div className="flex items-center border border-border rounded-xl h-10 px-2">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-full text-muted-foreground hover:text-primary transition"
            >
              <Minus className="h-4 w-4 mx-auto" />
            </button>
            <span className="w-10 text-center font-bold text-foreground">
              {quantity}
            </span>
            <button 
              onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
              className="w-8 h-full text-muted-foreground hover:text-primary transition"
            >
              <Plus className="h-4 w-4 mx-auto" />
            </button>
          </div>
          
          <div className="flex-1 text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">
              {formatPrice(product.price * quantity)}
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleAddToCart}
          className="w-full shadow-brand"
          size="lg"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Tambah ke Keranjang
        </Button>
      </div>
    </div>
  );
}
