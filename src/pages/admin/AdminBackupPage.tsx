import { useState, useEffect } from 'react';
import { Database, Download, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Plus, Pencil, Trash2, Play, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface BackupLog {
  id: string;
  backup_type: string;
  status: string;
  file_url: string | null;
  file_size: number | null;
  tables_included: string[] | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface BackupSchedule {
  id: string;
  name: string;
  schedule_type: string;
  schedule_time: string;
  schedule_day: number | null;
  tables_included: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

const BACKUP_TABLES = [
  'merchants', 'products', 'orders', 'order_items', 'villages',
  'tourism', 'couriers', 'profiles', 'vouchers', 'reviews',
];

const AVAILABLE_TABLES = [
  { id: 'merchants', label: 'Merchants' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'order_items', label: 'Order Items' },
  { id: 'villages', label: 'Villages' },
  { id: 'tourism', label: 'Tourism' },
  { id: 'couriers', label: 'Couriers' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'reviews', label: 'Reviews' },
];

export default function AdminBackupPage() {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    schedule_type: 'daily',
    schedule_time: '02:00',
    schedule_day: 1,
    tables_included: ['merchants', 'products', 'orders', 'villages', 'tourism', 'couriers'],
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [backupsRes, schedulesRes] = await Promise.all([
        supabase.from('backup_logs').select('*').order('started_at', { ascending: false }).limit(20),
        supabase.from('backup_schedules').select('*').order('created_at', { ascending: false }),
      ]);
      setBackups(backupsRes.data || []);
      setSchedules(schedulesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      const { data: backupLog, error: logError } = await supabase
        .from('backup_logs')
        .insert([{ backup_type: 'manual', status: 'in_progress', tables_included: BACKUP_TABLES }])
        .select()
        .single();

      if (logError) throw logError;

      const backupData: Record<string, any[]> = {};
      const tableQueries: Record<string, any> = {
        merchants: supabase.from('merchants').select('*').limit(10000),
        products: supabase.from('products').select('*').limit(10000),
        orders: supabase.from('orders').select('*').limit(10000),
        order_items: supabase.from('order_items').select('*').limit(10000),
        villages: supabase.from('villages').select('*').limit(10000),
        tourism: supabase.from('tourism').select('*').limit(10000),
        couriers: supabase.from('couriers').select('*').limit(10000),
        profiles: supabase.from('profiles').select('*').limit(10000),
        vouchers: supabase.from('vouchers').select('*').limit(10000),
        reviews: supabase.from('reviews').select('*').limit(10000),
      };

      for (const [table, query] of Object.entries(tableQueries)) {
        const { data, error } = await query;
        if (error) { console.warn(`Error backing up ${table}:`, error); continue; }
        backupData[table] = data || [];
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await supabase.from('backup_logs').update({
        status: 'completed',
        file_size: blob.size,
        completed_at: new Date().toISOString(),
      }).eq('id', backupLog.id);

      toast.success('Backup berhasil dibuat dan diunduh');
      fetchData();
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Gagal membuat backup');
    } finally {
      setCreating(false);
    }
  };

  // Schedule management
  const handleOpenScheduleDialog = (schedule?: BackupSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({
        name: schedule.name,
        schedule_type: schedule.schedule_type,
        schedule_time: schedule.schedule_time,
        schedule_day: schedule.schedule_day || 1,
        tables_included: schedule.tables_included || [],
        is_active: schedule.is_active,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        name: '', schedule_type: 'daily', schedule_time: '02:00', schedule_day: 1,
        tables_included: ['merchants', 'products', 'orders', 'villages', 'tourism', 'couriers'],
        is_active: true,
      });
    }
    setShowScheduleDialog(true);
  };

  const calculateNextRun = (type: string, time: string, day: number) => {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (type === 'daily') { if (next <= now) next.setDate(next.getDate() + 1); }
    else if (type === 'weekly') {
      let daysUntil = day - now.getDay();
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
    } else if (type === 'monthly') {
      next.setDate(day);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.name.trim()) { toast.error('Nama jadwal wajib diisi'); return; }
    setSavingSchedule(true);
    try {
      const nextRunAt = calculateNextRun(scheduleForm.schedule_type, scheduleForm.schedule_time, scheduleForm.schedule_day);
      if (editingSchedule) {
        const { error } = await supabase.from('backup_schedules').update({
          name: scheduleForm.name, schedule_type: scheduleForm.schedule_type,
          schedule_time: scheduleForm.schedule_time,
          schedule_day: scheduleForm.schedule_type !== 'daily' ? scheduleForm.schedule_day : null,
          tables_included: scheduleForm.tables_included, is_active: scheduleForm.is_active,
          next_run_at: nextRunAt, updated_at: new Date().toISOString(),
        }).eq('id', editingSchedule.id);
        if (error) throw error;
        toast.success('Jadwal backup diperbarui');
      } else {
        const { error } = await supabase.from('backup_schedules').insert({
          name: scheduleForm.name, schedule_type: scheduleForm.schedule_type,
          schedule_time: scheduleForm.schedule_time,
          schedule_day: scheduleForm.schedule_type !== 'daily' ? scheduleForm.schedule_day : null,
          tables_included: scheduleForm.tables_included, is_active: scheduleForm.is_active,
          next_run_at: nextRunAt,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
        if (error) throw error;
        toast.success('Jadwal backup ditambahkan');
      }
      setShowScheduleDialog(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Gagal menyimpan jadwal');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (schedule: BackupSchedule) => {
    if (!confirm(`Hapus jadwal "${schedule.name}"?`)) return;
    try {
      await supabase.from('backup_schedules').delete().eq('id', schedule.id);
      toast.success('Jadwal dihapus');
      fetchData();
    } catch { toast.error('Gagal menghapus jadwal'); }
  };

  const handleToggleSchedule = async (schedule: BackupSchedule) => {
    try {
      await supabase.from('backup_schedules').update({ is_active: !schedule.is_active }).eq('id', schedule.id);
      fetchData();
    } catch { console.error('Error toggling schedule'); }
  };

  const handleRunNow = async (schedule: BackupSchedule) => {
    toast.success('Backup dimulai...');
    try {
      await supabase.from('backup_logs').insert({
        backup_type: 'scheduled', status: 'pending',
        tables_included: schedule.tables_included,
        started_at: new Date().toISOString(),
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      await supabase.from('backup_schedules').update({
        last_run_at: new Date().toISOString(),
        next_run_at: calculateNextRun(schedule.schedule_type, schedule.schedule_time, schedule.schedule_day || 1),
      }).eq('id', schedule.id);
      toast.success('Backup berhasil dijalankan');
      fetchData();
    } catch { toast.error('Gagal menjalankan backup'); }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="success">Selesai</Badge>;
      case 'in_progress': return <Badge variant="secondary">Proses</Badge>;
      case 'failed': return <Badge variant="destructive">Gagal</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScheduleLabel = (s: BackupSchedule) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    if (s.schedule_type === 'daily') return `Setiap hari pukul ${s.schedule_time}`;
    if (s.schedule_type === 'weekly') return `Setiap ${days[s.schedule_day || 0]} pukul ${s.schedule_time}`;
    return `Tanggal ${s.schedule_day} setiap bulan pukul ${s.schedule_time}`;
  };

  return (
    <AdminLayout title="Backup & Restore" subtitle="Kelola backup data aplikasi">
      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList>
          <TabsTrigger value="manual" className="gap-2">
            <Database className="h-4 w-4" />
            Backup Manual
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Clock className="h-4 w-4" />
            Backup Terjadwal
          </TabsTrigger>
        </TabsList>

        {/* Manual Backup Tab */}
        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Buat Backup Manual
              </CardTitle>
              <CardDescription>
                Download backup data dalam format JSON. Termasuk: {BACKUP_TABLES.join(', ')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={createBackup} disabled={creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {creating ? 'Membuat Backup...' : 'Buat Backup Sekarang'}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <RefreshCw className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Backup Otomatis</p>
                  <p className="text-sm text-muted-foreground">
                    Database dibackup secara otomatis oleh sistem cloud setiap hari.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backup History */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Riwayat Backup
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Belum ada riwayat backup</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <Card key={backup.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {backup.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        ) : backup.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            Backup {backup.backup_type === 'manual' ? 'Manual' : 'Otomatis'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(backup.started_at), 'dd MMM yyyy HH:mm', { locale: localeId })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{formatFileSize(backup.file_size)}</span>
                        {getStatusBadge(backup.status)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Scheduled Backup Tab */}
        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Jadwal Backup
              </CardTitle>
              <Button onClick={() => handleOpenScheduleDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Jadwal
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada jadwal backup</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Jadwal</TableHead>
                      <TableHead>Tabel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Terakhir</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getScheduleLabel(s)}</TableCell>
                        <TableCell><Badge variant="secondary">{s.tables_included?.length || 0} tabel</Badge></TableCell>
                        <TableCell>
                          <Switch checked={s.is_active} onCheckedChange={() => handleToggleSchedule(s)} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.last_run_at ? format(new Date(s.last_run_at), 'dd MMM yyyy HH:mm', { locale: localeId }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleRunNow(s)} title="Jalankan Sekarang">
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenScheduleDialog(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSchedule(s)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Jadwal Backup' : 'Tambah Jadwal Backup'}</DialogTitle>
            <DialogDescription>Atur jadwal backup otomatis untuk database</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Jadwal *</Label>
              <Input value={scheduleForm.name} onChange={(e) => setScheduleForm(p => ({ ...p, name: e.target.value }))} placeholder="Backup Harian" />
            </div>
            <div className="space-y-2">
              <Label>Frekuensi</Label>
              <Select value={scheduleForm.schedule_type} onValueChange={(v) => setScheduleForm(p => ({ ...p, schedule_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scheduleForm.schedule_type === 'weekly' && (
              <div className="space-y-2">
                <Label>Hari</Label>
                <Select value={scheduleForm.schedule_day.toString()} onValueChange={(v) => setScheduleForm(p => ({ ...p, schedule_day: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'].map((d, i) => (
                      <SelectItem key={i} value={i.toString()}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scheduleForm.schedule_type === 'monthly' && (
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input type="number" min={1} max={28} value={scheduleForm.schedule_day} onChange={(e) => setScheduleForm(p => ({ ...p, schedule_day: parseInt(e.target.value) || 1 }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Waktu</Label>
              <Input type="time" value={scheduleForm.schedule_time} onChange={(e) => setScheduleForm(p => ({ ...p, schedule_time: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tabel yang di-backup</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TABLES.map(t => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={scheduleForm.tables_included.includes(t.id)}
                      onCheckedChange={(checked) => {
                        setScheduleForm(p => ({
                          ...p,
                          tables_included: checked
                            ? [...p.tables_included, t.id]
                            : p.tables_included.filter(x => x !== t.id),
                        }));
                      }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={scheduleForm.is_active} onCheckedChange={(v) => setScheduleForm(p => ({ ...p, is_active: v }))} />
              <Label>Aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Batal</Button>
            <Button onClick={handleSaveSchedule} disabled={savingSchedule}>
              {savingSchedule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
