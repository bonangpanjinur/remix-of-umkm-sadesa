import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Store, MapPin, Phone, Clock, Star, Package, 
  ShoppingCart, Check, X, Edit, MoreHorizontal, Tag, Users,
  Calendar, CreditCard, TrendingUp
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { approveMerchant, rejectMerchant } from '@/lib/adminApi';

interface MerchantDetail {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  subdistrict: string | null;
  business_category: string | null;
  business_description: string | null;
  classification_price: string | null;
  open_time: string | null;
  close_time: string | null;
  image_url: string | null;
  is_open: boolean;
  status: string;
  registration_status: string;
  registered_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  available_balance: number | null;
  pending_balance: number | null;
  total_withdrawn: number | null;
  trade_group: string | null;
  verifikator_code: string | null;
  villages: { name: string } | null;
}

interface ProductSummary {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  image_url: string | null;
}

interface OrderSummary {
  id: string;
  status: string;
  total: number;
  created_at: string;
}

export default function AdminMerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<MerchantDetail | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    if (id) {
      fetchMerchantData();
    }
  }, [id]);

  const fetchMerchantData = async () => {
    try {
      // Fetch merchant details
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('*, villages(name)')
        .eq('id', id)
        .single();

      if (merchantError) throw merchantError;
      setMerchant(merchantData);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, stock, is_active, image_url')
        .eq('merchant_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!productsError && productsData) {
        setProducts(productsData);
      }

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, total, created_at')
        .eq('merchant_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!ordersError && ordersData) {
        setOrders(ordersData);
      }

      // Fetch stats
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', id);

      const { count: activeProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', id)
        .eq('is_active', true);

      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', id);

      const { count: completedOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', id)
        .eq('status', 'DONE');

      const { data: revenueData } = await supabase
        .from('orders')
        .select('total')
        .eq('merchant_id', id)
        .eq('status', 'DONE');

      const totalRevenue = revenueData?.reduce((sum, o) => sum + o.total, 0) || 0;

      setStats({
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        totalOrders: totalOrders || 0,
        completedOrders: completedOrders || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching merchant:', error);
      toast.error('Gagal memuat data merchant');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    const success = await approveMerchant(id);
    if (success) {
      toast.success('Merchant berhasil disetujui');
      fetchMerchantData();
    } else {
      toast.error('Gagal menyetujui merchant');
    }
  };

  const handleReject = async () => {
    if (!id) return;
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;
    
    const success = await rejectMerchant(id, reason);
    if (success) {
      toast.success('Merchant ditolak');
      fetchMerchantData();
    } else {
      toast.error('Gagal menolak merchant');
    }
  };

  const getStatusBadge = (status: string, regStatus: string) => {
    if (regStatus === 'PENDING') {
      return <Badge variant="warning">Menunggu Verifikasi</Badge>;
    }
    if (regStatus === 'REJECTED') {
      return <Badge variant="destructive">Ditolak</Badge>;
    }
    if (status === 'ACTIVE') {
      return <Badge variant="success">Aktif</Badge>;
    }
    return <Badge variant="outline">Nonaktif</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <AdminLayout title="Detail Merchant" subtitle="Memuat data...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!merchant) {
    return (
      <AdminLayout title="Merchant Tidak Ditemukan" subtitle="">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Merchant tidak ditemukan atau sudah dihapus.</p>
          <Button onClick={() => navigate('/admin/merchants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title={merchant.name} 
      subtitle={merchant.business_category || 'Merchant'}
    >
      {/* Back button & actions */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/merchants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        <div className="flex gap-2">
          {merchant.registration_status === 'PENDING' && (
            <>
              <Button size="sm" onClick={handleApprove}>
                <Check className="h-4 w-4 mr-1" />
                Setujui
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReject}>
                <X className="h-4 w-4 mr-1" />
                Tolak
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                Edit Merchant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Merchant Header Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Avatar className="h-20 w-20 rounded-xl">
              <AvatarImage src={merchant.image_url || ''} alt={merchant.name} />
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xl">
                <Store className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{merchant.name}</h2>
                  <p className="text-sm text-muted-foreground">{merchant.business_category || '-'}</p>
                </div>
                {getStatusBadge(merchant.status, merchant.registration_status)}
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {merchant.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {merchant.phone}
                  </div>
                )}
                {merchant.open_time && merchant.close_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {merchant.open_time} - {merchant.close_time}
                  </div>
                )}
                {merchant.rating_avg && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    {merchant.rating_avg.toFixed(1)} ({merchant.rating_count} ulasan)
                  </div>
                )}
              </div>

              {merchant.address && (
                <div className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {merchant.address}, {merchant.subdistrict}, {merchant.district}, {merchant.city}, {merchant.province}
                  </span>
                </div>
              )}
            </div>
          </div>

          {merchant.rejection_reason && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                <strong>Alasan Penolakan:</strong> {merchant.rejection_reason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Package className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeProducts}</p>
                <p className="text-xs text-muted-foreground">Produk Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <ShoppingCart className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedOrders}</p>
                <p className="text-xs text-muted-foreground">Pesanan Selesai</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Penjualan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CreditCard className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(merchant.available_balance || 0)}</p>
                <p className="text-xs text-muted-foreground">Saldo Tersedia</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="products">Produk ({stats.totalProducts})</TabsTrigger>
          <TabsTrigger value="orders">Pesanan ({stats.totalOrders})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detail Bisnis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kategori</span>
                  <span>{merchant.business_category || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Klasifikasi Harga</span>
                  <span>{merchant.classification_price || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status Toko</span>
                  <Badge variant={merchant.is_open ? 'default' : 'secondary'}>
                    {merchant.is_open ? 'Buka' : 'Tutup'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desa Wisata</span>
                  <span>{merchant.villages?.name || '-'}</span>
                </div>
                {merchant.business_description && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">Deskripsi:</p>
                    <p>{merchant.business_description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Info Pendaftaran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal Daftar</span>
                  <span>
                    {merchant.registered_at 
                      ? new Date(merchant.registered_at).toLocaleDateString('id-ID')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal Disetujui</span>
                  <span>
                    {merchant.approved_at 
                      ? new Date(merchant.approved_at).toLocaleDateString('id-ID')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kode Referral</span>
                  <span>{merchant.verifikator_code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kelompok Dagang</span>
                  <span>{merchant.trade_group || '-'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Keuangan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo Tersedia</span>
                  <span className="font-medium">{formatCurrency(merchant.available_balance || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo Pending</span>
                  <span>{formatCurrency(merchant.pending_balance || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Ditarik</span>
                  <span>{formatCurrency(merchant.total_withdrawn || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardContent className="p-4">
              {products.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Belum ada produk</p>
              ) : (
                <div className="space-y-3">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage src={product.image_url || ''} alt={product.name} />
                        <AvatarFallback className="rounded-lg">
                          <Package className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(product.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Stok: {product.stock}</p>
                        <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-xs">
                          {product.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-4">
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Belum ada pesanan</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(order.total)}</p>
                        <Badge variant="outline" className="text-xs">{order.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
