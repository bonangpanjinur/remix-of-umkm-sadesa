/**
 * S4-06: Multi-order batching — gabung 2+ order dalam 1 kurir
 */
import { useState, useEffect } from 'react';
import { Package, MapPin, Clock, ChevronDown, ChevronUp, Layers, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_address: string;
  merchant_name: string;
  total: number;
  status: string;
  distance_km?: number;
  created_at: string;
}

interface OrderBatchingPanelProps {
  courierId: string;
  activeOrders: BatchOrder[];
  onRefresh: () => void;
}

export function OrderBatchingPanel({ courierId, activeOrders, onRefresh }: OrderBatchingPanelProps) {
  const [nearbyOrders, setNearbyOrders] = useState<BatchOrder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (expanded) fetchNearbyOrders();
  }, [expanded]);

  const fetchNearbyOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders' as any)
        .select(`
          id, order_number, total, status, created_at,
          profiles:user_id(full_name),
          merchants:merchant_id(name, address)
        `)
        .eq('status', 'PAID')
        .is('courier_id', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) throw error;

      const mapped = ((data as any[]) || []).map((o) => ({
        id: o.id,
        order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
        buyer_name: o.profiles?.full_name || 'Pembeli',
        buyer_address: o.shipping_address || '-',
        merchant_name: o.merchants?.name || '-',
        total: o.total,
        status: o.status,
        created_at: o.created_at,
      }));

      setNearbyOrders(mapped);
    } catch (err) {
      console.error('Failed to fetch nearby orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < 3) next.add(id);
    else toast.warning('Maksimal 3 pesanan per batch');
    setSelected(next);
  };

  const acceptBatch = async () => {
    if (selected.size < 2) { toast.warning('Pilih minimal 2 pesanan untuk batching'); return; }
    setAccepting(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from('orders' as any)
        .update({ courier_id: courierId, status: 'ASSIGNED', assigned_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;

      toast.success(`${ids.length} pesanan berhasil di-batch dan diterima!`);
      setSelected(new Set());
      onRefresh();
      fetchNearbyOrders();
    } catch (err: any) {
      toast.error('Gagal menerima batch: ' + (err.message || 'Coba lagi'));
    } finally {
      setAccepting(false);
    }
  };

  const canBatch = activeOrders.length < 3;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Multi-Order Batching
            {activeOrders.length > 0 && (
              <Badge variant="secondary">{activeOrders.length} aktif</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gabungkan 2–3 pesanan searah untuk efisiensi pengiriman
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {!canBatch && (
            <div className="text-center py-3 text-sm text-muted-foreground bg-muted rounded-lg">
              Selesaikan dulu sebagian pesanan aktif (maks 3 total)
            </div>
          )}

          {canBatch && (
            <>
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : nearbyOrders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-3">
                  Tidak ada pesanan tersedia untuk di-batch
                </p>
              ) : (
                <div className="space-y-2">
                  {nearbyOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${selected.has(order.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => toggleSelect(order.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected.has(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">#{order.order_number}</span>
                            <span className="text-xs font-medium text-primary">
                              Rp {order.total.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Package className="h-3 w-3" />
                            <span className="truncate">{order.merchant_name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{order.buyer_name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected.size >= 2 && (
                <Button className="w-full" onClick={acceptBatch} disabled={accepting}>
                  {accepting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Menerima batch...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Terima {selected.size} Pesanan Sekaligus
                    </div>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
