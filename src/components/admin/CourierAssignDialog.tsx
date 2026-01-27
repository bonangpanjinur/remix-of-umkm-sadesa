import { useState, useEffect } from 'react';
import { Truck, MapPin, Package, Loader2, Zap, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { autoAssignCourier, manualAssignCourier, getAvailableCouriers } from '@/lib/courierApi';

interface CourierAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  merchantLat?: number;
  merchantLng?: number;
  onSuccess?: () => void;
}

interface AvailableCourier {
  id: string;
  name: string;
  vehicle_type: string;
  distance_km?: number;
  active_orders: number;
}

export function CourierAssignDialog({
  open,
  onOpenChange,
  orderId,
  merchantLat,
  merchantLng,
  onSuccess,
}: CourierAssignDialogProps) {
  const [couriers, setCouriers] = useState<AvailableCourier[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  useEffect(() => {
    if (open) {
      loadCouriers();
    }
  }, [open, merchantLat, merchantLng]);

  const loadCouriers = async () => {
    setLoading(true);
    try {
      const data = await getAvailableCouriers(merchantLat, merchantLng);
      setCouriers(data);
    } catch (error) {
      console.error('Error loading couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      const result = await autoAssignCourier(orderId, merchantLat, merchantLng);
      
      if (result.success && result.courier) {
        toast.success(`Kurir ${result.courier.name} berhasil ditugaskan`);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || 'Tidak ada kurir yang tersedia');
      }
    } catch (error) {
      toast.error('Gagal menugaskan kurir otomatis');
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleManualAssign = async (courierId: string) => {
    setAssigning(true);
    try {
      const result = await manualAssignCourier(orderId, courierId);
      
      if (result.success) {
        toast.success('Kurir berhasil ditugaskan');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || 'Gagal menugaskan kurir');
      }
    } catch (error) {
      toast.error('Gagal menugaskan kurir');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Tugaskan Kurir
          </DialogTitle>
          <DialogDescription>
            Pilih kurir untuk mengantarkan pesanan ini
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto-assign button */}
          <Button
            onClick={handleAutoAssign}
            disabled={autoAssigning || loading}
            className="w-full"
            size="lg"
          >
            {autoAssigning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Assign Otomatis (Terdekat)
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                atau pilih manual
              </span>
            </div>
          </div>

          {/* Manual selection list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : couriers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Tidak ada kurir yang tersedia</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {couriers.map((courier) => (
                  <div
                    key={courier.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary transition cursor-pointer"
                    onClick={() => handleManualAssign(courier.id)}
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{courier.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{courier.vehicle_type}</span>
                        {courier.distance_km !== undefined && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {courier.distance_km.toFixed(1)} km
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={courier.active_orders === 0 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        <Package className="h-3 w-3 mr-1" />
                        {courier.active_orders} aktif
                      </Badge>
                      <Button size="sm" variant="outline" disabled={assigning}>
                        Pilih
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
