import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Calendar, MapPin, CheckCircle, XCircle, Image as ImageIcon, Bike } from 'lucide-react';
import { CourierLayout } from '@/components/courier/CourierLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface DeliveryRecord {
  id: string;
  status: string;
  total: number;
  shipping_cost: number;
  delivery_name: string | null;
  delivery_phone: string | null;
  delivery_address: string | null;
  pod_image_url: string | null;
  pod_notes: string | null;
  pod_uploaded_at: string | null;
  delivered_at: string | null;
  created_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivery_type: string;
}

export default function CourierHistoryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPOD, setSelectedPOD] = useState<DeliveryRecord | null>(null);
  const [serviceTab, setServiceTab] = useState<'delivery' | 'ride'>('delivery');

  useEffect(() => {
    if (!authLoading && user) fetchDeliveries();
    else if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading]);

  const fetchDeliveries = async () => {
    if (!user) return;
    try {
      const { data: courier } = await supabase.from('couriers').select('id, registration_status').eq('user_id', user.id).maybeSingle();
      if (!courier || courier.registration_status !== 'APPROVED') { navigate('/courier'); return; }

      const { data } = await supabase
        .from('orders')
        .select('id, status, total, shipping_cost, delivery_name, delivery_phone, delivery_address, pod_image_url, pod_notes, pod_uploaded_at, delivered_at, created_at, assigned_at, picked_up_at, delivery_type')
        .eq('courier_id', courier.id)
        .order('created_at', { ascending: false });

      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Split by service type — ride orders have delivery_type 'RIDE', rest are delivery
  const rideOrders = deliveries.filter(d => d.delivery_type === 'RIDE');
  const deliveryOrders = deliveries.filter(d => d.delivery_type !== 'RIDE');
  const currentList = serviceTab === 'ride' ? rideOrders : deliveryOrders;

  const completedList = currentList.filter(d => d.status === 'DELIVERED' || d.status === 'DONE');
  const cancelledList = currentList.filter(d => d.status === 'CANCELLED');

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'success' | 'destructive' | 'info' | 'warning' | 'pending' | 'secondary'; label: string }> = {
      DELIVERED: { variant: 'success', label: 'Terkirim' },
      DONE: { variant: 'success', label: 'Selesai' },
      CANCELLED: { variant: 'destructive', label: 'Dibatalkan' },
      ASSIGNED: { variant: 'info', label: 'Ditugaskan' },
      PICKED_UP: { variant: 'warning', label: 'Diambil' },
      SENT: { variant: 'info', label: 'Dalam Perjalanan' },
      ON_DELIVERY: { variant: 'info', label: 'Dalam Perjalanan' },
    };
    const style = styles[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={style.variant}>{style.label}</Badge>;
  };

  const DeliveryCard = ({ delivery }: { delivery: DeliveryRecord }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-mono text-sm font-medium">#{delivery.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              {format(new Date(delivery.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
            </p>
          </div>
          {getStatusBadge(delivery.status)}
        </div>
        <div className="space-y-2 text-sm mb-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{delivery.delivery_name || 'Pelanggan'}</p>
              <p className="text-muted-foreground text-xs line-clamp-2">{delivery.delivery_address || '-'}</p>
            </div>
          </div>
          {delivery.delivered_at && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Diantar: {format(new Date(delivery.delivered_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Ongkir</p>
            <p className="font-bold text-primary">{formatPrice(delivery.shipping_cost)}</p>
          </div>
          {delivery.pod_image_url && (
            <Button variant="outline" size="sm" onClick={() => setSelectedPOD(delivery)}>
              <ImageIcon className="h-4 w-4 mr-1" /> Lihat POD
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading || loading) {
    return (
      <CourierLayout title="Riwayat">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </CourierLayout>
    );
  }

  return (
    <CourierLayout title="Riwayat" subtitle="Pengiriman & ojek">
      {/* Service type tabs */}
      <div className="flex gap-2 mb-4">
        <Button variant={serviceTab === 'delivery' ? 'default' : 'outline'} size="sm" onClick={() => setServiceTab('delivery')}>
          <Package className="h-4 w-4 mr-1" /> Pengiriman ({deliveryOrders.length})
        </Button>
        <Button variant={serviceTab === 'ride' ? 'default' : 'outline'} size="sm" onClick={() => setServiceTab('ride')}>
          <Bike className="h-4 w-4 mr-1" /> Ojek ({rideOrders.length})
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{currentList.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{completedList.length}</p>
            <p className="text-xs text-muted-foreground">Selesai</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">{cancelledList.length}</p>
            <p className="text-xs text-muted-foreground">Batal</p>
          </CardContent>
        </Card>
      </div>

      {/* Status tabs */}
      <Tabs defaultValue="all">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">Semua</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Selesai</TabsTrigger>
          <TabsTrigger value="cancelled" className="flex-1">Batal</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {currentList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada riwayat {serviceTab === 'ride' ? 'ojek' : 'pengiriman'}</p>
            </div>
          ) : currentList.map(d => <DeliveryCard key={d.id} delivery={d} />)}
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          {completedList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>Belum ada yang selesai</p></div>
          ) : completedList.map(d => <DeliveryCard key={d.id} delivery={d} />)}
        </TabsContent>
        <TabsContent value="cancelled" className="mt-4 space-y-3">
          {cancelledList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>Tidak ada yang batal</p></div>
          ) : cancelledList.map(d => <DeliveryCard key={d.id} delivery={d} />)}
        </TabsContent>
      </Tabs>

      {/* POD Dialog */}
      <Dialog open={!!selectedPOD} onOpenChange={() => setSelectedPOD(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bukti Pengiriman (POD)</DialogTitle></DialogHeader>
          {selectedPOD && (
            <div className="space-y-4">
              <img src={selectedPOD.pod_image_url!} alt="Bukti Pengiriman" className="w-full rounded-lg" />
              {selectedPOD.pod_notes && (
                <div className="bg-secondary p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Catatan:</p>
                  <p className="text-sm">{selectedPOD.pod_notes}</p>
                </div>
              )}
              {selectedPOD.pod_uploaded_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Diunggah: {format(new Date(selectedPOD.pod_uploaded_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CourierLayout>
  );
}
