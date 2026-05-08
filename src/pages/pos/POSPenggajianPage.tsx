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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, RefreshCw, AlertCircle, Download, DollarSign, Users, FileText, Printer } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface PosUser { id: string; full_name: string; role: string; }
interface Salary { id: string; pos_user_id: string; salary_type: string; base_amount: number; overtime_rate: number; user?: PosUser; }
interface PayrollItem {
  id: string; period_id: string; pos_user_id: string;
  working_days: number; present_days: number; base_salary: number;
  allowances: number; deductions: number; overtime_pay: number; net_salary: number;
  user?: PosUser;
}
interface PayrollPeriod { id: string; month: number; year: number; status: string; processed_at: string | null; }

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: 'Bulanan', daily: 'Harian', hourly: 'Per Jam',
};

export default function POSPenggajianPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [users, setUsers] = useState<PosUser[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [salaryDialog, setSalaryDialog] = useState(false);
  const [editingSalary, setEditingSalary] = useState<Salary | null>(null);
  const [salaryForm, setSalaryForm] = useState({ pos_user_id:'', salary_type:'monthly', base_amount:'', overtime_rate:'25000' });
  const [saving, setSaving] = useState(false);

  const [itemDialog, setItemDialog] = useState(false);
  const [itemForm, setItemForm] = useState({ pos_user_id:'', working_days:'0', present_days:'0', allowances:'0', deductions:'0', overtime_pay:'0' });

  const fetchAll = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [userRes, salaryRes, periodRes] = await Promise.all([
        supabase.from('pos_users' as any).select('id, full_name, role').eq('tenant_id', tenant.id).eq('is_active', true),
        supabase.from('pos_employee_salaries' as any).select('*, pos_users(id, full_name, role)').eq('tenant_id', tenant.id),
        supabase.from('pos_payroll_periods' as any).select('*').eq('tenant_id', tenant.id).order('year', {ascending:false}).order('month', {ascending:false}).limit(12),
      ]);
      setUsers((userRes.data||[]) as PosUser[]);
      setSalaries(((salaryRes.data||[]) as any[]).map((s:any)=>({...s, user:s.pos_users})));
      const p = (periodRes.data||[]) as PayrollPeriod[];
      setPeriods(p);
      if (p.length > 0 && !selectedPeriod) setSelectedPeriod(p[0].id);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [tenant]);

  const fetchItems = useCallback(async () => {
    if (!tenant || !selectedPeriod) return;
    const res = await supabase.from('pos_payroll_items' as any)
      .select('*, pos_users(id, full_name, role)')
      .eq('period_id', selectedPeriod);
    setItems(((res.data||[]) as any[]).map((i:any)=>({...i, user:i.pos_users})));
  }, [tenant, selectedPeriod]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const saveSalary = async () => {
    if (!tenant || !salaryForm.pos_user_id || !salaryForm.base_amount) {
      toast.error('Karyawan dan gaji pokok wajib diisi'); return;
    }
    setSaving(true);
    try {
      const payload = { tenant_id: tenant.id, pos_user_id: salaryForm.pos_user_id, salary_type: salaryForm.salary_type, base_amount: Number(salaryForm.base_amount), overtime_rate: Number(salaryForm.overtime_rate)||0 };
      if (editingSalary) {
        await supabase.from('pos_employee_salaries' as any).update(payload).eq('id', editingSalary.id);
      } else {
        await supabase.from('pos_employee_salaries' as any).upsert(payload, { onConflict: 'tenant_id,pos_user_id' });
      }
      toast.success('Data gaji disimpan');
      setSalaryDialog(false);
      fetchAll();
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const createPeriod = async () => {
    if (!tenant) return;
    const exists = periods.find(p => p.month === selectedMonth && p.year === selectedYear);
    if (exists) { toast.info('Periode sudah ada'); setSelectedPeriod(exists.id); return; }
    const res = await supabase.from('pos_payroll_periods' as any).insert({ tenant_id: tenant.id, month: selectedMonth, year: selectedYear, status: 'draft' }).select().single();
    if ((res as any).data) { toast.success('Periode dibuat'); fetchAll(); }
  };

  const processPayroll = async () => {
    if (!tenant || !selectedPeriod) return;
    const period = periods.find(p=>p.id===selectedPeriod);
    if (!period) return;
    const daysInMonth = getDaysInMonth(new Date(period.year, period.month - 1));

    for (const sal of salaries) {
      const attRes = await supabase.from('pos_attendances' as any)
        .select('status').eq('pos_user_id', sal.pos_user_id)
        .gte('date', `${period.year}-${String(period.month).padStart(2,'0')}-01`)
        .lte('date', `${period.year}-${String(period.month).padStart(2,'0')}-${daysInMonth}`);
      const atts = (attRes.data||[]) as any[];
      const presentDays = atts.filter(a=>['present','late'].includes(a.status)).length;

      let baseSalary = 0;
      if (sal.salary_type === 'monthly') baseSalary = sal.base_amount;
      else if (sal.salary_type === 'daily') baseSalary = sal.base_amount * presentDays;

      await supabase.from('pos_payroll_items' as any).upsert({
        period_id: selectedPeriod, pos_user_id: sal.pos_user_id,
        working_days: daysInMonth, present_days: presentDays,
        base_salary: baseSalary, allowances: 0, deductions: 0, overtime_pay: 0,
        net_salary: baseSalary,
      }, { onConflict: 'period_id,pos_user_id' });
    }
    toast.success('Penggajian berhasil dihitung otomatis');
    fetchItems();
  };

  const finalizePeriod = async () => {
    if (!selectedPeriod) return;
    await supabase.from('pos_payroll_periods' as any).update({ status: 'finalized', processed_at: new Date().toISOString() }).eq('id', selectedPeriod);
    toast.success('Periode gaji difinalisasi');
    fetchAll();
  };

  const printSlip = (item: PayrollItem) => {
    const period = periods.find(p=>p.id===item.period_id);
    const win = window.open('','_blank','width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><style>
        body{font-family:monospace;font-size:12px;padding:20px;max-width:300px}
        h3{text-align:center} .row{display:flex;justify-content:space-between;padding:2px 0}
        hr{border:1px dashed #ccc} .total{font-weight:bold;font-size:14px}
      </style></head><body>
        <h3>SLIP GAJI</h3>
        <p style="text-align:center">${period ? `${period.month}/${period.year}` : ''}</p>
        <hr/>
        <div class="row"><span>Nama</span><span>${item.user?.full_name||'-'}</span></div>
        <div class="row"><span>Jabatan</span><span>${item.user?.role||'-'}</span></div>
        <hr/>
        <div class="row"><span>Hari Kerja</span><span>${item.working_days} hari</span></div>
        <div class="row"><span>Hadir</span><span>${item.present_days} hari</span></div>
        <div class="row"><span>Gaji Pokok</span><span>Rp ${Number(item.base_salary).toLocaleString('id-ID')}</span></div>
        <div class="row"><span>Tunjangan</span><span>Rp ${Number(item.allowances).toLocaleString('id-ID')}</span></div>
        <div class="row"><span>Lembur</span><span>Rp ${Number(item.overtime_pay).toLocaleString('id-ID')}</span></div>
        <div class="row"><span>Potongan</span><span>-Rp ${Number(item.deductions).toLocaleString('id-ID')}</span></div>
        <hr/>
        <div class="row total"><span>GAJI BERSIH</span><span>Rp ${Number(item.net_salary).toLocaleString('id-ID')}</span></div>
        <hr/><p style="text-align:center;font-size:10px">Dicetak: ${format(new Date(),'dd/MM/yyyy HH:mm')}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const exportCSV = () => {
    const period = periods.find(p=>p.id===selectedPeriod);
    const rows = [
      [`Laporan Penggajian ${period?.month}/${period?.year}`],
      ['Karyawan','Hari Kerja','Hadir','Gaji Pokok','Tunjangan','Lembur','Potongan','Gaji Bersih'],
      ...items.map(i=>[i.user?.full_name,i.working_days,i.present_days,i.base_salary,i.allowances,i.overtime_pay,i.deductions,i.net_salary])
    ];
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`penggajian-${period?.month}-${period?.year}.csv`; a.click();
  };

  const currentPeriod = periods.find(p=>p.id===selectedPeriod);
  const totalGaji = items.reduce((s,i)=>s+Number(i.net_salary),0);

  if (!tenant) return <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground"/></div></POSLayout>;

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Penggajian / Payroll</h1>
            <p className="text-muted-foreground text-sm">Kelola gaji karyawan dan slip gaji</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading?'animate-spin':''}`}/> Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="penggajian">
          <TabsList>
            <TabsTrigger value="penggajian">Proses Penggajian</TabsTrigger>
            <TabsTrigger value="gaji-pokok">Data Gaji Karyawan</TabsTrigger>
          </TabsList>

          <TabsContent value="penggajian" className="space-y-4">
            {/* Period selector */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div><Label className="text-xs text-muted-foreground mb-1 block">Bulan</Label>
                    <Select value={String(selectedMonth)} onValueChange={v=>setSelectedMonth(Number(v))}>
                      <SelectTrigger className="w-32 h-9"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {Array.from({length:12},(_,i)=>i+1).map(m=>(
                          <SelectItem key={m} value={String(m)}>{format(new Date(2024,m-1,1),'MMMM',{locale:idLocale})}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs text-muted-foreground mb-1 block">Tahun</Label>
                    <Input type="number" value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} className="w-24 h-9"/>
                  </div>
                  <Button size="sm" variant="outline" onClick={createPeriod}>Buat Periode</Button>
                  {periods.length > 0 && (
                    <div><Label className="text-xs text-muted-foreground mb-1 block">Periode Tersimpan</Label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-40 h-9"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          {periods.map(p=>(
                            <SelectItem key={p.id} value={p.id}>{format(new Date(p.year,p.month-1,1),'MMMM yyyy',{locale:idLocale})} - {p.status==='finalized'?'Final':'Draft'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedPeriod && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-blue-500"/><span className="text-xs text-muted-foreground">Karyawan</span></div>
                      <p className="font-bold text-2xl">{items.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-emerald-500"/><span className="text-xs text-muted-foreground">Total Gaji</span></div>
                      <p className="font-bold text-2xl text-emerald-600">{formatCurrency(totalGaji)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-purple-500"/><span className="text-xs text-muted-foreground">Status</span></div>
                      <Badge className={`${currentPeriod?.status==='finalized'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'} border-0`}>
                        {currentPeriod?.status==='finalized'?'Difinalisasi':'Draft'}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {currentPeriod?.status !== 'finalized' && (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={processPayroll}>
                      Hitung Gaji Otomatis
                    </Button>
                  )}
                  <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1"/>Export CSV</Button>
                  {currentPeriod?.status !== 'finalized' && items.length > 0 && (
                    <Button variant="outline" className="text-emerald-600 border-emerald-600" onClick={finalizePeriod}>Finalisasi Periode</Button>
                  )}
                </div>

                <Card>
                  <CardContent className="p-0">
                    {items.length === 0 ? (
                      <div className="text-center py-12">
                        <DollarSign className="h-10 w-10 text-muted-foreground mx-auto mb-3"/>
                        <p className="text-muted-foreground mb-2">Belum ada data penggajian pada periode ini.</p>
                        <p className="text-sm text-muted-foreground">Klik "Hitung Gaji Otomatis" untuk menghitung dari data absensi.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Karyawan</TableHead>
                            <TableHead className="text-right">Hadir</TableHead>
                            <TableHead className="text-right">Gaji Pokok</TableHead>
                            <TableHead className="text-right">Tunjangan</TableHead>
                            <TableHead className="text-right">Potongan</TableHead>
                            <TableHead className="text-right">Gaji Bersih</TableHead>
                            <TableHead className="text-right">Slip</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item=>(
                            <TableRow key={item.id}>
                              <TableCell><p className="font-medium">{item.user?.full_name||'-'}</p><p className="text-xs text-muted-foreground">{item.user?.role}</p></TableCell>
                              <TableCell className="text-right text-sm">{item.present_days}/{item.working_days} hr</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.base_salary)}</TableCell>
                              <TableCell className="text-right text-emerald-600">+{formatCurrency(item.allowances)}</TableCell>
                              <TableCell className="text-right text-red-500">-{formatCurrency(item.deductions)}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(item.net_salary)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={()=>printSlip(item)}><Printer className="h-4 w-4"/></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="gaji-pokok" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>{ setEditingSalary(null); setSalaryForm({pos_user_id:'',salary_type:'monthly',base_amount:'',overtime_rate:'25000'}); setSalaryDialog(true); }}>
                <Plus className="h-4 w-4 mr-1"/> Atur Gaji Karyawan
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {salaries.length === 0 ? (
                  <div className="text-center py-12"><p className="text-muted-foreground">Belum ada data gaji. Tambahkan data gaji karyawan terlebih dahulu.</p></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Tipe Gaji</TableHead>
                        <TableHead className="text-right">Gaji Pokok</TableHead>
                        <TableHead className="text-right">Tarif Lembur/jam</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaries.map(s=>(
                        <TableRow key={s.id}>
                          <TableCell><p className="font-medium">{s.user?.full_name||'-'}</p></TableCell>
                          <TableCell><Badge className="border-0 bg-blue-100 text-blue-700">{SALARY_TYPE_LABELS[s.salary_type]||s.salary_type}</Badge></TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(s.base_amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.overtime_rate)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={()=>{ setEditingSalary(s); setSalaryForm({pos_user_id:s.pos_user_id, salary_type:s.salary_type, base_amount:String(s.base_amount), overtime_rate:String(s.overtime_rate)}); setSalaryDialog(true); }}>Edit</Button>
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
      </div>

      <Dialog open={salaryDialog} onOpenChange={setSalaryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSalary ? 'Edit' : 'Atur'} Gaji Karyawan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Karyawan *</Label>
              <Select value={salaryForm.pos_user_id} onValueChange={v=>setSalaryForm(f=>({...f,pos_user_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih karyawan..."/></SelectTrigger>
                <SelectContent>{users.map(u=><SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipe Gaji</Label>
              <Select value={salaryForm.salary_type} onValueChange={v=>setSalaryForm(f=>({...f,salary_type:v}))}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Bulanan (tetap)</SelectItem>
                  <SelectItem value="daily">Harian (× hari hadir)</SelectItem>
                  <SelectItem value="hourly">Per Jam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Gaji Pokok (Rp) *</Label>
              <Input type="number" value={salaryForm.base_amount} onChange={e=>setSalaryForm(f=>({...f,base_amount:e.target.value}))} placeholder="e.g. 2500000" className="mt-1"/>
            </div>
            <div><Label>Tarif Lembur per Jam (Rp)</Label>
              <Input type="number" value={salaryForm.overtime_rate} onChange={e=>setSalaryForm(f=>({...f,overtime_rate:e.target.value}))} className="mt-1"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setSalaryDialog(false)}>Batal</Button>
            <Button onClick={saveSalary} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving?'Menyimpan...':'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
