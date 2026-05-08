import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Search, Shield, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN:  'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-700',
  APPROVE:'bg-teal-100 text-teal-800',
  REJECT: 'bg-orange-100 text-orange-800',
};

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction !== 'all') query = query.eq('action', filterAction);
      if (filterTable !== 'all') query = query.eq('table_name', filterTable);
      if (search) query = query.or(`user_email.ilike.%${search}%,table_name.ilike.%${search}%,action.ilike.%${search}%`);

      const { data } = await query;
      setLogs((data || []) as unknown as AuditEntry[]);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterTable, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const exportCSV = () => {
    const headers = ['Waktu', 'User', 'Aksi', 'Tabel', 'ID Record', 'IP'];
    const rows = logs.map(l => [
      format(new Date(l.created_at), 'dd/MM/yyyy HH:mm:ss'),
      l.user_email || 'System',
      l.action,
      l.table_name || '-',
      l.record_id || '-',
      l.ip_address || '-',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `audit-log-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const tables = [...new Set(logs.map(l => l.table_name).filter(Boolean))] as string[];

  return (
    <AdminLayout title="Audit Log Platform" subtitle="Rekaman lengkap aktivitas dan perubahan data">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5" />Audit Log Platform
            </h1>
            <p className="text-sm text-muted-foreground">Rekaman lengkap aktivitas dan perubahan data</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari user, tabel, atau aksi..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              {Object.keys(ACTION_COLORS).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTable} onValueChange={v => { setFilterTable(v); setPage(0); }}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Tabel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tabel</SelectItem>
              {tables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Tabel</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Tidak ada log audit ditemukan
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map(log => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd MMM HH:mm:ss', { locale: idLocale })}
                        </TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{log.user_email || 'System'}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.table_name || '-'}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.record_id ? log.record_id.substring(0, 12) + '…' : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{log.ip_address || '-'}</TableCell>
                        <TableCell>
                          {(log.old_values || log.new_values) && (
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedLog(log)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Menampilkan {logs.length} entri</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}>
              ← Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE || loading}>
              Berikutnya →
            </Button>
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Perubahan Data</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-xs">User</p><p>{selectedLog.user_email || 'System'}</p></div>
                <div><p className="text-muted-foreground text-xs">Aksi</p><Badge className={ACTION_COLORS[selectedLog.action] || ''}>{selectedLog.action}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Tabel</p><p className="font-mono">{selectedLog.table_name}</p></div>
                <div><p className="text-muted-foreground text-xs">Waktu</p><p>{format(new Date(selectedLog.created_at), 'dd MMM yyyy HH:mm:ss')}</p></div>
              </div>
              {selectedLog.old_values && (
                <div>
                  <p className="font-medium text-red-700 mb-1">Sebelum</p>
                  <pre className="bg-red-50 rounded p-2 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.new_values && (
                <div>
                  <p className="font-medium text-emerald-700 mb-1">Sesudah</p>
                  <pre className="bg-emerald-50 rounded p-2 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
