import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Phone, Mail, User, Check, X, Edit, 
  MoreHorizontal, Store, Camera, Users, Calendar, Globe
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
import { approveVillage, rejectVillage } from '@/lib/adminApi';
import { VillageEditDialog } from '@/components/admin/VillageEditDialog';

interface VillageDetail {
  id: string;
  name: string;
  district: string;
  regency: string;
  subdistrict: string | null;
  description: string | null;
  image_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_active: boolean;
  registration_status: string;
  registered_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

interface MerchantSummary {
  id: string;
  name: string;
  business_category: string | null;
  status: string;
  image_url: string | null;
}

interface TourismSummary {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
}

export default function AdminVillageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [village, setVillage] = useState<VillageDetail | null>(null);
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [tourismSpots, setTourismSpots] = useState<TourismSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    totalMerchants: 0,
    activeMerchants: 0,
    totalTourism: 0,
  });

  useEffect(() => {
    if (id) {
      fetchVillageData();
    }
  }, [id]);

  const fetchVillageData = async () => {
    try {
      // Fetch village details
      const { data: villageData, error: villageError } = await supabase
        .from('villages')
        .select('*')
        .eq('id', id)
        .single();

      if (villageError) throw villageError;
      setVillage(villageData);

      // Fetch merchants in this village
      const { data: merchantsData, error: merchantsError } = await supabase
        .from('merchants')
        .select('id, name, business_category, status, image_url')
        .eq('village_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!merchantsError && merchantsData) {
        setMerchants(merchantsData);
      }

      // Fetch tourism spots
      const { data: tourismData, error: tourismError } = await supabase
        .from('tourism')
        .select('id, name, description, image_url')
        .eq('village_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!tourismError && tourismData) {
        setTourismSpots(tourismData);
      }

      // Fetch stats
      const { count: totalMerchants } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true })
        .eq('village_id', id);

      const { count: activeMerchants } = await supabase
        .from('merchants')
        .select('*', { count: 'exact', head: true })
        .eq('village_id', id)
        .eq('status', 'ACTIVE');

      const { count: totalTourism } = await supabase
        .from('tourism')
        .select('*', { count: 'exact', head: true })
        .eq('village_id', id);

      setStats({
        totalMerchants: totalMerchants || 0,
        activeMerchants: activeMerchants || 0,
        totalTourism: totalTourism || 0,
      });
    } catch (error) {
      console.error('Error fetching village:', error);
      toast.error('Gagal memuat data desa');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    const success = await approveVillage(id);
    if (success) {
      toast.success('Desa wisata berhasil disetujui');
      fetchVillageData();
    } else {
      toast.error('Gagal menyetujui desa wisata');
    }
  };

  const handleReject = async () => {
    if (!id) return;
    const reason = prompt('Alasan penolakan:');
    if (!reason) return;
    
    const success = await rejectVillage(id, reason);
    if (success) {
      toast.success('Desa wisata ditolak');
      fetchVillageData();
    } else {
      toast.error('Gagal menolak desa wisata');
    }
  };

  const getStatusBadge = (regStatus: string, isActive: boolean) => {
    if (regStatus === 'PENDING') {
      return <Badge variant="warning">Menunggu Verifikasi</Badge>;
    }
    if (regStatus === 'REJECTED') {
      return <Badge variant="destructive">Ditolak</Badge>;
    }
    if (isActive) {
      return <Badge variant="success">Aktif</Badge>;
    }
    return <Badge variant="outline">Nonaktif</Badge>;
  };

  if (loading) {
    return (
      <AdminLayout title="Detail Desa" subtitle="Memuat data...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!village) {
    return (
      <AdminLayout title="Desa Tidak Ditemukan" subtitle="">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Desa wisata tidak ditemukan atau sudah dihapus.</p>
          <Button onClick={() => navigate('/admin/villages')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title={village.name} 
      subtitle="Desa Wisata"
    >
      {/* Back button & actions */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/villages')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>

        <div className="flex gap-2">
          {village.registration_status === 'PENDING' && (
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
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Data Desa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Village Header Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <Avatar className="h-20 w-20 rounded-xl">
              <AvatarImage src={village.image_url || ''} alt={village.name} />
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xl">
                <MapPin className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{village.name}</h2>
                  <p className="text-sm text-muted-foreground">{village.subdistrict || village.district}</p>
                </div>
                {getStatusBadge(village.registration_status, village.is_active)}
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {village.district}, {village.regency}
                </div>
                {village.contact_phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {village.contact_phone}
                  </div>
                )}
                {village.contact_email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {village.contact_email}
                  </div>
                )}
              </div>
            </div>
          </div>

          {village.rejection_reason && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">
                <strong>Alasan Penolakan:</strong> {village.rejection_reason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Store className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeMerchants}</p>
                <p className="text-xs text-muted-foreground">Merchant Aktif</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Camera className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTourism}</p>
                <p className="text-xs text-muted-foreground">Spot Wisata</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalMerchants}</p>
                <p className="text-xs text-muted-foreground">Total Merchant</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="merchants">Merchant ({stats.totalMerchants})</TabsTrigger>
          <TabsTrigger value="tourism">Wisata ({stats.totalTourism})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detail Lokasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama Desa</span>
                  <span>{village.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kelurahan</span>
                  <span>{village.subdistrict || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kecamatan</span>
                  <span>{village.district}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kabupaten/Kota</span>
                  <span>{village.regency}</span>
                </div>
                {village.description && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground mb-1">Deskripsi:</p>
                    <p>{village.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informasi Kontak</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama Kontak</span>
                  <span>{village.contact_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telepon</span>
                  <span>{village.contact_phone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{village.contact_email || '-'}</span>
                </div>
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
                    {village.registered_at 
                      ? new Date(village.registered_at).toLocaleDateString('id-ID')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal Disetujui</span>
                  <span>
                    {village.approved_at 
                      ? new Date(village.approved_at).toLocaleDateString('id-ID')
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status Registrasi</span>
                  <span>{village.registration_status}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="merchants">
          <Card>
            <CardContent className="p-4">
              {merchants.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Belum ada merchant di desa ini</p>
              ) : (
                <div className="space-y-3">
                  {merchants.map((merchant) => (
                    <div 
                      key={merchant.id} 
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/admin/merchants/${merchant.id}`)}
                    >
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage src={merchant.image_url || ''} alt={merchant.name} />
                        <AvatarFallback className="rounded-lg">
                          <Store className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{merchant.name}</p>
                        <p className="text-sm text-muted-foreground">{merchant.business_category || '-'}</p>
                      </div>
                      <Badge variant={merchant.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {merchant.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tourism">
          <Card>
            <CardContent className="p-4">
              {tourismSpots.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Belum ada spot wisata</p>
              ) : (
                <div className="space-y-3">
                  {tourismSpots.map((spot) => (
                    <div key={spot.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage src={spot.image_url || ''} alt={spot.name} />
                        <AvatarFallback className="rounded-lg">
                          <Camera className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{spot.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{spot.description || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Village Dialog */}
      {village && (
        <VillageEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          villageId={village.id}
          initialData={{
            name: village.name,
            district: village.district,
            regency: village.regency,
            subdistrict: village.subdistrict,
            description: village.description,
            contact_name: village.contact_name,
            contact_phone: village.contact_phone,
            contact_email: village.contact_email,
            is_active: village.is_active,
          }}
          onSuccess={fetchVillageData}
        />
      )}
    </AdminLayout>
  );
}
