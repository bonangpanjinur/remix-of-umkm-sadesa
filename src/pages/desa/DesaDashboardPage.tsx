import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, Store, Eye, AlertCircle } from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface VillageData {
  id: string;
  name: string;
  district: string;
  regency: string;
  registration_status: string;
}

interface Stats {
  totalTourism: number;
  activeTourism: number;
  totalMerchants: number;
  totalViews: number;
}

export default function DesaDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [village, setVillage] = useState<VillageData | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalTourism: 0,
    activeTourism: 0,
    totalMerchants: 0,
    totalViews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        let villageData: VillageData | null = null;

        // Try user_villages first
        const { data: userVillage } = await supabase
          .from('user_villages')
          .select('village_id, villages(id, name, district, regency, registration_status)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userVillage?.villages) {
          villageData = userVillage.villages as unknown as VillageData;
        }

        // Fallback: check villages.user_id directly
        if (!villageData) {
          const { data: directVillage } = await supabase
            .from('villages')
            .select('id, name, district, regency, registration_status')
            .eq('user_id', user.id)
            .maybeSingle();

          if (directVillage) {
            villageData = directVillage as VillageData;
          }
        }

        if (!villageData) {
          setLoading(false);
          return;
        }

        setVillage(villageData);

        // Get stats for this village
        const [tourismRes, merchantsRes] = await Promise.all([
          supabase
            .from('tourism')
            .select('id, is_active, view_count')
            .eq('village_id', villageData.id),
          supabase
            .from('merchants')
            .select('id')
            .eq('village_id', villageData.id)
            .eq('status', 'ACTIVE'),
        ]);

        const tourism = tourismRes.data || [];
        const merchants = merchantsRes.data || [];

        setStats({
          totalTourism: tourism.length,
          activeTourism: tourism.filter(t => t.is_active).length,
          totalMerchants: merchants.length,
          totalViews: tourism.reduce((sum, t) => sum + (t.view_count || 0), 0),
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

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
          <p className="text-muted-foreground mb-4">
            Anda belum terhubung ke desa wisata manapun.
          </p>
          <Button onClick={() => navigate('/register/village')}>
            Daftarkan Desa
          </Button>
        </div>
      </DesaLayout>
    );
  }

  return (
    <DesaLayout title="Dashboard" subtitle="Ringkasan desa wisata">
      {/* Village Info Card */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h3 className="font-semibold text-lg">{village.name}</h3>
        <p className="text-sm text-muted-foreground">
          {village.district}, {village.regency}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Wisata"
          value={stats.totalTourism}
          icon={<Mountain className="h-5 w-5" />}
          description={`${stats.activeTourism} aktif`}
        />
        <StatsCard
          title="Total Merchant"
          value={stats.totalMerchants}
          icon={<Store className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Views"
          value={stats.totalViews}
          icon={<Eye className="h-5 w-5" />}
        />
      </div>

      {/* Quick Actions */}
      {/* Quick Actions - Only Tourism for Admin Desa */}
      <div className="grid grid-cols-1 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center gap-2"
          onClick={() => navigate('/desa/tourism')}
        >
          <Mountain className="h-6 w-6" />
          <span>Kelola Wisata</span>
        </Button>
      </div>
    </DesaLayout>
  );
}
