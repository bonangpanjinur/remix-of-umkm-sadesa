import { useState, useEffect } from 'react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Mountain, Eye, Star, TrendingUp, RefreshCw } from 'lucide-react';
import { subMonths, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface TourismStat {
  id: string;
  name: string;
  is_active: boolean;
  view_count: number;
  facilities: string[] | null;
  rating_avg: number | null;
  rating_count: number | null;
  location_lat: number | null;
  location_lng: number | null;
}

export default function DesaLaporanWisataPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [tourism, setTourism] = useState<TourismStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    const fetchVillage = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_villages').select('village_id').eq('user_id', user.id).maybeSingle();
      if (data?.village_id) setVillageId(data.village_id);
    };
    fetchVillage();
  }, [user]);

  useEffect(() => { if (villageId) fetchData(); }, [villageId]);

  const fetchData = async () => {
    if (!villageId) return;
    setLoading(true);
    const { data } = await supabase
      .from('tourism')
      .select('id, name, is_active, view_count, facilities, location_lat, location_lng')
      .eq('village_id', villageId)
      .order('view_count', { ascending: false });

    setTourism(((data || []) as any[]).map(t => ({
      ...t,
      rating_avg: null,
      rating_count: null,
    })));
    setLoading(false);
  };

  const totalViews = tourism.reduce((s, t) => s + t.view_count, 0);
  const activeTourism = tourism.filter(t => t.is_active).length;
  const maxViews = Math.max(...tourism.map(t => t.view_count), 1);

  const chartData = tourism.slice(0, 8).map(t => ({
    name: t.name.length > 14 ? t.name.substring(0, 14) + '…' : t.name,
    kunjungan: t.view_count,
  }));

  return (
    <DesaLayout title="Laporan Wisata" subtitle="Statistik kunjungan dan performa destinasi wisata">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Destinasi', value: tourism.length, icon: Mountain, color: 'text-blue-600' },
            { label: 'Aktif', value: activeTourism, icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Total Tayangan', value: totalViews.toLocaleString('id-ID'), icon: Eye, color: 'text-purple-600' },
            { label: 'Rata-rata Tayangan', value: tourism.length > 0 ? Math.round(totalViews / tourism.length).toLocaleString('id-ID') : 0, icon: Star, color: 'text-orange-600' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tayangan per Destinasi (Top 8)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [v.toLocaleString('id-ID'), 'Tayangan']} />
                  <Bar dataKey="kunjungan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mountain className="h-4 w-4" />Ranking Destinasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : tourism.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada destinasi wisata terdaftar</p>
            ) : (
              <div className="space-y-4">
                {tourism.map((t, i) => (
                  <div key={t.id} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-xs ${t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {t.is_active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                            <span className="text-sm font-semibold text-blue-600">
                              <Eye className="h-3 w-3 inline mr-0.5" />
                              {t.view_count.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                        <Progress value={(t.view_count / maxViews) * 100} className="h-1.5 mt-1" />
                      </div>
                    </div>
                    {t.facilities && t.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-9">
                        {t.facilities.slice(0, 4).map((f, fi) => (
                          <Badge key={fi} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                        {t.facilities.length > 4 && (
                          <Badge variant="outline" className="text-xs">+{t.facilities.length - 4}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DesaLayout>
  );
}
