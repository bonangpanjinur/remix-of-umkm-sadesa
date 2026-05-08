import { useNavigate } from 'react-router-dom';
import { Mountain, Store, Eye, AlertCircle, ExternalLink, Download } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface VillageData {
  id: string;
  name: string;
  district: string;
  regency: string;
  registration_status: string;
}

interface TourismItem {
  id: string;
  name: string;
  is_active: boolean;
  view_count: number;
  facilities: string[] | null;
}

interface MerchantItem {
  id: string;
  name: string;
  status: string;
  registration_status: string;
  business_category: string | null;
  phone: string | null;
}

interface DashboardData {
  village: VillageData | null;
  tourism: TourismItem[];
  merchants: MerchantItem[];
}

export default function DesaDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery<DashboardData>({
    queryKey: ['desa-dashboard', user?.id],
    queryFn: async () => {
      const { data: userVillage } = await supabase
        .from('user_villages')
        .select('village_id, villages(id, name, district, regency, registration_status)')
        .eq('user_id', user!.id)
        .maybeSingle();

      const village = userVillage?.villages as unknown as VillageData | null;
      if (!village) return { village: null, tourism: [], merchants: [] };

      const [tourismRes, merchantsRes] = await Promise.all([
        supabase.from('tourism').select('id, name, is_active, view_count, facilities').eq('village_id', village.id),
        supabase.from('merchants').select('id, name, status, registration_status, business_category, phone').eq('village_id', village.id),
      ]);

      return {
        village,
        tourism: tourismRes.data || [],
        merchants: merchantsRes.data || [],
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const village = data?.village ?? null;
  const tourism = data?.tourism ?? [];
  const merchants = data?.merchants ?? [];

  const stats = {
    totalTourism: tourism.length,
    activeTourism: tourism.filter(t => t.is_active).length,
    totalMerchants: merchants.filter(m => m.status === 'ACTIVE').length,
    totalViews: tourism.reduce((sum, t) => sum + (t.view_count || 0), 0),
  };

  const exportTourismCSV = () => {
    if (tourism.length === 0) { toast.error('Tidak ada data wisata'); return; }
    const headers = ['Nama', 'Status', 'Views', 'Fasilitas'];
    const rows = tourism.map(t => [
      t.name,
      t.is_active ? 'Aktif' : 'Nonaktif',
      String(t.view_count || 0),
      (t.facilities || []).join('; '),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wisata-${village?.name || 'desa'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data wisata berhasil diekspor');
  };

  if (loading) {
    return (
      <DesaLayout title="Dashboard" subtitle="Ringkasan desa wisata">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </DesaLayout>
    );
  }

  if (!village) {
    return (
      <DesaLayout title="Dashboard" subtitle="Ringkasan desa wisata">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="font-bold text-lg mb-2">Desa Belum Terdaftar</h2>
          <p className="text-muted-foreground mb-4">Anda belum terhubung ke desa wisata manapun.</p>
          <Button onClick={() => navigate('/register/village')}>Daftarkan Desa</Button>
        </div>
      </DesaLayout>
    );
  }

  return (
    <DesaLayout title="Dashboard" subtitle="Ringkasan desa wisata">
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-lg">{village.name}</h3>
        <p className="text-sm text-muted-foreground">{village.district}, {village.regency}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Wisata" value={stats.totalTourism} icon={<Mountain className="h-5 w-5" />} description={`${stats.activeTourism} aktif`} />
        <StatsCard title="Total Merchant" value={stats.totalMerchants} icon={<Store className="h-5 w-5" />} />
        <StatsCard title="Total Views" value={stats.totalViews} icon={<Eye className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => navigate('/desa/tourism')}>
          <Mountain className="h-6 w-6" />
          <span>Kelola Wisata</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={exportTourismCSV}>
          <Download className="h-6 w-6" />
          <span>Ekspor Data Wisata</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Merchant di Desa ({merchants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {merchants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada merchant terdaftar di desa ini</p>
          ) : (
            <div className="space-y-3">
              {merchants.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition">
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{m.business_category || 'Umum'}</span>
                      <Badge variant={m.registration_status === 'APPROVED' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {m.registration_status === 'APPROVED' ? 'Aktif' : m.registration_status}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/merchants/${m.id}`)} title="Lihat Detail">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DesaLayout>
  );
}
