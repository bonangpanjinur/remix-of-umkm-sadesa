import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, CheckCircle, CreditCard, QrCode, Clock, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { PaymentProofUpload } from '@/components/checkout/PaymentProofUpload';
import { PaymentCountdown } from '@/components/checkout/PaymentCountdown';

interface PaymentInfo {
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  qrisImageUrl: string | null;
}

interface OrderInfo {
  id: string;
  total: number;
  payment_method: string;
  payment_status: string;
  merchant_id: string;
  created_at: string;
  merchant_name?: string;
  payment_proof_url?: string | null;
  confirmation_deadline?: string | null;
}

export default function PaymentConfirmationPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId || !user) return;
    loadOrderAndPaymentInfo();
  }, [orderId, user]);

  const loadOrderAndPaymentInfo = async () => {
    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, total, payment_method, payment_status, merchant_id, created_at, payment_proof_url, confirmation_deadline')
        .eq('id', orderId!)
        .eq('buyer_id', user!.id)
        .single();

      if (orderError || !orderData) {
        toast({ title: 'Pesanan tidak ditemukan', variant: 'destructive' });
        navigate('/orders');
        return;
      }

      // Fetch merchant name and payment info
      const { data: merchantData } = await supabase
        .from('merchants')
        .select('name, bank_name, bank_account_number, bank_account_name, qris_image_url')
        .eq('id', orderData.merchant_id)
        .single();

      setOrder({
        ...orderData,
        merchant_name: merchantData?.name || 'Merchant',
      });

      // Use merchant payment info, fallback to admin defaults
      let bankName = merchantData?.bank_name || '';
      let bankAccountNumber = merchantData?.bank_account_number || '';
      let bankAccountName = merchantData?.bank_account_name || '';
      let qrisImageUrl = merchantData?.qris_image_url || null;

      // If merchant has no bank info, get admin defaults
      if (!bankName || !bankAccountNumber) {
        const { data: adminSettings } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'admin_payment_info')
          .single();

        if (adminSettings?.value) {
          const adminPayment = adminSettings.value as Record<string, string>;
          if (!bankName) bankName = adminPayment.bank_name || '';
          if (!bankAccountNumber) bankAccountNumber = adminPayment.bank_account_number || '';
          if (!bankAccountName) bankAccountName = adminPayment.bank_account_name || '';
          if (!qrisImageUrl) qrisImageUrl = adminPayment.qris_image_url || null;
        }
      }

      setPaymentInfo({ bankName, bankAccountNumber, bankAccountName, qrisImageUrl });
    } catch (error) {
      console.error('Error loading payment info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAccount = () => {
    if (paymentInfo?.bankAccountNumber) {
      navigator.clipboard.writeText(paymentInfo.bankAccountNumber);
      setCopied(true);
      toast({ title: 'Nomor rekening disalin' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAmount = () => {
    if (order?.total) {
      navigator.clipboard.writeText(order.total.toString());
      toast({ title: 'Nominal disalin' });
    }
  };

  if (loading) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order || !paymentInfo) {
    return (
      <div className="mobile-shell bg-background flex flex-col min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button onClick={() => navigate('/orders')} className="mt-4">Ke Pesanan Saya</Button>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-secondary flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center gap-3">
        <button
          onClick={() => navigate('/orders')}
          className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold text-lg text-foreground">Pembayaran</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Order Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Pesanan untuk</p>
                  <p className="font-bold">{order.merchant_name}</p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Menunggu Pembayaran
                </Badge>
              </div>
              {order.confirmation_deadline && (
                <PaymentCountdown deadline={order.confirmation_deadline} />
              )}
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-sm font-medium">Total Pembayaran</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-primary">{formatPrice(order.total)}</span>
                  <Button variant="ghost" size="sm" onClick={handleCopyAmount} className="h-7 px-2">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bank Transfer Info */}
        {paymentInfo.bankName && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Transfer Bank</h3>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Bank</p>
                    <p className="font-bold text-lg">{paymentInfo.bankName}</p>
                  </div>

                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Nomor Rekening</p>
                    <div className="flex items-center justify-between">
                      <p className="font-mono font-bold text-lg tracking-wider">{paymentInfo.bankAccountNumber}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyAccount}
                        className="h-8"
                      >
                        {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-1 text-xs">{copied ? 'Tersalin' : 'Salin'}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Atas Nama</p>
                    <p className="font-bold">{paymentInfo.bankAccountName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* QRIS */}
        {paymentInfo.qrisImageUrl && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <QrCode className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">QRIS</h3>
                </div>

                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  <img
                    src={paymentInfo.qrisImageUrl}
                    alt="QRIS Payment"
                    className="max-w-[280px] w-full h-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Scan kode QRIS di atas menggunakan aplikasi e-wallet atau mobile banking Anda
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Upload Bukti Pembayaran */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3">Upload Bukti Pembayaran</h3>
              <PaymentProofUpload
                orderId={order.id}
                currentProofUrl={order.payment_proof_url}
                onUploaded={(url) => setOrder(prev => prev ? { ...prev, payment_proof_url: url } : prev)}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Instructions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3">Petunjuk Pembayaran</h3>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Transfer sesuai <strong className="text-foreground">nominal yang tertera</strong> (harus sama persis)</li>
                <li>Pastikan transfer ke rekening yang benar</li>
                <li><strong className="text-foreground">Upload bukti pembayaran</strong> di atas</li>
                <li>Pesanan akan diproses setelah pembayaran dikonfirmasi oleh penjual</li>
              </ol>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-border bg-card space-y-2">
        <Button onClick={() => navigate('/orders')} className="w-full" size="lg">
          <CheckCircle className="h-4 w-4 mr-2" />
          Lihat Pesanan Saya
        </Button>
        <Button onClick={() => navigate('/')} variant="outline" className="w-full">
          Lanjut Belanja
        </Button>
      </div>
    </div>
  );
}
