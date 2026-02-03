import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Package, 
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { CourierLayout } from '@/components/courier/CourierLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
}

export default function CourierHistoryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPOD, setSelectedPOD] = useState<DeliveryRecord | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDeliveries();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading]);

  const fetchDeliveries = async () => {
    if (!user) return;

    try {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id, registration_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!courier || courier.registration_status !== 'APPROVED') {
        navigate('/courier');
        return;
      }

      const { data } = await supabase
        .from('orders')
        .select('id, status, total, shipping_cost, delivery_name, delivery_phone, delivery_address, pod_image_url, pod_notes, pod_uploaded_at, delivered_at, created_at, assigned_at, picked_up_at')
        .eq('courier_id', courier.id)
        .order('created_at', { ascending: false });

      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedDeliveries = deliveries.filter(d => d.status === 'DELIVERED' || d.status === 'DONE');
  const cancelledDeliveries = deliveries.filter(d => d.status === 'CANCELLED');
  const allDeliveries = deliveries;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'success' | 'destructive' | 'info' | 'warning' | 'pending' | 'secondary'; label: string }> = {
      DELIVERED: { variant: 'success', label: 'Terkirim' },
      DONE: { variant: 'success', label: 'Selesai' },
      CANCELLED: { variant: 'destructive', label: 'Dibatalkan' },
      ASSIGNED: { variant: 'info', label: 'Ditugaskan' },
      PICKED_UP: { variant: 'warning', label: 'Diambil' },
      ON_DELIVERY: { variant: 'info', label: 'Dalam Perjalanan' },
    };
    const style = styles[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={style.variant}>{style.label}</Badge>;
  };

  const DeliveryCard = ({ delivery }: { delivery: DeliveryRecord }) => {
    const courierEarning = delivery.shipping_cost * 0.8;
    
    return (
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
                <p className="text-muted-foreground text-xs line-clamp-2">
                  {delivery.delivery_address || '-'}
                </p>
              </div>
            </div>

            {delivery.delivered_at && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs">
                  Diantar: {format(new Date(delivery.delivered_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Pendapatan</p>
              <p className="font-bold text-primary">+{formatPrice(courierEarning)}</p>
            </div>
            
            {delivery.pod_image_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPOD(delivery)}
              >
                <ImageIcon className="h-4 w-4 mr-1" />
                Lihat POD
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (authLoading || loading) {
    return (
      <CourierLayout title="Riwayat Pengiriman">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </CourierLayout>
    );
  }

  return (
    <CourierLayout title="Riwayat Pengiriman" subtitle="Detail semua pengiriman Anda">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{allDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{completedDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">Selesai</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold">{cancelledDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">Batal</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">Semua</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Selesai</TabsTrigger>
          <TabsTrigger value="cancelled" className="flex-1">Batal</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {allDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada riwayat pengiriman</p>
            </div>
          ) : (
            allDeliveries.map(d => <DeliveryCard key={d.id} delivery={d} />)
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {completedDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada pengiriman selesai</p>
            </div>
          ) : (
            completedDeliveries.map(d => <DeliveryCard key={d.id} delivery={d} />)
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4 space-y-3">
          {cancelledDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Tidak ada pengiriman batal</p>
            </div>
          ) : (
            cancelledDeliveries.map(d => <DeliveryCard key={d.id} delivery={d} />)
          )}
        </TabsContent>
      </Tabs>

      {/* POD Dialog */}
      <Dialog open={!!selectedPOD} onOpenChange={() => setSelectedPOD(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bukti Pengiriman (POD)</DialogTitle>
          </DialogHeader>
          {selectedPOD && (
            <div className="space-y-4">
              <img
                src={selectedPOD.pod_image_url!}
                alt="Bukti Pengiriman"
                className="w-full rounded-lg"
              />
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
