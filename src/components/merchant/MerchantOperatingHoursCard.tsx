/**
 * P3-04: Merchant Operating Hours Card
 * Komponen untuk mengatur jadwal buka/tutup per hari dalam seminggu.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAYS = [
  { index: 0, label: 'Minggu', short: 'Min' },
  { index: 1, label: 'Senin', short: 'Sen' },
  { index: 2, label: 'Selasa', short: 'Sel' },
  { index: 3, label: 'Rabu', short: 'Rab' },
  { index: 4, label: 'Kamis', short: 'Kam' },
  { index: 5, label: 'Jumat', short: "Jum" },
  { index: 6, label: 'Sabtu', short: 'Sab' },
];

interface DaySchedule {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map(d => ({
  day_of_week: d.index,
  open_time: '08:00',
  close_time: '21:00',
  is_closed: d.index === 0, // Minggu tutup by default
}));

interface Props {
  merchantId: string;
}

/**
 * Hitung apakah toko sedang buka berdasarkan jadwal hari ini.
 */
export function isCurrentlyOpen(schedule: DaySchedule[]): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const todaySchedule = schedule.find(s => s.day_of_week === dayOfWeek);
  if (!todaySchedule || todaySchedule.is_closed) return false;

  const [openH, openM] = todaySchedule.open_time.split(':').map(Number);
  const [closeH, closeM] = todaySchedule.close_time.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function MerchantOperatingHoursCard({ merchantId }: Props) {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);

  const { isLoading } = useQuery({
    queryKey: ['merchant-operating-hours', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_operating_hours' as any)
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('merchant_id', merchantId)
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        const merged = DEFAULT_SCHEDULE.map(def => {
          const found = (data as DaySchedule[]).find(d => d.day_of_week === def.day_of_week);
          return found ? {
            ...def,
            open_time: (found.open_time as string).slice(0, 5),
            close_time: (found.close_time as string).slice(0, 5),
            is_closed: found.is_closed,
          } : def;
        });
        setSchedule(merged);
        return merged;
      }
      return DEFAULT_SCHEDULE;
    },
    staleTime: 60_000,
  });

  const { mutate: saveSchedule, isPending: saving } = useMutation({
    mutationFn: async (newSchedule: DaySchedule[]) => {
      const rows = newSchedule.map(s => ({
        merchant_id: merchantId,
        day_of_week: s.day_of_week,
        open_time: s.open_time,
        close_time: s.close_time,
        is_closed: s.is_closed,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('merchant_operating_hours' as any)
        .upsert(rows, { onConflict: 'merchant_id,day_of_week' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Jadwal operasional berhasil disimpan');
      queryClient.invalidateQueries({ queryKey: ['merchant-operating-hours', merchantId] });
    },
    onError: () => toast.error('Gagal menyimpan jadwal'),
  });

  const updateDay = (dayIndex: number, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule(prev =>
      prev.map(s => s.day_of_week === dayIndex ? { ...s, [field]: value } : s)
    );
  };

  const isOpen = isCurrentlyOpen(schedule);
  const todayIndex = new Date().getDay();
  const todaySchedule = schedule.find(s => s.day_of_week === todayIndex);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Jam Operasional
            </CardTitle>
            <CardDescription className="mt-0.5">
              Atur jam buka/tutup toko per hari
            </CardDescription>
          </div>
          <Badge variant={isOpen ? 'default' : 'secondary'} className="shrink-0">
            {isOpen ? '🟢 Buka Sekarang' : '🔴 Tutup'}
          </Badge>
        </div>
        {todaySchedule && !todaySchedule.is_closed && (
          <p className="text-xs text-muted-foreground">
            Hari ini: {DAYS[todayIndex].label} {todaySchedule.open_time} – {todaySchedule.close_time}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {schedule.map(day => {
          const dayInfo = DAYS[day.day_of_week];
          const isToday = day.day_of_week === todayIndex;
          return (
            <div
              key={day.day_of_week}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                isToday ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30',
                day.is_closed && 'opacity-50'
              )}
            >
              {/* Day Label */}
              <span className={cn(
                'text-sm font-medium w-10 shrink-0',
                isToday && 'text-primary font-semibold'
              )}>
                {dayInfo.short}
                {isToday && <span className="block text-xs font-normal text-primary/70">Hari ini</span>}
              </span>

              {/* Toggle Buka/Tutup */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch
                  id={`day-${day.day_of_week}`}
                  checked={!day.is_closed}
                  onCheckedChange={checked => updateDay(day.day_of_week, 'is_closed', !checked)}
                  className="scale-75"
                />
                <Label htmlFor={`day-${day.day_of_week}`} className="text-xs cursor-pointer">
                  {day.is_closed ? 'Tutup' : 'Buka'}
                </Label>
              </div>

              {/* Time Pickers */}
              {!day.is_closed && (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Input
                    type="time"
                    value={day.open_time}
                    onChange={e => updateDay(day.day_of_week, 'open_time', e.target.value)}
                    className="h-7 text-xs px-2 w-24"
                  />
                  <span className="text-muted-foreground text-xs shrink-0">–</span>
                  <Input
                    type="time"
                    value={day.close_time}
                    onChange={e => updateDay(day.day_of_week, 'close_time', e.target.value)}
                    className="h-7 text-xs px-2 w-24"
                  />
                </div>
              )}
              {day.is_closed && (
                <span className="flex-1 text-xs text-muted-foreground italic">Tidak beroperasi</span>
              )}
            </div>
          );
        })}

        <Button
          className="w-full mt-2"
          onClick={() => saveSchedule(schedule)}
          disabled={saving}
        >
          {saving
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
            : <><Save className="h-4 w-4 mr-2" />Simpan Jadwal</>
          }
        </Button>
      </CardContent>
    </Card>
  );
}
