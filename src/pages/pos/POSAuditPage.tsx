import { useState, useEffect, useCallback } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, Download, RefreshCw, AlertCircle, Search,
  Eye, Clock, User, Activity, Lock, Unlock, ChevronDown, ChevronRight
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_name: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  old_values: any;
  new_values: any;
  created_at: string;
  outlet_id: string | null;
}

interface StockMutation {
  id: string;
  type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
  reference_type: string | null;
  pos_products: { name: string; sku: string | null } | null;
}

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  create:   { label: 'Buat',      color: 'bg-emerald-100 text-emerald-700' },
  update:   { label: 'Ubah',      color: 'bg-blue-100 text-blue-700' },
  delete:   { label: 'Hapus',     color: 'bg-red-100 text-red-700' },
  approve:  { label: 'Setujui',   color: 'bg-teal-100 text-teal-700' },
  reject:   { label: 'Tolak',     color: 'bg-orange-100 text-orange-700' },
  complete: { label: 'Selesai',   color: 'bg-indigo-100 text-indigo-700' },
  login:    { label: 'Login',     color: 'bg-gray-100 text-gray-700' },
  logout:   { label: 'Logout',    color: 'bg-gray-100 text-gray-700' },
  print:    { label: 'Cetak',     color: 'bg-purple-100 text-purple-700' },
  export:   { label: 'Export',    color: 'bg-yellow-100 text-yellow-700' },
};

const MODULE_LABELS: Record<string, string> = {
  kasir: 'Kasir', produk: 'Produk', stok: 'Stok',
  transfer_stok: 'Transfer Stok', pembelian: 'Pembelian',
  kas: 'Kas Harian', pelanggan: 'Pelanggan', supplier: 'Supplier',
  pengguna: 'Pengguna', pengaturan: 'Pengaturan', laporan: 'Laporan',
  retur: 'Retur', system: 'Sistem',
};

const STOCK_MUT_CONFIG: Record<string, { label: string; color: string; dir: string }> = {
  sale:           { label: 'Penjualan',      color: 'bg-red-100 text-red-700',     dir: '−' },
  purchase:       { label: 'Pembelian',      color: 'bg-emerald-100 text-emerald-700', dir: '+' },
  return_in:      { label: 'Retur Masuk',    color: 'bg-blue-100 text-blue-700',   dir: '+' },
  return_out:     { label: 'Retur Keluar',   color: 'bg-orange-100 text-orange-700', dir: '−' },
  adjustment_in:  { label: 'Adjust Masuk',   color: 'bg-teal-100 text-teal-700',   dir: '+' },
  adjustment_out: { label: 'Adjust Keluar',  color: 'bg-purple-100 text-purple-700', dir: '−' },
  adjustment:     { label: 'Penyesuaian',    color: 'bg-gray-100 text-gray-700',   dir: '±' },
  transfer_in:    { label: 'Transfer Masuk', color: 'bg-indigo-100 text-indigo-700', dir: '+' },
  transfer_out:   { label: 'Transfer Keluar',color: 'bg-yellow-100 text-yellow-700', dir: '−' },
  initial:        { label: 'Stok Awal',      color: 'bg-blue-100 text-blue-700',   dir: '+' },
};

export default function POSAuditPage() {
  const { tenant, activeOutlet, outlets } = usePOS();
  const { user } = useAuth();

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stockMuts, setStockMuts] = useState<StockMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('audit');

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterAction, setFilterAction] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [filterOutlet, setFilterOutlet] = useState('all');
  const [search, setSearch] = useState('');

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchAudit = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const start = startOfDay(parseISO(dateStart));
    const end = endOfDay(parseISO(dateEnd));

    try {
      let query = supabase.from('pos_audit_logs' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction !== 'all') query = query.eq('action', filterAction);
      if (filterModule !== 'all') query = query.eq('module', filterModule);
      if (filterOutlet !== 'all') query = query.eq('outlet_id', filterOutlet);

      const { data } = await query;
      setAuditLogs((data || []) as unknown as AuditLog[]);

      const { data: mutData } = await supabase.from('pos_stock_mutations' as any)
        .select('*, pos_products(name, sku)')
        .eq('tenant_id', tenant.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      setStockMuts((mutData || []) as unknown as StockMutation[]);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant, dateStart, dateEnd, filterAction, filterModule, filterOutlet, page]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const logUserActivity = async (action: string, module: string, description: string) => {
    if (!tenant || !user) return;
    await supabase.from('pos_audit_logs' as any).insert({
      tenant_id: tenant.id, outlet_id: activeOutlet?.id || null,
      user_id: user.id, user_name: user.email,
      action, module, description,
    });
  };

  const exportCSV = () => {
    const rows = [
      ['Audit Trail', `${dateStart} - ${dateEnd}`],
      ['Waktu', 'User', 'Aksi', 'Modul', 'Deskripsi'],
      ...auditLogs.map(l => [
        format(new Date(l.created_at), 'dd/MM/yyyy HH:mm:ss'),
        l.user_name || '-', ACTION_CONFIG[l.action]?.label || l.action,
        MODULE_LABELS[l.module] || l.module, l.description,
      ]),
    ];
    const csv = rows.map(r => r.join('\t')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `audit-log-${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
    logUserActivity('export', 'laporan', 'Export audit log ke CSV');
  };

  const filteredLogs = auditLogs.filter(l =>
    search === '' ||
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    (l.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    l.module.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMuts = stockMuts.filter(m =>
    search === '' ||
    (m.pos_products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const actionCounts = auditLogs.reduce((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  const uniqueUsers = new Set(auditLogs.map(l => l.user_name).filter(Boolean)).size;

  if (!tenant) return (
    <POSLayout><div className="flex items-center justify-center h-64"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div></POSLayout>
  );

  return (
    <POSLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Audit Trail</h1>
            <p className="text-muted-foreground text-sm">Jejak aktivitas & perubahan data sistem</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAudit} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">Total Aktivitas</span></div>
              <p className="font-bold text-2xl">{auditLogs.length}</p>
              <p className="text-xs text-muted-foreground">periode ini</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><User className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground">Pengguna Aktif</span></div>
              <p className="font-bold text-2xl">{uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">user tercatat</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-purple-600" /><span className="text-xs text-muted-foreground">Mutasi Stok</span></div>
              <p className="font-bold text-2xl">{stockMuts.length}</p>
              <p className="text-xs text-muted-foreground">perubahan stok</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Shield className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Aksi Sensitif</span></div>
              <p className="font-bold text-2xl text-red-500">
                {(actionCounts['delete'] || 0) + (actionCounts['reject'] || 0)}
              </p>
              <p className="text-xs text-muted-foreground">hapus & tolak</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Dari</Label>
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-36 h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Sampai</Label>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-36 h-9" />
          </div>
          <Button size="sm" onClick={() => { setPage(0); fetchAudit(); }} className="bg-emerald-600 hover:bg-emerald-700">Tampilkan</Button>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari user, deskripsi, modul..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Aksi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterModule} onValueChange={v => { setFilterModule(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Modul" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Modul</SelectItem>
              {Object.entries(MODULE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {outlets.length > 1 && (
            <Select value={filterOutlet} onValueChange={v => { setFilterOutlet(v); setPage(0); }}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Outlet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Outlet</SelectItem>
                {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="audit">Log Aktivitas ({filteredLogs.length})</TabsTrigger>
            <TabsTrigger value="stock">Mutasi Stok ({filteredMuts.length})</TabsTrigger>
          </TabsList>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">Memuat...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Tidak ada log aktivitas pada periode ini</p>
                    <p className="text-sm">Aktivitas pengguna akan tercatat di sini</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Waktu</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Aksi</TableHead>
                          <TableHead>Modul</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map(log => {
                          const actCfg = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' };
                          const hasDetail = log.old_values || log.new_values;
                          return (
                            <TableRow key={log.id} className={hasDetail ? 'cursor-pointer hover:bg-muted/50' : ''}
                              onClick={() => hasDetail && setDetailLog(log)}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: idLocale })}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">{log.user_name || 'Sistem'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-xs border-0 ${actCfg.color}`}>{actCfg.label}</Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {MODULE_LABELS[log.module] || log.module}
                              </TableCell>
                              <TableCell className="text-sm max-w-xs truncate">{log.description}</TableCell>
                              <TableCell>
                                {hasDetail && <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {/* Pagination */}
                    <div className="flex items-center justify-between p-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Menampilkan {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredLogs.length + page * PAGE_SIZE)} entri
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
                        <Button variant="outline" size="sm" disabled={filteredLogs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Berikutnya</Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Mutations Tab */}
          <TabsContent value="stock">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">Memuat...</div>
                ) : filteredMuts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Tidak ada mutasi stok pada periode ini</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Sebelum</TableHead>
                        <TableHead className="text-right">Perubahan</TableHead>
                        <TableHead className="text-right">Sesudah</TableHead>
                        <TableHead>Referensi</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMuts.map(m => {
                        const cfg = STOCK_MUT_CONFIG[m.type] || { label: m.type, color: 'bg-gray-100 text-gray-700', dir: '±' };
                        const isIn = cfg.dir === '+';
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: idLocale })}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{m.pos_products?.name || '?'}</p>
                              {m.pos_products?.sku && <p className="text-xs text-muted-foreground">{m.pos_products.sku}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs border-0 ${cfg.color}`}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">{m.quantity_before}</TableCell>
                            <TableCell className={`text-right font-bold text-sm ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                              {cfg.dir}{Math.abs(m.quantity)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">{m.quantity_after}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.reference_type || '-'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-32 truncate">{m.notes || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Dialog */}
        <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Log Aktivitas</DialogTitle>
            </DialogHeader>
            {detailLog && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Waktu</p><p className="font-medium">{format(new Date(detailLog.created_at), 'dd MMM yyyy HH:mm:ss', { locale: idLocale })}</p></div>
                  <div><p className="text-xs text-muted-foreground">User</p><p className="font-medium">{detailLog.user_name || 'Sistem'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Aksi</p><Badge className={`text-xs border-0 ${ACTION_CONFIG[detailLog.action]?.color}`}>{ACTION_CONFIG[detailLog.action]?.label || detailLog.action}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Modul</p><p className="font-medium">{MODULE_LABELS[detailLog.module] || detailLog.module}</p></div>
                </div>
                <div><p className="text-xs text-muted-foreground">Deskripsi</p><p className="font-medium">{detailLog.description}</p></div>
                {detailLog.old_values && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nilai Lama</p>
                    <pre className="bg-red-50 border border-red-100 rounded p-2 text-xs overflow-x-auto">
                      {JSON.stringify(detailLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                {detailLog.new_values && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nilai Baru</p>
                    <pre className="bg-emerald-50 border border-emerald-100 rounded p-2 text-xs overflow-x-auto">
                      {JSON.stringify(detailLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </POSLayout>
  );
}
