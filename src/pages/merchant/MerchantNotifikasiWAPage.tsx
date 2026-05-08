import { useState, useEffect } from 'react';
import {
  MessageCircle, Phone, Bell, BellOff, Package, Send, Clock, RefreshCw,
  AlertTriangle, CheckCircle2, Users, Zap, ChevronRight, Copy, Info
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Order {
  id: string;
  delivery_name: string | null;
  delivery_phone: string | null;
  total: number;
  status: string;
  created_at: string;
  items_summary?: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  min_stock_alert: number;
}

interface BuyerContact {
  phone: string;
  name: string;
  order_count: number;
  last_order: string;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  NEW: 'Baru',
  PENDING_CONFIRMATION: 'Menunggu Konfirmasi',
  PROCESSING: 'Diproses',
  READY: 'Siap Kirim',
  DELIVERED: 'Dikirim',
  DONE: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

function encodeWA(text: string) {
  return encodeURIComponent(text);
}

export default function MerchantNotifikasiWAPage() {
  const { user } = useAuth();
  const { merchantId, merchantName, loading: guardLoading } = useMerchantGuard();

  const [waNumber, setWaNumber] = useState('');
  const [savedWaNumber, setSavedWaNumber] = useState('');
  const [savingWa, setSavingWa] = useState(false);

  const [notifOrderMasuk, setNotifOrderMasuk] = useState(true);
  const [notifStokMenipis, setNotifStokMenipis] = useState(true);

  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [todaySummary, setTodaySummary] = useState({ total: 0, orders: 0, avgOrder: 0 });
  const [buyers, setBuyers] = useState<BuyerContact[]>([]);

  const [broadcastMsg, setBroadcastMsg] = useState(
    `Halo {nama_pembeli}! 👋\n\nAda promo spesial dari ${merchantName || 'toko kami'} hari ini!\n\n✨ [isi promo Anda di sini]\n\nKunjungi toko kami sekarang!`
  );
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!merchantId) return;
    fetchAll();
    loadWaNumber();
  }, [merchantId]);

  const loadWaNumber = () => {
    const saved = localStorage.getItem(`merchant_wa_${merchantId}`);
    if (saved) {
      setWaNumber(saved);
      setSavedWaNumber(saved);
    }
  };

  const saveWaNumber = async () => {
    if (!waNumber.trim()) {
      toast.error('Nomor WA tidak boleh kosong');
      return;
    }
    const cleaned = waNumber.replace(/\D/g, '');
    if (cleaned.length < 9) {
      toast.error('Nomor WA tidak valid');
      return;
    }
    setSavingWa(true);
    try {
      const normalised = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
      localStorage.setItem(`merchant_wa_${merchantId}`, normalised);
      setSavedWaNumber(normalised);
      setWaNumber(normalised);

      await supabase.from('merchants').update({ phone: normalised } as any).eq('id', merchantId!);
      toast.success('Nomor WA berhasil disimpan');
    } catch {
      toast.error('Gagal menyimpan nomor WA');
    } finally {
      setSavingWa(false);
    }
  };

  const fetchAll = async () => {
    if (!merchantId) return;
    setLoadingData(true);
    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [pendingRes, lowStockRes, todayOrdersRes, allBuyersRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, delivery_name, delivery_phone, total, status, created_at')
          .eq('merchant_id', merchantId!)
          .in('status', ['NEW', 'PENDING_CONFIRMATION'])
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('products')
          .select('id, name, stock, min_stock_alert')
          .eq('merchant_id', merchantId!)
          .eq('is_active', true)
          .lte('stock', 10),
        supabase
          .from('orders')
          .select('id, total, status')
          .eq('merchant_id', merchantId!)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .in('status', ['DONE', 'DELIVERED', 'PROCESSING', 'READY']),
        supabase
          .from('orders')
          .select('delivery_name, delivery_phone, created_at')
          .eq('merchant_id', merchantId!)
          .not('delivery_phone', 'is', null)
          .gte('created_at', subDays(new Date(), 90).toISOString())
          .order('created_at', { ascending: false }),
      ]);

      setPendingOrders((pendingRes.data || []) as Order[]);

      const low = (lowStockRes.data || []).filter(
        (p: any) => p.stock <= (p.min_stock_alert || 5)
      ) as LowStockProduct[];
      setLowStockProducts(low);

      const todayOrders = todayOrdersRes.data || [];
      const totalRev = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
      setTodaySummary({
        total: totalRev,
        orders: todayOrders.length,
        avgOrder: todayOrders.length > 0 ? totalRev / todayOrders.length : 0,
      });

      const buyerMap = new Map<string, BuyerContact>();
      for (const o of (allBuyersRes.data || []) as any[]) {
        if (!o.delivery_phone) continue;
        const phone = o.delivery_phone.replace(/\D/g, '');
        if (buyerMap.has(phone)) {
          buyerMap.get(phone)!.order_count++;
        } else {
          buyerMap.set(phone, {
            phone,
            name: o.delivery_name || 'Pelanggan',
            order_count: 1,
            last_order: o.created_at,
          });
        }
      }
      setBuyers(Array.from(buyerMap.values()).sort((a, b) => b.order_count - a.order_count));
    } finally {
      setLoadingData(false);
    }
  };

  const openWA = (phone: string, msg: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const normalised = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    window.open(`https://wa.me/${normalised}?text=${encodeWA(msg)}`, '_blank');
  };

  const openWAToSelf = (msg: string) => {
    if (!savedWaNumber) {
      toast.error('Atur nomor WA Anda dahulu di tab Pengaturan');
      return;
    }
    window.open(`https://wa.me/${savedWaNumber}?text=${encodeWA(msg)}`, '_blank');
  };

  const sendOrderAlert = (order: Order) => {
    const waktu = format(new Date(order.created_at), 'HH:mm, dd MMM', { locale: idLocale });
    const msg = `🔔 *PESANAN BARU MASUK!*\n\n📋 ID: ${order.id.slice(-8).toUpperCase()}\n👤 Pembeli: ${order.delivery_name || '-'}\n📞 HP: ${order.delivery_phone || '-'}\n💰 Total: ${formatPrice(order.total)}\n⏰ Waktu: ${waktu}\n\n⚡ Segera konfirmasi pesanan ini!`;
    openWAToSelf(msg);
  };

  const sendLaporanHarian = () => {
    const tgl = format(new Date(), 'dd MMMM yyyy', { locale: idLocale });
    const msg = `📊 *LAPORAN HARI INI — ${merchantName?.toUpperCase() || 'TOKO'}*\n📅 ${tgl}\n\n💰 Total Omzet: ${formatPrice(todaySummary.total)}\n🛒 Total Order: ${todaySummary.orders} pesanan\n📈 Rata-rata/Order: ${formatPrice(todaySummary.avgOrder)}\n\n${pendingOrders.length > 0 ? `⚠️ Pesanan menunggu konfirmasi: ${pendingOrders.length}\n` : '✅ Semua pesanan sudah dikonfirmasi\n'}\n${lowStockProducts.length > 0 ? `🔴 Stok menipis: ${lowStockProducts.length} produk` : '✅ Stok aman'}`;
    openWAToSelf(msg);
  };

  const sendStokAlert = () => {
    if (lowStockProducts.length === 0) {
      toast.info('Semua stok aman, tidak ada yang perlu dinotifikasi');
      return;
    }
    const list = lowStockProducts.map(p => `• ${p.name}: sisa ${p.stock} unit`).join('\n');
    const msg = `🔴 *ALERT STOK MENIPIS — ${merchantName?.toUpperCase() || 'TOKO'}*\n\n${list}\n\n⚡ Segera tambah stok!`;
    openWAToSelf(msg);
  };

  const sendBroadcast = (buyer: BuyerContact) => {
    const personalised = broadcastMsg
      .replace('{nama_pembeli}', buyer.name)
      .replace('{nama_toko}', merchantName || 'toko kami');
    openWA(buyer.phone, personalised);
  };

  const sendBroadcastAll = () => {
    if (buyers.length === 0) {
      toast.error('Belum ada pelanggan dengan nomor HP');
      return;
    }
    let i = 0;
    const open = () => {
      if (i >= buyers.length) return;
      const b = buyers[i++];
      const personalised = broadcastMsg
        .replace('{nama_pembeli}', b.name)
        .replace('{nama_toko}', merchantName || 'toko kami');
      window.open(`https://wa.me/${b.phone}?text=${encodeWA(personalised)}`, '_blank');
      if (i < buyers.length) setTimeout(open, 1500);
    };
    open();
    toast.success(`Membuka WA untuk ${buyers.length} pelanggan...`);
  };

  const copyNumber = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success('Nomor disalin');
  };

  if (guardLoading) {
    return (
      <MerchantLayout title="Notifikasi WhatsApp" subtitle="Kelola notifikasi via WA">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Notifikasi WhatsApp" subtitle="Notif order, stok, laporan & broadcast ke pelanggan">
      <div className="space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className={pendingOrders.length > 0 ? 'border-orange-400' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Pesanan Pending</span>
              </div>
              <p className="text-2xl font-bold">{pendingOrders.length}</p>
              {pendingOrders.length > 0 && <Badge variant="destructive" className="text-xs mt-1">Perlu tindakan</Badge>}
            </CardContent>
          </Card>
          <Card className={lowStockProducts.length > 0 ? 'border-red-400' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Stok Menipis</span>
              </div>
              <p className="text-2xl font-bold">{lowStockProducts.length}</p>
              {lowStockProducts.length > 0 && <Badge variant="destructive" className="text-xs mt-1">Segera restock</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Omzet Hari Ini</span>
              </div>
              <p className="text-lg font-bold">{formatPrice(todaySummary.total)}</p>
              <p className="text-xs text-muted-foreground">{todaySummary.orders} order</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Pelanggan</span>
              </div>
              <p className="text-2xl font-bold">{buyers.length}</p>
              <p className="text-xs text-muted-foreground">punya nomor WA</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="notifikasi">
          <TabsList className="w-full">
            <TabsTrigger value="notifikasi" className="flex-1">
              <Bell className="h-4 w-4 mr-1.5" />Notifikasi
            </TabsTrigger>
            <TabsTrigger value="laporan" className="flex-1">
              <Send className="h-4 w-4 mr-1.5" />Laporan
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="flex-1">
              <Users className="h-4 w-4 mr-1.5" />Broadcast
            </TabsTrigger>
            <TabsTrigger value="pengaturan" className="flex-1">
              <Phone className="h-4 w-4 mr-1.5" />Pengaturan
            </TabsTrigger>
          </TabsList>

          {/* TAB: NOTIFIKASI */}
          <TabsContent value="notifikasi" className="space-y-4 mt-4">
            {!savedWaNumber && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Atur nomor WA Anda di tab <strong>Pengaturan</strong> agar bisa menerima notifikasi.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={sendLaporanHarian}
                variant="outline"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                Kirim Laporan Hari Ini ke WA Saya
              </Button>
              <Button
                onClick={sendStokAlert}
                variant="outline"
                className="flex items-center gap-2"
                disabled={lowStockProducts.length === 0}
              >
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Alert Stok Menipis ke WA Saya
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchAll} disabled={loadingData}>
                <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Pending Orders */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-500" />
                  Pesanan Menunggu Konfirmasi
                  {pendingOrders.length > 0 && <Badge variant="destructive">{pendingOrders.length}</Badge>}
                </CardTitle>
                <CardDescription>Klik "Kirim WA" untuk menerima detail pesanan di HP Anda</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    Tidak ada pesanan pending
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingOrders.map(order => (
                      <div key={order.id} className="flex items-center justify-between gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">#{order.id.slice(-8).toUpperCase()}</span>
                            <Badge variant="outline" className="text-xs">{ORDER_STATUS_LABEL[order.status] || order.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.delivery_name || 'Pelanggan'} • {formatPrice(order.total)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'HH:mm, dd MMM', { locale: idLocale })}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {order.delivery_phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openWA(order.delivery_phone!, `Halo ${order.delivery_name || 'Kak'}, pesanan Anda di ${merchantName} sudah kami terima! Total: ${formatPrice(order.total)}. Kami segera proses ya! 😊`)}
                              className="text-xs"
                            >
                              <MessageCircle className="h-3 w-3 mr-1 text-green-600" />
                              WA Pembeli
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => sendOrderAlert(order)}
                            className="text-xs bg-green-600 hover:bg-green-700"
                          >
                            <MessageCircle className="h-3 w-3 mr-1" />
                            Notif ke Saya
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low Stock */}
            {lowStockProducts.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Produk Stok Menipis
                    <Badge variant="destructive">{lowStockProducts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lowStockProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-red-600">Sisa {p.stock} unit (min: {p.min_stock_alert || 5})</p>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {p.stock <= 0 ? 'Habis' : 'Menipis'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-3 bg-green-600 hover:bg-green-700"
                    onClick={sendStokAlert}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Kirim Alert Stok ke WA Saya
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB: LAPORAN */}
          <TabsContent value="laporan" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Laporan Hari Ini</CardTitle>
                <CardDescription>Kirim rekap penjualan hari ini langsung ke WA Anda</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Omzet</p>
                    <p className="font-bold text-sm">{formatPrice(todaySummary.total)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Order</p>
                    <p className="font-bold text-sm">{todaySummary.orders}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Avg/Order</p>
                    <p className="font-bold text-sm">{formatPrice(todaySummary.avgOrder)}</p>
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-4 text-sm font-mono whitespace-pre-line text-muted-foreground text-xs">
                  {`📊 LAPORAN HARI INI — ${merchantName?.toUpperCase() || 'TOKO'}
📅 ${format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}

💰 Total Omzet: ${formatPrice(todaySummary.total)}
🛒 Total Order: ${todaySummary.orders} pesanan
📈 Rata-rata/Order: ${formatPrice(todaySummary.avgOrder)}

${pendingOrders.length > 0 ? `⚠️ Pending: ${pendingOrders.length} pesanan` : '✅ Semua pesanan terkonfirmasi'}
${lowStockProducts.length > 0 ? `🔴 Stok menipis: ${lowStockProducts.length} produk` : '✅ Stok aman'}`}
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={sendLaporanHarian}
                  disabled={!savedWaNumber}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Kirim Laporan ke WA Saya
                </Button>
                {!savedWaNumber && (
                  <p className="text-xs text-center text-muted-foreground">Atur nomor WA di tab Pengaturan terlebih dahulu</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Info WA Pembeli per Pesanan</CardTitle>
                <CardDescription>Kontak langsung pembeli dari pesanan terbaru</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada pesanan pending saat ini</p>
                ) : (
                  <div className="space-y-2">
                    {pendingOrders.slice(0, 10).map(order => (
                      <div key={order.id} className="flex items-center justify-between gap-2 p-2.5 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{order.delivery_name || 'Pelanggan'}</p>
                          <p className="text-xs text-muted-foreground">{order.delivery_phone || 'Tidak ada HP'} • {formatPrice(order.total)}</p>
                        </div>
                        {order.delivery_phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWA(order.delivery_phone!, `Halo ${order.delivery_name || 'Kak'}! Pesanan dari ${merchantName} sedang dalam proses. Terima kasih sudah berbelanja! 😊`)}
                          >
                            <MessageCircle className="h-3 w-3 mr-1 text-green-600" />
                            WA
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: BROADCAST */}
          <TabsContent value="broadcast" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Broadcast pesan promo ke pelanggan yang pernah order. Gunakan <code className="bg-muted px-1 rounded">{'{nama_pembeli}'}</code> untuk nama personal.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Template Pesan Broadcast</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Isi Pesan</Label>
                  <Textarea
                    value={broadcastMsg}
                    onChange={e => setBroadcastMsg(e.target.value)}
                    rows={6}
                    className="mt-1.5 font-mono text-sm"
                    placeholder="Tulis pesan broadcast..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Variabel: <code className="bg-muted px-1 rounded">{'{nama_pembeli}'}</code> akan diganti nama pelanggan otomatis
                  </p>
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={sendBroadcastAll}
                  disabled={buyers.length === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Kirim ke Semua {buyers.length} Pelanggan
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Daftar Pelanggan ({buyers.length})
                </CardTitle>
                <CardDescription>Pelanggan yang pernah order dalam 90 hari terakhir</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : buyers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Belum ada pelanggan dengan nomor HP</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {buyers.map((b, i) => (
                      <div key={b.phone} className="flex items-center justify-between gap-2 p-2.5 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{b.name}</p>
                            <p className="text-xs text-muted-foreground">{b.phone} • {b.order_count}x order</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyNumber(b.phone)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => sendBroadcast(b)}
                          >
                            <MessageCircle className="h-3 w-3 mr-1 text-green-600" />
                            WA
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: PENGATURAN */}
          <TabsContent value="pengaturan" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Nomor WhatsApp Saya
                </CardTitle>
                <CardDescription>Nomor ini digunakan untuk menerima notifikasi pesanan dan laporan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nomor HP / WA</Label>
                  <div className="flex gap-2">
                    <Input
                      value={waNumber}
                      onChange={e => setWaNumber(e.target.value)}
                      placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
                    />
                    <Button onClick={saveWaNumber} disabled={savingWa}>
                      {savingWa ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                  {savedWaNumber && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Tersimpan: {savedWaNumber}
                    </p>
                  )}
                </div>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Preferensi Notifikasi</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Notif order baru masuk</p>
                      <p className="text-xs text-muted-foreground">Tampil tombol WA di setiap pesanan baru</p>
                    </div>
                    <Switch checked={notifOrderMasuk} onCheckedChange={setNotifOrderMasuk} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Alert stok menipis</p>
                      <p className="text-xs text-muted-foreground">Tampil tombol WA di stok yang hampir habis</p>
                    </div>
                    <Switch checked={notifStokMenipis} onCheckedChange={setNotifStokMenipis} />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Test Notifikasi</h4>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openWAToSelf(`👋 Halo dari ${merchantName || 'DesaMart'}!\n\nNotifikasi WhatsApp Anda sudah aktif. ✅\n\nAnda akan menerima:\n• Alert pesanan baru\n• Alert stok menipis\n• Laporan penjualan harian`)}
                    disabled={!savedWaNumber}
                  >
                    <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                    Kirim Pesan Test ke WA Saya
                  </Button>
                  {!savedWaNumber && (
                    <p className="text-xs text-muted-foreground text-center">Simpan nomor WA terlebih dahulu</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MerchantLayout>
  );
}
