import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { Zap, ArrowLeft, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface FlashSaleItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  merchant_name: string;
  original_price: number;
  flash_price: number;
  stock_available: number;
  stock_sold: number;
  end_time: string;
  discount_pct: number;
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Berakhir'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  const isUrgent = new Date(endTime).getTime() - Date.now() < 3600000;
  return <span className={`font-mono font-bold text-sm ${isUrgent ? 'text-red-600 animate-pulse' : 'text-orange-600'}`}>{timeLeft}</span>;
}

export default function FlashSalePage() {
  const navigate = useNavigate();

  const { data: items = [], isLoading: loading } = useQuery<FlashSaleItem[]>({
    queryKey: ['flash-sales'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('flash_sales' as any)
        .select('id, product_id, original_price, flash_price, stock_available, stock_sold, start_time, end_time, status, products(name, image_url, merchants(name))')
        .eq('status', 'active')
        .lte('start_time', now)
        .gte('end_time', now)
        .order('end_time', { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map(fs => ({
        id: fs.id,
        product_id: fs.product_id,
        product_name: fs.products?.name || 'Produk',
        product_image: fs.products?.image_url || null,
        merchant_name: fs.products?.merchants?.name || '',
        original_price: fs.original_price,
        flash_price: fs.flash_price,
        stock_available: fs.stock_available,
        stock_sold: fs.stock_sold || 0,
        end_time: fs.end_time,
        discount_pct: Math.round(((fs.original_price - fs.flash_price) / fs.original_price) * 100),
      }));
    },
    staleTime: 60_000,
  });

  const stockPct = (item: FlashSaleItem) => {
    const total = item.stock_available + item.stock_sold;
    return total === 0 ? 0 : Math.round((item.stock_sold / total) * 100);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-2" />Kembali
        </Button>
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-5 mb-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-6 w-6 fill-white" />
            <h1 className="text-2xl font-bold">Flash Sale</h1>
          </div>
          <p className="text-orange-100 text-sm">Penawaran terbatas waktu! Jangan sampai kehabisan.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Tidak ada flash sale aktif</p>
            <p className="text-sm mt-1">Cek lagi nanti untuk penawaran menarik</p>
            <Button className="mt-4" onClick={() => navigate('/')}>Kembali ke Beranda</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => {
              const sold = stockPct(item);
              const remaining = item.stock_available - item.stock_sold;
              return (
                <Card key={item.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/product/${item.product_id}`)}>
                  <div className="relative">
                    <img src={item.product_image || '/placeholder.jpg'} alt={item.product_name} className="w-full h-36 object-cover" />
                    <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2">-{item.discount_pct}%</Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm line-clamp-2 leading-tight">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.merchant_name}</p>
                    <div className="mt-2">
                      <p className="text-emerald-600 font-bold">{formatPrice(item.flash_price)}</p>
                      <p className="text-xs text-muted-foreground line-through">{formatPrice(item.original_price)}</p>
                    </div>
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${sold}%` }} />
                      </div>
                      <p className="text-xs text-orange-600 mt-1">
                        {remaining <= 0 ? 'Habis' : remaining <= 5 ? `Sisa ${remaining}!` : `Sisa ${remaining}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <CountdownTimer endTime={item.end_time} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
