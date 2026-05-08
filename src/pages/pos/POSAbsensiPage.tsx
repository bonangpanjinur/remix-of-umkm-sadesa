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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, RefreshCw, UserCheck, Clock, AlertCircle, Download, CheckCircle, XCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  present: { label: 'Hadir', color: 'bg-emerald-100 text-emerald-700' },
  absent: { label: 'Tidak Hadir', color: 'bg-red-100 text-red-700' },
  late: { label: 'Terlambat', color: 'bg-amber-100 text-amber-700' },
  permission: { label: 'Izin', color: 'bg-blue-100 text-blue-700' },
  sick: { label: 'Sakit', color: 'bg-purple-100 text-purple-700' },
};

interface Attendance {
  id: string;
  pos_user_id: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  late_minutes: number;
  notes: string | null;
  user?: { full_name: string; role: string };
}

interface PosUser { id: string; full_name: string; role: string; }

export default function POSAbsensiPage() {
  const { tenant, activeOutlet } = usePOS();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<PosUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateStart, setDateStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterUser, setFilterUser] = useState('all');

  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({
    pos_user_id: '', date: format(new Date(), 'yyyy-MM-dd'),
    check_in_at: '', check_out_at: '', status: 'present', notes: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    try {
      const [attRes, userRes] = await Promise.all([
        supabase.from('pos_attendances' as any)
          .select('*, pos_users(id, full_name, role)')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .gte('date', dateStart)
          .lte('date', dateEnd)
          .order('date', { ascending: false })
          .order('check_in_at', { ascending: false }),
        supabase.from('pos_users' as any)
          .select('id, full_name, role')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true),
      ]);
      const att = (attRes.data || []).map((a: any) => ({
        ...a,
        user: a.pos_users,
      })) as Attendance[];
      setAttendances(att);
      setUsers((userRes.data || []) as PosUser[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [tenant, activeOutlet, dateStart, dateEnd]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveAbsensi = async () => {
    if (!tenant || !activeOutlet || !form.pos_user_id || !form.date) {
      toast.error('Karyawan dan tanggal wajib diisi'); return;
    }
    setSaving(true);
    try {
      const checkInFull = form.check_in_at ? `${form.date}T${form.check_in_at}:00` : null;
      const checkOutFull = form.check_out_at ? `${form.date}T${form.check_out_at}:00` : null;
      let lateMin = 0;
      if (form.status === 'late' && form.check_in_at) {
        const [h, m] = form.check_in_at.split(':').map(Number);
        lateMin = Math.max(0, (h * 60 + m) - 8 * 60);
      }
      await supabase.from('pos_attendances' as any).upsert({
        tenant_id: tenant.id,
        outlet_id: activeOutlet.id,
        pos_user_id: form.pos_user_id,
        date: form.date,
        check_in_at: checkInFull,
        check_out_at: checkOutFull,
        status: form.status,
        late_minutes: lateMin,
        notes: form.notes || null,
      }, { onConflict: 'tenant_id,pos_user_id,date' });
      toast.success('Absensi disimpan');
      setDialog(false);
      fetchAll();
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const clockIn = async (userId: string) => {
    if (!tenant || !activeOutlet) return;
    const now = new Date();
    await supabase.from('pos_attendances' as any).upsert({
      tenant_id: tenant.id, outlet_id: activeOutlet.id,
      pos_user_id: userId, date: format(now, 'yyyy-MM-dd'),
      check_in_at: now.toISOString(), status: 'present', late_minutes: 0,
    }, { onConflict: 'tenant_id,pos_user_id,date' });
    toast.success('Clock-in berhasil');
    fetchAll();
  };

  const clockOut = async (att: Attendance) => {
    const now = new Date();
    await supabase.from('pos_attendances' as any).update({ check_out_at: now.toISOString() }).eq('id', att.id);
    toast.success('Clock-out berhasil');
    fetchAll();
  };

  const exportCSV = () => {
    const rows = [
      ['Tanggal','Karyawan','Status','Masuk','Keluar','Terlambat (mnt)','Keterangan'],
      ...filtered.map(a => [
        a.date, a.user?.full_name||'-', STATUS_CONFIG[a.status]?.label||a.status,
        a.check_in_at ? format(parseISO(a.check_in_at),'HH:mm') : '-',
        a.check_out_at ? format(parseISO(a.check_out_at),'HH:mm') : '-',
        a.late_minutes, a.notes||'-',
      ])
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`absensi-${dateStart}-${dateEnd}.csv`; a.click();
  };

  const filtered = attendances.filter(a => filterUser === 'all' || a.pos_user_id === filterUser);

  const stats = {
    hadir: filtered.filter(a => a.status === 'present').length,
    terlambat: filtered.filter(a => a.status === 'late').length,
    izin: filtered.filter(a => ['permission','sick'].includes(a.status)).length,
    absen: filtered.filter(a => a.status === 'absent').length,
  };

  if (!tenant) {
    return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground"/></div></POSLayout>;
  }

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Absensi Karyawan</h1>
            <p className="text-muted-foreground text-sm">Rekap kehadiran dan clock-in/out karyawan</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading?'animate-spin':''}`}/> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1"/> CSV
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>{ setForm({pos_user_id:'', date: format(new Date(),'yyyy-MM-dd'), check_in_at:'', check_out_at:'', status:'present', notes:''}); setDialog(true); }}>
              <Plus className="h-4 w-4 mr-1"/> Catat Absensi
            </Button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-3 flex-wrap items-end">
          <div><Label className="text-xs text-muted-foreground mb-1 block">Dari</Label>
            <Input type="date" value={dateStart} onChange={e=>setDateStart(e.target.value)} className="w-36 h-9"/>
          </div>
          <div><Label className="text-xs text-muted-foreground mb-1 block">Sampai</Label>
            <Input type="date" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} className="w-36 h-9"/>
          </div>
          <div><Label className="text-xs text-muted-foreground mb-1 block">Karyawan</Label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-44 h-9"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Karyawan</SelectItem>
                {users.map(u=><SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={fetchAll} className="bg-emerald-600 hover:bg-emerald-700">Tampilkan</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Hadir', value: stats.hadir, color:'text-emerald-600', icon:<CheckCircle className="h-4 w-4 text-emerald-600"/> },
            { label:'Terlambat', value: stats.terlambat, color:'text-amber-500', icon:<Clock className="h-4 w-4 text-amber-500"/> },
            { label:'Izin/Sakit', value: stats.izin, color:'text-blue-600', icon:<UserCheck className="h-4 w-4 text-blue-600"/> },
            { label:'Tidak Hadir', value: stats.absen, color:'text-red-500', icon:<XCircle className="h-4 w-4 text-red-500"/> },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-muted-foreground">{s.label}</span></div>
                <p className={`font-bold text-2xl ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">rekaman</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Clock-in quick panel */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Clock-In / Clock-Out Cepat</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {users.map(u => {
                const todayAtt = attendances.find(a => a.pos_user_id===u.id && a.date===format(new Date(),'yyyy-MM-dd'));
                return (
                  <div key={u.id} className="flex flex-col items-center p-3 rounded-lg border text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div><p className="text-sm font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.role}</p>
                    </div>
                    {todayAtt ? (
                      <div className="text-center">
                        <Badge className={`text-xs border-0 ${STATUS_CONFIG[todayAtt.status]?.color}`}>{STATUS_CONFIG[todayAtt.status]?.label}</Badge>
                        {todayAtt.check_in_at && <p className="text-xs text-muted-foreground mt-1">Masuk: {format(parseISO(todayAtt.check_in_at),'HH:mm')}</p>}
                        {!todayAtt.check_out_at && (
                          <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={()=>clockOut(todayAtt)}>Clock-Out</Button>
                        )}
                      </div>
                    ) : (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={()=>clockIn(u.id)}>Clock-In</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Riwayat Absensi</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3"/>
                <p className="text-muted-foreground">Belum ada data absensi pada periode ini.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Jam Masuk</TableHead>
                    <TableHead>Jam Keluar</TableHead>
                    <TableHead>Terlambat</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{format(parseISO(a.date),'EEEE, dd MMM yyyy',{locale:idLocale})}</TableCell>
                      <TableCell className="font-medium">{a.user?.full_name||'-'}</TableCell>
                      <TableCell><Badge className={`text-xs border-0 ${STATUS_CONFIG[a.status]?.color||'bg-gray-100'}`}>{STATUS_CONFIG[a.status]?.label||a.status}</Badge></TableCell>
                      <TableCell className="text-sm">{a.check_in_at ? format(parseISO(a.check_in_at),'HH:mm') : '-'}</TableCell>
                      <TableCell className="text-sm">{a.check_out_at ? format(parseISO(a.check_out_at),'HH:mm') : <Badge className="text-xs bg-amber-100 text-amber-700 border-0">Belum CO</Badge>}</TableCell>
                      <TableCell className="text-sm">{a.late_minutes > 0 ? <span className="text-amber-600">{a.late_minutes} mnt</span> : '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.notes||'-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Absensi Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Karyawan *</Label>
              <Select value={form.pos_user_id} onValueChange={v=>setForm(f=>({...f,pos_user_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih karyawan..."/></SelectTrigger>
                <SelectContent>{users.map(u=><SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tanggal *</Label>
              <Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="mt-1"/>
            </div>
            <div><Label>Status *</Label>
              <Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_CONFIG).map(([k,v])=><SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Jam Masuk</Label><Input type="time" value={form.check_in_at} onChange={e=>setForm(f=>({...f,check_in_at:e.target.value}))} className="mt-1"/></div>
              <div><Label>Jam Keluar</Label><Input type="time" value={form.check_out_at} onChange={e=>setForm(f=>({...f,check_out_at:e.target.value}))} className="mt-1"/></div>
            </div>
            <div><Label>Keterangan</Label>
              <Textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Izin sakit, dll..." className="mt-1" rows={2}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setDialog(false)}>Batal</Button>
            <Button onClick={saveAbsensi} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving?'Menyimpan...':'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
