import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
  
  const total = getCartTotal();

  const handleCheckout = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="mobile-shell bg-card flex flex-col min-h-screen">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-bold text-lg text-foreground">Keranjang Belanja</h2>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4 text-center">
            Keranjang belanja Anda masih kosong
          </p>
          <Button onClick={() => navigate('/')}>
            Mulai Belanja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-secondary flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-bold text-lg text-foreground">Keranjang Belanja</h2>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-destructive font-medium hover:underline"
        >
          Hapus Semua
        </button>
      </div>
      
      {/* Cart Items - Grouped by Merchant */}
      <div className="flex-1 overflow-y-auto p-4 pb-48">
        {(() => {
          // Group items by merchantName
          const grouped: Record<string, typeof items> = {};
          items.forEach(item => {
            const key = item.product.merchantName || 'Toko';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
          });

          return Object.entries(grouped).map(([merchantName, merchantItems]) => (
            <div key={merchantName} className="mb-4">
              {/* Merchant Header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <Store className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">{merchantName}</span>
                <span className="text-[10px] text-muted-foreground">({merchantItems.length} item)</span>
              </div>
              <div className="space-y-3">
                {merchantItems.map((item, index) => (
                  <motion.div
                    key={item.product.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-xl p-3 border border-border shadow-sm"
                  >
                    <div className="flex gap-3">
                      <img 
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-foreground line-clamp-2">
                          {item.product.name}
                        </h3>
                        <p className="text-primary font-bold text-sm mt-1">
                          {formatPrice(item.product.price)}
                        </p>
                        {item.product.originalPrice && (
                          <p className="text-xs line-through text-muted-foreground">
                            {formatPrice(item.product.originalPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      
                      <div className="flex items-center border border-border rounded-lg">
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-8 h-8 text-muted-foreground hover:text-primary transition"
                        >
                          <Minus className="h-4 w-4 mx-auto" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm">
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-8 h-8 text-muted-foreground hover:text-primary transition"
                        >
                          <Plus className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Checkout Summary */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-card border-t border-border p-5 shadow-lg">
        <div className="flex justify-between items-center mb-1 text-sm">
          <span className="text-muted-foreground">Ongkos kirim</span>
          <span className="text-xs text-muted-foreground italic">Dihitung saat checkout</span>
        </div>
        <div className="flex justify-between items-center mb-4 pt-3 border-t border-border">
          <span className="text-lg font-bold">Total</span>
          <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
        </div>
        <Button
          onClick={handleCheckout}
          className="w-full shadow-brand font-bold"
          size="lg"
        >
          {user ? 'Lanjut ke Checkout' : 'Masuk untuk Checkout'}
        </Button>
      </div>
    </div>
  );
}
