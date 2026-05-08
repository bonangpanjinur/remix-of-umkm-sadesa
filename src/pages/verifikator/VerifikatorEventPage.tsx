import { useState, useEffect } from 'react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, RefreshCw } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface VillageEvent {
  id: string;
  name: string;
  event_type: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  organizer: string | null;
  village_name: string;
}

const EVENT_TYPES: Record<string, string> = {
  pasar_malam: 'Pasar Malam', festival: 'Festival', pameran: 'Pameran',
  lomba: 'Lomba', bazaar: 'Bazaar', lainnya: 'Lainnya',
};

export default function VerifikatorEventPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<VillageEvent[]>([]);
  const [villages, setVillages] = useState<{ id: string; name: string }[]>([]);
  const [selectedVillage, setSelectedVillage] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchVillages(); }, [user]);
  useEffect(() => { fetchEvents(); }, [selectedVillage]);

  const fetchVillages = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('verifikator_assignments')
      .select('villages(id, name)')
      .eq('verifikator_id', user.id);
    setVillages(((data || []) as any[]).map((a: any) => a.villages).filter(Boolean) as { id: string; name: string }[]);
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('village_events' as any)
        .select('*, villages(name)')
        .order('start_date', { ascending: false });
      if (selectedVillage !== 'all') q = q.eq('village_id', selectedVillage);

      const { data } = await q;
      setEvents(((data || []) as any[]).map(e => ({
        ...e,
        village_name: e.villages?.name || '',
      })));
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (ev: VillageEvent) => {
    const now = new Date();
    const start = new Date(ev.start_date);
    const end = ev.end_date ? new Date(ev.end_date) : null;
    if (isAfter(start, now)) return { label: 'Akan Datang', color: 'bg-blue-100 text-blue-800' };
    if (!end || isAfter(end, now)) return { label: 'Berlangsung', color: 'bg-emerald-100 text-emerald-800' };
    return { label: 'Selesai', color: 'bg-gray-100 text-gray-600' };
  };

  return (
    <VerifikatorLayout title="Event Desa" subtitle="Pantau kegiatan dan event di desa binaan">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedVillage} onValueChange={setSelectedVillage}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Desa</SelectItem>
              {villages.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Belum ada event terdaftar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map(ev => {
              const status = getStatus(ev);
              return (
                <Card key={ev.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex flex-col items-center justify-center shrink-0 text-center">
                      <p className="text-lg font-bold text-blue-700 leading-none">
                        {format(new Date(ev.start_date), 'dd')}
                      </p>
                      <p className="text-xs text-blue-600">{format(new Date(ev.start_date), 'MMM', { locale: idLocale })}</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{ev.name}</h3>
                        <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
                        <Badge variant="outline" className="text-xs">{EVENT_TYPES[ev.event_type] || ev.event_type}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{ev.village_name}</span>
                        {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </VerifikatorLayout>
  );
}
