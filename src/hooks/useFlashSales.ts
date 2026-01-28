import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FlashSale {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  merchantId: string;
  merchantName: string;
  originalPrice: number;
  flashPrice: number;
  discountPercent: number;
  stockAvailable: number;
  stockSold: number;
  endTime: string;
  reason: string | null;
}

interface UseFlashSalesOptions {
  merchantId?: string;
  limit?: number;
  nearbyOnly?: boolean;
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
}

export function useFlashSales(options: UseFlashSalesOptions = {}) {
  const {
    merchantId,
    limit = 10,
  } = options;

  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFlashSales = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('flash_sales' as any)
        .select(`
          id,
          product_id,
          merchant_id,
          original_price,
          flash_price,
          stock_available,
          stock_sold,
          end_time,
          reason,
          products:product_id (
            name,
            image_url
          ),
          merchants:merchant_id (
            name
          )
        `)
        .eq('status', 'ACTIVE')
        .gt('end_time', new Date().toISOString())
        .gt('stock_available', supabase.rpc('get_stock_sold_ref' as any))
        .order('end_time', { ascending: true })
        .limit(limit);

      if (merchantId) {
        query = query.eq('merchant_id', merchantId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const mappedSales: FlashSale[] = ((data || []) as any[]).map((sale: any) => ({
        id: sale.id,
        productId: sale.product_id,
        productName: sale.products?.name || 'Unknown',
        productImage: sale.products?.image_url || null,
        merchantId: sale.merchant_id,
        merchantName: sale.merchants?.name || 'Unknown',
        originalPrice: sale.original_price,
        flashPrice: sale.flash_price,
        discountPercent: Math.round((1 - sale.flash_price / sale.original_price) * 100),
        stockAvailable: sale.stock_available,
        stockSold: sale.stock_sold,
        endTime: sale.end_time,
        reason: sale.reason,
      }));

      setFlashSales(mappedSales);
      setError(null);
    } catch (err) {
      console.error('Error fetching flash sales:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [merchantId, limit]);

  useEffect(() => {
    fetchFlashSales();

    // Set up realtime subscription
    const channel = supabase
      .channel('flash_sales_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flash_sales',
        },
        () => {
          fetchFlashSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFlashSales]);

  return {
    flashSales,
    loading,
    error,
    refetch: fetchFlashSales,
  };
}

// Hook for checking if a product has active flash sale
export function useProductFlashSale(productId: string | undefined) {
  const [flashSale, setFlashSale] = useState<FlashSale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const fetchFlashSale = async () => {
      try {
        const { data, error } = await supabase
          .from('flash_sales' as any)
          .select(`
            id,
            product_id,
            merchant_id,
            original_price,
            flash_price,
            stock_available,
            stock_sold,
            end_time,
            reason,
            products:product_id (name, image_url),
            merchants:merchant_id (name)
          `)
          .eq('product_id', productId)
          .eq('status', 'ACTIVE')
          .gt('end_time', new Date().toISOString())
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const sale = data as any;
          setFlashSale({
            id: sale.id,
            productId: sale.product_id,
            productName: sale.products?.name || 'Unknown',
            productImage: sale.products?.image_url || null,
            merchantId: sale.merchant_id,
            merchantName: sale.merchants?.name || 'Unknown',
            originalPrice: sale.original_price,
            flashPrice: sale.flash_price,
            discountPercent: Math.round((1 - sale.flash_price / sale.original_price) * 100),
            stockAvailable: sale.stock_available,
            stockSold: sale.stock_sold,
            endTime: sale.end_time,
            reason: sale.reason,
          });
        } else {
          setFlashSale(null);
        }
      } catch (err) {
        console.error('Error fetching product flash sale:', err);
        setFlashSale(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFlashSale();
  }, [productId]);

  return { flashSale, loading };
}
