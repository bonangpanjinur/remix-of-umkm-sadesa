import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Truck, Package, Loader2, CheckCircle, CreditCard, Wallet, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { createPaymentInvoice, isXenditEnabled } from '@/lib/paymentApi';
import { CheckoutAddressForm, createEmptyCheckoutAddress, type CheckoutAddressData } from '@/components/checkout/CheckoutAddressForm';
import { formatFullAddress } from '@/components/AddressSelector';
import { fetchCODSettings, quickCODCheck, getBuyerCODStatus } from '@/lib/codSecurity';
import { validatePhone, isWhatsAppFormat } from '@/lib/phoneValidation';
import { useMerchantQuota, useMerchantQuotaForOrder, notifyMerchantLowQuota } from '@/hooks/useMerchantQuota';
import { QuotaBlockedAlert } from '@/components/checkout/QuotaBlockedAlert';
import { getMerchantOperatingStatus, formatTime } from '@/lib/merchantOperatingHours';

type PaymentMethod = 'COD' | 'ONLINE';

interface MerchantOperatingInfo {
  id: string;
  name: string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, getCartTotal, clearCart, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'INTERNAL'>('INTERNAL');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [xenditAvailable, setXenditAvailable] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Address state
  const [addressData, setAddressData] = useState<CheckoutAddressData>(createEmptyCheckoutAddress());
  
  // Distance & COD state
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [codSettings, setCodSettings] = useState<Awaited<ReturnType<typeof fetchCODSettings>> | null>(null);
  const [codStatus, setCodStatus] = useState<Awaited<ReturnType<typeof getBuyerCODStatus>> | null>(null);
  const [codEligible, setCodEligible] = useState(true);
  const [codReason, setCodReason] = useState<string | null>(null);

  // Check if Xendit is enabled and load COD settings
  useEffect(() => {
    isXenditEnabled().then(setXenditAvailable);
    fetchCODSettings().then(setCodSettings);
  }, []);

  // Load buyer COD status
  useEffect(() => {
    if (user) {
      getBuyerCODStatus(user.id).then(setCodStatus);
    }
  }, [user]);

  // Get merchant location from first item (simplified - assumes single merchant)
  const merchantLocation = useMemo(() => {
    // In a real app, you'd fetch this from merchant data
    // For now, return null - will be enhanced when merchant has location
    return null;
  }, [items]);

  const subtotal = getCartTotal();
  
  // Calculate shipping based on distance
  const shippingCost = useMemo(() => {
    if (deliveryType === 'PICKUP') return 0;
    
    // Base shipping calculation
    const baseFee = 5000;
    const perKmFee = 2000;
    
    if (distanceKm !== null && distanceKm > 0) {
      return Math.min(50000, Math.max(baseFee, baseFee + Math.round(distanceKm * perKmFee)));
    }
    
    return baseFee;
  }, [deliveryType, distanceKm]);

  // COD service fee
  const codServiceFee = paymentMethod === 'COD' && codSettings ? codSettings.serviceFee : 0;
  
  const total = subtotal + shippingCost + codServiceFee;

  // Check COD eligibility when amount or distance changes
  useEffect(() => {
    if (!codSettings) return;
    
    // Check if COD is globally disabled
    if (!codSettings.enabled) {
      setCodEligible(false);
      setCodReason('Fitur COD sementara tidak tersedia');
      return;
    }

    // Check buyer COD status
    if (codStatus && !codStatus.enabled) {
      setCodEligible(false);
      setCodReason('Akun Anda tidak dapat menggunakan fitur COD');
      return;
    }

    // Quick check for amount and distance
    const check = quickCODCheck(subtotal, distanceKm || undefined, {
      maxAmount: codSettings.maxAmount,
      maxDistanceKm: codSettings.maxDistanceKm,
    });

    setCodEligible(check.eligible);
    setCodReason(check.reason);

    // If COD is not eligible and currently selected, switch to online
    if (!check.eligible && paymentMethod === 'COD' && xenditAvailable) {
      setPaymentMethod('ONLINE');
    }
  }, [subtotal, distanceKm, codSettings, codStatus, paymentMethod, xenditAvailable]);

  // Group items by merchant
  const itemsByMerchant = items.reduce((acc, item) => {
    const merchantId = item.product.merchantId;
    if (!acc[merchantId]) {
      acc[merchantId] = {
        merchantName: item.product.merchantName,
        items: [],
      };
    }
    acc[merchantId].items.push(item);
    return acc;
  }, {} as Record<string, { merchantName: string; items: typeof items }>);

  // Get unique merchant IDs for quota check
  const merchantIds = useMemo(() => Object.keys(itemsByMerchant), [itemsByMerchant]);

  // Check merchant quotas
  const { 
    blockedMerchants, 
    canProceedCheckout, 
    loading: quotaLoading,
    quotaStatuses 
  } = useMerchantQuota(merchantIds);

  // Check merchant operating hours
  const [merchantOperatingInfo, setMerchantOperatingInfo] = useState<Record<string, MerchantOperatingInfo>>({});
  const [operatingHoursLoading, setOperatingHoursLoading] = useState(false);

  useEffect(() => {
    const loadMerchantOperatingHours = async () => {
      if (merchantIds.length === 0) return;
      
      setOperatingHoursLoading(true);
      try {
        const { data } = await supabase
          .from('merchants')
          .select('id, name, is_open, open_time, close_time')
          .in('id', merchantIds);

        if (data) {
          const info: Record<string, MerchantOperatingInfo> = {};
          data.forEach(m => {
            info[m.id] = {
              id: m.id,
              name: m.name,
              isOpen: m.is_open,
              openTime: m.open_time,
              closeTime: m.close_time,
            };
          });
          setMerchantOperatingInfo(info);
        }
      } catch (error) {
        console.error('Error loading merchant operating hours:', error);
      } finally {
        setOperatingHoursLoading(false);
      }
    };

    loadMerchantOperatingHours();
  }, [merchantIds.join(',')]);

  // Get closed merchants
  const closedMerchants = useMemo(() => {
    return Object.values(merchantOperatingInfo).filter(m => {
      const status = getMerchantOperatingStatus(m.isOpen, m.openTime, m.closeTime);
      return !status.isCurrentlyOpen;
    });
  }, [merchantOperatingInfo]);

  const allMerchantsOpen = closedMerchants.length === 0;

  // Remove items from a specific merchant
  const handleRemoveMerchantItems = (merchantId: string) => {
    const merchantItems = itemsByMerchant[merchantId]?.items || [];
    merchantItems.forEach(item => {
      removeFromCart(item.product.id);
    });
    toast({
      title: 'Produk dihapus',
      description: `Produk dari ${itemsByMerchant[merchantId]?.merchantName || 'toko'} telah dihapus dari keranjang`,
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!addressData.name || addressData.name.length < 2) {
      newErrors.name = 'Nama minimal 2 karakter';
    }

    if (!addressData.phone || !validatePhone(addressData.phone).isValid) {
      newErrors.phone = 'Nomor telepon tidak valid';
    }

    // Validate WhatsApp format for COD
    if (paymentMethod === 'COD' && !isWhatsAppFormat(addressData.phone)) {
      newErrors.phone = 'Untuk COD, gunakan format WhatsApp (08xxx)';
    }

    if (!addressData.address.village) {
      newErrors.address = 'Pilih alamat lengkap sampai kelurahan/desa';
    }

    if (deliveryType === 'INTERNAL' && !addressData.location) {
      newErrors.location = 'Tentukan titik lokasi pengiriman di peta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Silakan login terlebih dahulu',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (items.length === 0) {
      toast({
        title: 'Keranjang kosong',
        variant: 'destructive',
      });
      return;
    }

    // Check if any merchant has no quota
    if (!canProceedCheckout) {
      toast({
        title: 'Tidak dapat melanjutkan',
        description: 'Beberapa toko tidak memiliki kuota transaksi aktif',
        variant: 'destructive',
      });
      return;
    }

    // Check if any merchant is closed
    if (!allMerchantsOpen) {
      const closedNames = closedMerchants.map(m => m.name).join(', ');
      toast({
        title: 'Toko sedang tutup',
        description: `${closedNames} sedang tidak menerima pesanan`,
        variant: 'destructive',
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: 'Data belum lengkap',
        description: 'Silakan lengkapi form checkout',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const fullAddress = formatFullAddress(addressData.address);

      // Create order for each merchant
      for (const [merchantId, merchantData] of Object.entries(itemsByMerchant)) {
        const merchantSubtotal = merchantData.items.reduce(
          (sum, item) => sum + item.product.price * item.quantity, 
          0
        );
        const merchantShipping = deliveryType === 'INTERNAL' ? shippingCost : 0;
        const merchantCodFee = paymentMethod === 'COD' ? codServiceFee : 0;
        const merchantTotal = merchantSubtotal + merchantShipping + merchantCodFee;

        // Calculate confirmation deadline for COD orders
        const confirmationDeadline = paymentMethod === 'COD' && codSettings
          ? new Date(Date.now() + codSettings.confirmationTimeoutMinutes * 60 * 1000).toISOString()
          : null;

        // Insert order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            buyer_id: user.id,
            merchant_id: merchantId,
            status: paymentMethod === 'COD' ? 'PENDING_CONFIRMATION' : 'NEW',
            handled_by: 'ADMIN',
            delivery_type: deliveryType,
            delivery_name: addressData.name,
            delivery_phone: addressData.phone,
            delivery_address: fullAddress,
            delivery_lat: addressData.location?.lat || null,
            delivery_lng: addressData.location?.lng || null,
            shipping_cost: merchantShipping,
            subtotal: merchantSubtotal,
            total: merchantTotal,
            notes: notes || null,
            payment_method: paymentMethod,
            payment_status: paymentMethod === 'COD' ? 'COD' : 'UNPAID',
            confirmation_deadline: confirmationDeadline,
            cod_service_fee: merchantCodFee,
            buyer_distance_km: distanceKm,
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
          throw orderError;
        }

        // Insert order items
        const orderItems = merchantData.items.map(item => ({
          order_id: orderData.id,
          product_id: item.product.id,
          product_name: item.product.name,
          product_price: item.product.price,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          throw itemsError;
        }

        // Use merchant quota after successful order
        const quotaUsed = await useMerchantQuotaForOrder(merchantId);
        if (quotaUsed) {
          // Check remaining quota and send notification if low/empty
          const quotaStatus = quotaStatuses[merchantId];
          if (quotaStatus) {
            const newRemaining = quotaStatus.remainingQuota - 1;
            if (newRemaining <= 0) {
              await notifyMerchantLowQuota(merchantId, 0, 'empty');
            } else if (newRemaining <= 5) {
              await notifyMerchantLowQuota(merchantId, newRemaining, 'low');
            }
          }
        }

        setOrderId(orderData.id);

        // If online payment, create Xendit invoice
        if (paymentMethod === 'ONLINE' && xenditAvailable) {
          try {
            const invoice = await createPaymentInvoice({
              orderId: orderData.id,
              amount: merchantTotal,
              payerEmail: user.email || `${user.id}@placeholder.com`,
              description: `Order dari ${merchantData.merchantName}`,
            });

            setInvoiceUrl(invoice.invoice_url);
            
            // Redirect to payment page
            window.location.href = invoice.invoice_url;
            return;
          } catch (paymentError) {
            console.error('Payment error:', paymentError);
            toast({
              title: 'Pesanan dibuat, tapi pembayaran gagal',
              description: 'Silakan bayar dari halaman pesanan Anda',
              variant: 'destructive',
            });
          }
        }
      }

      // Clear cart and show success
      clearCart();
      setSuccess(true);
      toast({
        title: 'Pesanan berhasil dibuat!',
        description: 'Pesanan Anda telah masuk ke sistem dan sedang menunggu diproses',
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Gagal membuat pesanan',
        description: 'Terjadi kesalahan, silakan coba lagi',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Pesanan Berhasil!
          </h1>
          <p className="text-muted-foreground mb-6">
            Pesanan Anda telah masuk ke sistem dan sedang menunggu konfirmasi dari penjual.
          </p>
          <div className="space-y-3">
            <Button onClick={() => navigate('/orders')} className="w-full">
              Lihat Pesanan Saya
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Lanjut Belanja
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-secondary flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold text-lg text-foreground">Checkout</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-56">
        {/* Quota Blocked Alert */}
        {!quotaLoading && blockedMerchants.length > 0 && (
          <QuotaBlockedAlert 
            blockedMerchants={blockedMerchants}
            onRemoveMerchantItems={handleRemoveMerchantItems}
          />
        )}

        {/* Closed Merchants Alert */}
        {!operatingHoursLoading && closedMerchants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-destructive text-sm mb-1">
                  Beberapa toko sedang tutup
                </h4>
                <div className="space-y-2">
                  {closedMerchants.map(m => {
                    const status = getMerchantOperatingStatus(m.isOpen, m.openTime, m.closeTime);
                    return (
                      <div key={m.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{status.reason}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMerchantItems(m.id)}
                          className="text-xs"
                        >
                          Hapus
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading quota check */}
        {(quotaLoading || operatingHoursLoading) && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Memeriksa ketersediaan toko...</span>
          </div>
        )}

        {/* Delivery Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Alamat Pengiriman</h3>
          </div>
          
          <CheckoutAddressForm
            value={addressData}
            onChange={setAddressData}
            onDistanceChange={setDistanceKm}
            merchantLocation={merchantLocation}
            errors={errors}
          />
        </motion.div>

        {/* Distance Info */}
        {distanceKm !== null && deliveryType === 'INTERNAL' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 rounded-lg p-3 mb-4 flex items-center gap-2"
          >
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Jarak pengiriman: <span className="font-medium text-foreground">{distanceKm.toFixed(1)} KM</span>
            </span>
          </motion.div>
        )}

        {/* Delivery Method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Metode Pengiriman</h3>
          </div>
          
          <RadioGroup 
            value={deliveryType} 
            onValueChange={(value) => setDeliveryType(value as 'PICKUP' | 'INTERNAL')}
            className="space-y-2"
          >
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
              deliveryType === 'INTERNAL' ? 'border-primary bg-primary/5' : 'border-border'
            }`}>
              <RadioGroupItem value="INTERNAL" id="internal" />
              <div className="flex-1">
                <p className="font-bold text-sm">Kurir Desa</p>
                <p className="text-xs text-muted-foreground">Dikirim ke alamat Anda</p>
              </div>
              <span className="text-sm font-bold text-primary">{formatPrice(shippingCost)}</span>
            </label>
            
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
              deliveryType === 'PICKUP' ? 'border-primary bg-primary/5' : 'border-border'
            }`}>
              <RadioGroupItem value="PICKUP" id="pickup" />
              <div className="flex-1">
                <p className="font-bold text-sm">Ambil Sendiri</p>
                <p className="text-xs text-muted-foreground">Ambil langsung di toko</p>
              </div>
              <span className="text-sm font-bold text-primary">Gratis</span>
            </label>
          </RadioGroup>
        </motion.div>

        {/* Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Metode Pembayaran</h3>
          </div>
          
          <RadioGroup 
            value={paymentMethod} 
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            className="space-y-2"
          >
            <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
              paymentMethod === 'COD' ? 'border-primary bg-primary/5' : 'border-border'
            } ${!codEligible ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <RadioGroupItem value="COD" id="cod" disabled={!codEligible} />
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">Bayar di Tempat (COD)</p>
                  {codStatus?.isVerified && (
                    <Badge variant="secondary" className="text-xs">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Bayar tunai saat pesanan tiba
                  {codServiceFee > 0 && ` (+${formatPrice(codServiceFee)} biaya layanan)`}
                </p>
                {!codEligible && codReason && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {codReason}
                  </p>
                )}
              </div>
            </label>
            
            {xenditAvailable && (
              <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                paymentMethod === 'ONLINE' ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <RadioGroupItem value="ONLINE" id="online" />
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-bold text-sm">Bayar Online</p>
                  <p className="text-xs text-muted-foreground">QRIS, Transfer Bank, E-Wallet</p>
                </div>
              </label>
            )}
          </RadioGroup>

          {/* COD Trust Score Info */}
          {codStatus && paymentMethod === 'COD' && (
            <div className="mt-3 p-2 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Skor Kepercayaan:</span>
                <span className={`font-medium ${
                  codStatus.trustScore >= 80 ? 'text-green-600' : 
                  codStatus.trustScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {codStatus.trustScore}/100
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-foreground">Ringkasan Pesanan</h3>
          </div>
          
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.product.id} className="flex gap-3">
                <img 
                  src={item.product.image} 
                  alt={item.product.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity}x {formatPrice(item.product.price)}</p>
                </div>
                <p className="text-sm font-bold">{formatPrice(item.product.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm"
        >
          <Label htmlFor="notes">Catatan (opsional)</Label>
          <Textarea
            id="notes"
            placeholder="Catatan untuk penjual..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-2"
          />
        </motion.div>
      </form>

      {/* Checkout Summary */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-card border-t border-border p-5 shadow-lg">
        <div className="flex justify-between items-center mb-1 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-bold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center mb-1 text-sm">
          <span className="text-muted-foreground">Ongkir</span>
          <span className="font-bold">{formatPrice(shippingCost)}</span>
        </div>
        {codServiceFee > 0 && (
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="text-muted-foreground">Biaya Layanan COD</span>
            <span className="font-bold">{formatPrice(codServiceFee)}</span>
          </div>
        )}
        <div className="flex justify-between items-center mb-4 pt-4 border-t border-border">
          <span className="text-lg font-bold">Total</span>
          <span className="text-xl font-bold text-primary">{formatPrice(total)}</span>
        </div>
        <Button
          type="submit"
          onClick={handleSubmit}
          className="w-full shadow-brand font-bold"
          size="lg"
          disabled={loading || items.length === 0 || !canProceedCheckout || quotaLoading || operatingHoursLoading || !allMerchantsOpen}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Memproses...
            </>
          ) : quotaLoading || operatingHoursLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Memeriksa Toko...
            </>
          ) : !allMerchantsOpen ? (
            <>
              <Clock className="h-4 w-4 mr-2" />
              Ada Toko Tutup
            </>
          ) : !canProceedCheckout ? (
            'Tidak Dapat Melanjutkan'
          ) : paymentMethod === 'COD' ? (
            'Pesan & Konfirmasi WA'
          ) : (
            'Bayar Sekarang'
          )}
        </Button>
      </div>
    </div>
  );
}
