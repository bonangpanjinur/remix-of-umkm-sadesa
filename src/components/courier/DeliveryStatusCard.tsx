import { motion } from 'framer-motion';
import { CheckCircle, Package, Truck, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryStatus {
  status: 'NEW' | 'PROCESSING' | 'ASSIGNED' | 'PICKED_UP' | 'SENT' | 'ON_DELIVERY' | 'DELIVERED' | 'DONE';
  created_at: string;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
}

interface DeliveryStatusCardProps {
  order: DeliveryStatus;
  showEstimate?: boolean;
}

const statusSteps = [
  { key: 'NEW', label: 'Pesanan Dibuat', icon: Package },
  { key: 'ASSIGNED', label: 'Kurir Ditugaskan', icon: Truck },
  { key: 'PICKED_UP', label: 'Pesanan Diambil', icon: MapPin },
  { key: 'DELIVERED', label: 'Sampai Tujuan', icon: CheckCircle },
];

const statusOrder = ['NEW', 'PROCESSING', 'ASSIGNED', 'PICKED_UP', 'SENT', 'ON_DELIVERY', 'DELIVERED', 'DONE'];

export function DeliveryStatusCard({ order, showEstimate = true }: DeliveryStatusCardProps) {
  const currentIndex = statusOrder.indexOf(order.status);

  const getStepTime = (stepKey: string): string | null => {
    switch (stepKey) {
      case 'NEW':
        return order.created_at;
      case 'ASSIGNED':
        return order.assigned_at || null;
      case 'PICKED_UP':
        return order.picked_up_at || null;
      case 'DELIVERED':
        return order.delivered_at || null;
      default:
        return null;
    }
  };

  const isStepCompleted = (stepKey: string): boolean => {
    const stepIndex = statusOrder.indexOf(stepKey);
    return currentIndex >= stepIndex;
  };

  const isStepActive = (stepKey: string): boolean => {
    // For SENT/ON_DELIVERY, highlight DELIVERED as active
    if ((order.status === 'ON_DELIVERY' || order.status === 'SENT') && stepKey === 'DELIVERED') {
      return true;
    }
    return order.status === stepKey;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEstimatedTime = () => {
    if (!order.picked_up_at) return null;
    // Estimate 20-30 minutes after pickup
    const pickupTime = new Date(order.picked_up_at);
    const etaMin = new Date(pickupTime.getTime() + 20 * 60 * 1000);
    const etaMax = new Date(pickupTime.getTime() + 30 * 60 * 1000);
    return `${etaMin.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${etaMax.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusLabel = () => {
    switch (order.status) {
      case 'NEW':
      case 'PROCESSING':
        return 'Menunggu Kurir';
      case 'ASSIGNED':
        return 'Kurir Dalam Perjalanan ke Toko';
      case 'PICKED_UP':
        return 'Kurir Mengambil Pesanan';
      case 'SENT':
      case 'ON_DELIVERY':
        return 'Kurir Sedang Mengantar';
      case 'DELIVERED':
      case 'DONE':
        return 'Pesanan Terkirim';
      default:
        return order.status;
    }
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      {/* Current Status Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          order.status === 'DELIVERED' || order.status === 'DONE' 
            ? 'bg-green-500' 
            : 'bg-primary'
        )}>
          {order.status === 'DELIVERED' || order.status === 'DONE' ? (
            <CheckCircle className="h-6 w-6 text-white" />
          ) : order.status === 'ON_DELIVERY' || order.status === 'SENT' || order.status === 'PICKED_UP' ? (
            <Truck className="h-6 w-6 text-white" />
          ) : (
            <Package className="h-6 w-6 text-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg">{getStatusLabel()}</p>
          {showEstimate && (order.status === 'ON_DELIVERY' || order.status === 'SENT') && getEstimatedTime() && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Estimasi tiba: {getEstimatedTime()}
            </p>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="space-y-0">
        {statusSteps.map((step, index) => {
          const isCompleted = isStepCompleted(step.key);
          const isActive = isStepActive(step.key);
          const stepTime = getStepTime(step.key);
          const StepIcon = step.icon;

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3"
            >
              {/* Icon and Line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                {index < statusSteps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-10 transition-all",
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <p
                  className={cn(
                    "font-medium",
                    isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                {stepTime && (
                  <p className="text-sm text-muted-foreground">
                    {formatTime(stepTime)}
                  </p>
                )}
                {isActive && !isCompleted && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    Sedang berlangsung
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
