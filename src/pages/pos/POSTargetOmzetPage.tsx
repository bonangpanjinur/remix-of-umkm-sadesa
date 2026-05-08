import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Target, TrendingUp, AlertTriangle, RefreshCw, Save,
  CheckCircle, XCircle, TrendingDown, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import {
  format, startOfMonth, endOfMonth, getDaysInMonth, getDate
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Target {
  id?: string;
  tenant_id: string;
  outlet_id: string;
  month: number;
  year: number;
  daily_target: number;
  monthly_target: number;
}

interface DailySale {
  date: string;
  total: number;
  label: string;
}

export default function POSTargetOmzetPage() {
  const { tenant, activeOutlet, outlets, formatCurrency } = usePOS();
  const [target, setTarget] = useState<Target | null>(null);
  const [actualSales, setActualSales] = useState(0);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [formDaily, setFormDaily] = useState('');
  const [formMonthly, setFormMonthly] = useState('');
  const [editMode, setEditMode] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tenant || !activeOutlet) return;
    setLoading(true);
    try {
      const monthStr = String(viewMonth).padStart(2,'0');
      const startDate = `${viewYear}-${monthStr}-01`;
      const endDate = `${viewYear}-${monthStr}-${getDaysInMonth(new Date(viewYear, viewMonth-1))}`;

      const [targetRes, salesRes] = await Promise.all([
        supabase.from('pos_omzet_targets' as any)
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .eq('month', viewMonth)
          .eq('year', viewYear)
          .maybeSingle(),
        supabase.from('pos_sales' as any)
          .select('total, created_at')
          .eq('tenant_id', tenant.id)
          .eq('outlet_id', activeOutlet.id)
          .eq('status', 'completed')
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`),
      ]);

      const t = (targetRes as any).data as Target | null;
      setTarget(t);
      setFormDaily(t ? String(t.daily_target) : '');
      setFormMonthly(t ? String(t.monthly_target) : '');

      const sales = ((salesRes as any).data || []) as { total: number; created_at: string }[];
      const total = sales.reduce((s, x) => s + Number(x.total), 0);
      setActualSales(total);

      const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth-1));
      const dailyMap: Record<string, number> = {};
      sales.forEach(s => {
        const d = s.created_at.slice(0,10);
        dailyMap[d] = (dailyMap[d]||0) + Number(s.total);
      });
      const today = format(new Date(),'yyyy-MM-dd');
      const chart: DailySale[] = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${viewYear}-${monthStr}-${String(i).padStart(2,'0')}`;
        if (dateStr > today) break;
        chart.push({ date: dateStr, total: dailyMap[dateStr]||0, label: String(i) });
      }
      setDailySales(chart);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, [tenant, activeOutlet, viewMonth, viewYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveTarget = async () => {
    if (!tenant || !activeOutlet) return;
    if (!formMonthly || !formDaily) { toast.error('Target harian dan bulanan wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id, outlet_id: activeOutlet.id,
        month: viewMonth, year: viewYear,
        daily_target: Number(formDaily),
        monthly_target: Number(formMonthly),
      };
      if (target?.id) {
        await supabase.from('pos_omzet_targets' as any).update(payload).eq('id', target.id);
      } else {
        await supabase.from('pos_omzet_targets' as any).insert(payload);
      }
      toast.success('Target omzet disimpan');
      setEditMode(false);
      fetchAll();
    } catch { toast.error('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const monthlyTarget = target?.monthly_target || 0;
  const dailyTarget = target?.daily_target || 0;
  const progress = monthlyTarget > 0 ? Math.min((actualSales / monthlyTarget) * 100, 100) : 0;
  const daysPassed = getDate(new Date());
  const daysTotal = getDaysInMonth(new Date(viewYear, viewMonth-1));
  const avgPerDay = daysPassed > 0 ? actualSales / daysPassed : 0;
  const projectedMonthly = avgPerDay * daysTotal;
  const isCurrentMonth = viewMonth === new Date().getMonth()+1 && viewYear === new Date().getFullYear();

  const progressColor =
    progress >= 100 ? 'text-emerald-600' :
    progress >= 50 ? 'text-amber-500' :
    'text-red-500';

  if (!tenant) return <POSLayout><div className="flex items-center justify-center h-64"><AlertTriangle className="h-8 w-8 text-muted-foreground"/></div></POSLayout>;

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Target Omzet</h1>
            <p className="text-muted-foreground text-sm">Pantau pencapaian omzet vs target bulanan</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading?'animate-spin':''}`}/> Refresh
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>setEditMode(true)}>
              <Target className="h-4 w-4 mr-1"/> Atur Target
            </Button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-3 items-end">
          <div><Label className="text-xs text-muted-foreground mb-1 block">Bulan</Label>
            <Select value={String(viewMonth)} onValueChange={v=>setViewMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9"><SelectValue/></SelectTrigger>
              <SelectContent>
                {Array.from({length:12},(_,i)=>i+1).map(m=>(
                  <SelectItem key={m} value={String(m)}>{format(new Date(2024,m-1,1),'MMMM',{locale:idLocale})}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground mb-1 block">Tahun</Label>
            <Input type="number" value={viewYear} onChange={e=>setViewYear(Number(e.target.value))} className="w-24 h-9"/>
          </div>
          <Button size="sm" onClick={fetchAll} className="bg-emerald-600 hover:bg-emerald-700">Tampilkan</Button>
        </div>

        {/* Edit target inline */}
        {editMode && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="font-medium text-emerald-800 mb-3">Atur Target {format(new Date(viewYear,viewMonth-1,1),'MMMM yyyy',{locale:idLocale})}</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div><Label className="text-xs mb-1 block">Target Harian (Rp)</Label>
                  <Input type="number" value={formDaily} onChange={e=>{setFormDaily(e.target.value); if(!e.target.value) return; setFormMonthly(String(Number(e.target.value)*getDaysInMonth(new Date(viewYear,viewMonth-1))));}} className="w-40 h-9"/>
                </div>
                <div><Label className="text-xs mb-1 block">Target Bulanan (Rp)</Label>
                  <Input type="number" value={formMonthly} onChange={e=>setFormMonthly(e.target.value)} className="w-44 h-9"/>
                </div>
                <Button size="sm" onClick={saveTarget} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  <Save className="h-4 w-4 mr-1"/>{saving?'Menyimpan...':'Simpan Target'}
                </Button>
                <Button size="sm" variant="outline" onClick={()=>setEditMode(false)}>Batal</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Pencapaian Bulanan</CardTitle></CardHeader>
            <CardContent>
              {monthlyTarget === 0 ? (
                <div className="text-center py-6">
                  <Target className="h-10 w-10 text-muted-foreground mx-auto mb-2"/>
                  <p className="text-muted-foreground text-sm">Belum ada target untuk periode ini.</p>
                  <Button size="sm" className="mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={()=>setEditMode(true)}>Atur Target Sekarang</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${progressColor}`}>{progress.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">dari target bulanan</p>
                  </div>
                  <Progress value={progress} className="h-4"/>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Realisasi</p>
                      <p className="font-bold text-emerald-600">{formatCurrency(actualSales)}</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="font-bold">{formatCurrency(monthlyTarget)}</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Sisa Target</p>
                      <p className={`font-bold ${monthlyTarget - actualSales > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {monthlyTarget - actualSales > 0 ? formatCurrency(monthlyTarget - actualSales) : 'Tercapai! ✓'}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-xs text-muted-foreground">Proyeksi Akhir Bulan</p>
                      <p className={`font-bold ${projectedMonthly >= monthlyTarget ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {isCurrentMonth ? formatCurrency(projectedMonthly) : '-'}
                      </p>
                    </div>
                  </div>
                  {isCurrentMonth && projectedMonthly < monthlyTarget * 0.5 && daysPassed > 15 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0"/>
                      <p className="text-xs text-red-700">Proyeksi di bawah 50% target di tengah bulan. Perlu percepatan penjualan!</p>
                    </div>
                  )}
                  {progress >= 100 && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-500"/>
                      <p className="text-xs text-emerald-700 font-medium">Target bulanan sudah tercapai! 🎉</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Statistik Harian</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label:'Target Harian', value: formatCurrency(dailyTarget), icon:<Target className="h-4 w-4 text-blue-500"/> },
                  { label:'Rata-rata/Hari (realisasi)', value: formatCurrency(avgPerDay), icon:<BarChart3 className="h-4 w-4 text-emerald-500"/> },
                  { label:'Hari Berlalu', value: `${isCurrentMonth ? daysPassed : daysTotal}/${daysTotal} hari`, icon:<TrendingUp className="h-4 w-4 text-purple-500"/> },
                  {
                    label:'Status Harian',
                    value: dailyTarget === 0 ? 'Belum diatur' : avgPerDay >= dailyTarget ? 'Di atas target ✓' : 'Di bawah target',
                    icon: avgPerDay >= dailyTarget ? <CheckCircle className="h-4 w-4 text-emerald-500"/> : <XCircle className="h-4 w-4 text-red-500"/>,
                    color: dailyTarget > 0 ? (avgPerDay >= dailyTarget ? 'text-emerald-600' : 'text-red-500') : '',
                  },
                ].map(item=>(
                  <div key={item.label} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">{item.icon}<span className="text-xs text-muted-foreground">{item.label}</span></div>
                    <span className={`font-medium text-sm ${(item as any).color||''}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily chart */}
        {dailySales.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Grafik Omzet Harian</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailySales} margin={{top:5,right:5,bottom:5,left:5}}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="label" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>v>=1000000?`${(v/1000000).toFixed(1)}jt`:`${(v/1000).toFixed(0)}rb`}/>
                  <Tooltip formatter={(val:any)=>formatCurrency(val)} labelFormatter={l=>`Tgl ${l}`}/>
                  {dailyTarget > 0 && <ReferenceLine y={dailyTarget} stroke="#ef4444" strokeDasharray="4 4" label={{value:'Target',fill:'#ef4444',fontSize:10}}/>}
                  <Bar dataKey="total" name="Omzet" fill="#10b981" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </POSLayout>
  );
}
