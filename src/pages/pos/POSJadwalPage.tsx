import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, RefreshCw, Clock, Calendar, Pencil, Trash2, AlertCircle, Users } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  color?: string;
}

interface PosUser {
  id: string;
  full_name: string;
  role: string;
}

interface Schedule {
  id: string;
  pos_user_id: string;
  shift_id: string;
  date: string;
  shift?: Shift;
  user?: PosUser;
}

const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

export default function POSJadwalPage() {
  const { tenant, activeOutlet } = usePOS();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<PosUser[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<'kalender'|'shift'>('kalender');

  const [shiftDialog, setShiftDialog] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({ name:'', start_time:'08:00', end_time:'16:00', days_of_week: [] as string[], color: COLORS[0] });

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schedForm, setSchedForm] = useState({ pos_user_id:'', shift_id:'', date: format(new Date(), 'yyyy-MM-dd') });
  const [saving, setSaving] = useState(false);

  const weekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7);
  const weekDays = Array.from({length:7}, (_, i) => addDays(weekStart, i));

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [shiftRes, userRes, schedRes] = await Promise.all([
        supabase.from('pos_shifts' as any).select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('pos_users' as any).select('id, full_name, role').eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('pos_schedules' as any)
          .select('*, pos_shifts(*), pos_users(id, full_name, role)')
          .eq('tenant_id', tenant.id)
          .gte('date', format(weekDays[0], 'yyyy-MM-dd'))
          .lte('date', format(weekDays[6], 'yyyy-MM-dd')),
      ]);
      setShifts((shiftRes.data || []) as any);
      setUsers((userRes.data || []) as any);
      setSchedules((schedRes.data || []).map((s:any) => ({
        ...s,
        shift: s.pos_shifts,
        user: s.pos_users,
      })) as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenant, weekOffset]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveShift = async () => {
    if (!tenant || !shiftForm.name || !shiftForm.start_time || !shiftForm.end_time) {
      toast.error('Nama, jam masuk, dan jam keluar wajib diisi'); return;
    }
    setSaving(true);
    try {
      const payload = { tenant_id: tenant.id, ...shiftForm };
      if (editingShift) {
        await supabase.from('pos_shifts' as any).update(payload).eq('id', editingShift.id);
        toast.success('Shift diperbarui');
      } else {
        await supabase.from('pos_shifts' as any).insert(payload);
        toast.success('Shift ditambahkan');
      }
      setShiftDialog(false);
      fetchAll();
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const deleteShift = async (id: string) => {
    if (!confirm('Hapus shift ini?')) return;
    await supabase.from('pos_shifts' as any).delete().eq('id', id);
    toast.success('Shift dihapus');
    fetchAll();
  };

  const saveSchedule = async () => {
    if (!tenant || !activeOutlet || !schedForm.pos_user_id || !schedForm.shift_id || !schedForm.date) {
      toast.error('Semua field wajib diisi'); return;
    }
    setSaving(true);
    try {
      await supabase.from('pos_schedules' as any).upsert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet.id,
        ...schedForm,
      }, { onConflict: 'tenant_id,pos_user_id,date' });
      toast.success('Jadwal disimpan');
      setScheduleDialog(false);
      fetchAll();
    } catch { toast.error('Gagal menyimpan jadwal'); }
    finally { setSaving(false); }
  };

  const openNewShift = () => {
    setEditingShift(null);
    setShiftForm({ name:'', start_time:'08:00', end_time:'16:00', days_of_week:[], color: COLORS[0] });
    setShiftDialog(true);
  };

  const openEditShift = (s: Shift) => {
    setEditingShift(s);
    setShiftForm({ name: s.name, start_time: s.start_time, end_time: s.end_time, days_of_week: s.days_of_week||[], color: s.color||COLORS[0] });
    setShiftDialog(true);
  };

  const toggleDay = (day: string) => {
    setShiftForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day) ? f.days_of_week.filter(d => d !== day) : [...f.days_of_week, day]
    }));
  };

  const getSchedulesForDay = (date: Date) =>
    schedules.filter(s => s.date === format(date, 'yyyy-MM-dd'));

  if (!tenant) {
    return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground"/></div></POSLayout>;
  }

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Jadwal Shift Karyawan</h1>
            <p className="text-muted-foreground text-sm">Atur shift dan jadwal kerja per karyawan</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`}/> Refresh
            </Button>
            <Button size="sm" variant={activeTab==='kalender'?'default':'outline'} onClick={()=>setActiveTab('kalender')} className="bg-emerald-600 hover:bg-emerald-700">
              <Calendar className="h-4 w-4 mr-1"/> Kalender
            </Button>
            <Button size="sm" variant={activeTab==='shift'?'default':'outline'} onClick={()=>setActiveTab('shift')}>
              <Clock className="h-4 w-4 mr-1"/> Kelola Shift
            </Button>
          </div>
        </div>

        {activeTab === 'kalender' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={()=>setWeekOffset(w=>w-1)}>← Minggu Lalu</Button>
              <span className="font-medium text-sm">
                {format(weekDays[0],'dd MMM',{locale:idLocale})} – {format(weekDays[6],'dd MMM yyyy',{locale:idLocale})}
              </span>
              <Button variant="outline" size="sm" onClick={()=>setWeekOffset(w=>w+1)}>Minggu Depan →</Button>
              <Button size="sm" className="ml-auto bg-emerald-600 hover:bg-emerald-700" onClick={()=>{ setSchedForm({pos_user_id:'', shift_id:'', date: format(new Date(),'yyyy-MM-dd')}); setScheduleDialog(true); }}>
                <Plus className="h-4 w-4 mr-1"/> Tambah Jadwal
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, i) => {
                const dayScheds = getSchedulesForDay(day);
                const isToday = format(day,'yyyy-MM-dd') === format(new Date(),'yyyy-MM-dd');
                return (
                  <div key={i} className={`min-h-32 rounded-lg border p-2 ${isToday ? 'border-emerald-400 bg-emerald-50' : 'border-border bg-card'}`}>
                    <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      <div>{DAYS[i]}</div>
                      <div className={`text-base font-bold ${isToday ? 'text-emerald-600' : 'text-foreground'}`}>{format(day,'d')}</div>
                    </div>
                    {dayScheds.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">Tidak ada jadwal</div>
                    ) : dayScheds.map(s => (
                      <div key={s.id} className="text-xs rounded px-1.5 py-0.5 mb-1 text-white truncate"
                        style={{backgroundColor: s.shift?.color || '#10b981'}}>
                        <div className="font-medium truncate">{s.user?.full_name}</div>
                        <div className="opacity-90">{s.shift?.name}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'shift' && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Daftar Shift</CardTitle>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openNewShift}>
                  <Plus className="h-4 w-4 mr-1"/> Tambah Shift
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Memuat...</div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3"/>
                  <p className="text-muted-foreground">Belum ada shift. Tambahkan shift pertama Anda.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Shift</TableHead>
                      <TableHead>Jam Kerja</TableHead>
                      <TableHead>Hari Aktif</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: s.color||'#10b981'}}/>
                            <span className="font-medium">{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{s.start_time} – {s.end_time}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(s.days_of_week||[]).map(d => (
                              <Badge key={d} className="text-xs bg-emerald-100 text-emerald-700 border-0">
                                {DAYS[DAY_KEYS.indexOf(d)] || d}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={()=>openEditShift(s)}><Pencil className="h-4 w-4"/></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={()=>deleteShift(s.id)}><Trash2 className="h-4 w-4"/></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Shift Dialog */}
      <Dialog open={shiftDialog} onOpenChange={setShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit Shift' : 'Tambah Shift Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Shift *</Label>
              <Input placeholder="Shift Pagi, Shift Malam..." value={shiftForm.name} onChange={e=>setShiftForm(f=>({...f,name:e.target.value}))} className="mt-1"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Jam Masuk *</Label>
                <Input type="time" value={shiftForm.start_time} onChange={e=>setShiftForm(f=>({...f,start_time:e.target.value}))} className="mt-1"/>
              </div>
              <div><Label>Jam Keluar *</Label>
                <Input type="time" value={shiftForm.end_time} onChange={e=>setShiftForm(f=>({...f,end_time:e.target.value}))} className="mt-1"/>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Hari Aktif</Label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS.map((d, i) => (
                  <div key={d} className="flex items-center gap-1.5">
                    <Checkbox id={`day-${i}`} checked={shiftForm.days_of_week.includes(DAY_KEYS[i])}
                      onCheckedChange={()=>toggleDay(DAY_KEYS[i])}/>
                    <label htmlFor={`day-${i}`} className="text-sm cursor-pointer">{d}</label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Warna</Label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all ${shiftForm.color===c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{backgroundColor:c}} onClick={()=>setShiftForm(f=>({...f,color:c}))}/>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShiftDialog(false)}>Batal</Button>
            <Button onClick={saveShift} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Jadwal Karyawan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Karyawan *</Label>
              <Select value={schedForm.pos_user_id} onValueChange={v=>setSchedForm(f=>({...f,pos_user_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih karyawan..."/></SelectTrigger>
                <SelectContent>
                  {users.map(u=><SelectItem key={u.id} value={u.id}>{u.full_name} ({u.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Shift *</Label>
              <Select value={schedForm.shift_id} onValueChange={v=>setSchedForm(f=>({...f,shift_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih shift..."/></SelectTrigger>
                <SelectContent>
                  {shifts.map(s=><SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Tanggal *</Label>
              <Input type="date" value={schedForm.date} onChange={e=>setSchedForm(f=>({...f,date:e.target.value}))} className="mt-1"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setScheduleDialog(false)}>Batal</Button>
            <Button onClick={saveSchedule} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
