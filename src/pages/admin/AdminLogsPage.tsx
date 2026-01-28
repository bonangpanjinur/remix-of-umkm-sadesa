import { useState, useEffect } from 'react';
import { ScrollText, Search, Calendar, Filter, User, Activity } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  BLOCK_USER: 'Blokir Pengguna',
  UNBLOCK_USER: 'Buka Blokir Pengguna',
  APPROVE_MERCHANT: 'Setujui Merchant',
  REJECT_MERCHANT: 'Tolak Merchant',
  APPROVE_VILLAGE: 'Setujui Desa',
  REJECT_VILLAGE: 'Tolak Desa',
  APPROVE_COURIER: 'Setujui Kurir',
  REJECT_COURIER: 'Tolak Kurir',
  APPROVE_REFUND: 'Setujui Refund',
  REJECT_REFUND: 'Tolak Refund',
  UPDATE_SETTINGS: 'Update Pengaturan',
  ASSIGN_COURIER: 'Assign Kurir',
  UPDATE_ORDER: 'Update Pesanan',
  CREATE_PROMOTION: 'Buat Promosi',
  UPDATE_PROMOTION: 'Update Promosi',
  DELETE_PROMOTION: 'Hapus Promosi',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Pengguna',
  merchant: 'Merchant',
  village: 'Desa',
  courier: 'Kurir',
  order: 'Pesanan',
  refund: 'Refund',
  settings: 'Pengaturan',
  promotion: 'Promosi',
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case '1day':
        return subDays(now, 1);
      case '7days':
        return subDays(now, 7);
      case '30days':
        return subDays(now, 30);
      default:
        return subDays(now, 7);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const startDate = getDateRange();

      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Fetch admin names separately
      const adminIds = [...new Set((data || []).map(l => l.admin_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', adminIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const mapped: AuditLog[] = (data || []).map(log => ({
        id: log.id,
        adminId: log.admin_id,
        adminName: profileMap.get(log.admin_id) || 'Unknown',
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        oldValue: log.old_value as Record<string, unknown> | null,
        newValue: log.new_value as Record<string, unknown> | null,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      }));

      setLogs(mapped);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [dateFilter]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.adminName.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId?.includes(search);
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter;
    
    return matchesSearch && matchesAction && matchesEntity;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueEntities = [...new Set(logs.map(l => l.entityType))];

  const getActionBadge = (action: string) => {
    if (action.includes('APPROVE') || action.includes('UNBLOCK')) {
      return 'bg-primary/10 text-primary';
    }
    if (action.includes('REJECT') || action.includes('BLOCK') || action.includes('DELETE')) {
      return 'bg-destructive/10 text-destructive';
    }
    if (action.includes('UPDATE')) {
      return 'bg-info/10 text-info';
    }
    return 'bg-muted text-muted-foreground';
  };

  return (
    <AdminLayout title="System Logs" subtitle="Audit trail aktivitas admin">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari admin, aksi, atau ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1day">24 Jam Terakhir</SelectItem>
            <SelectItem value="7days">7 Hari Terakhir</SelectItem>
            <SelectItem value="30days">30 Hari Terakhir</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full lg:w-48">
            <Activity className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Semua Aksi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aksi</SelectItem>
            {uniqueActions.map(action => (
              <SelectItem key={action} value={action}>
                {ACTION_LABELS[action] || action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full lg:w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Semua Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Entity</SelectItem>
            {uniqueEntities.map(entity => (
              <SelectItem key={entity} value={entity}>
                {ENTITY_LABELS[entity] || entity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Log</p>
          <p className="text-2xl font-bold">{logs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Hari Ini</p>
          <p className="text-2xl font-bold">
            {logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Admin Aktif</p>
          <p className="text-2xl font-bold">{new Set(logs.map(l => l.adminId)).size}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Hasil Filter</p>
          <p className="text-2xl font-bold">{filteredLogs.length}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <ScrollText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    Tidak ada log ditemukan
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), 'dd MMM, HH:mm', { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {log.adminName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ENTITY_LABELS[log.entityType] || log.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {log.entityId?.slice(0, 8) || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailDialogOpen(true);
                        }}
                      >
                        Lihat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Waktu</p>
                  <p>{format(new Date(selectedLog.createdAt), 'dd MMMM yyyy, HH:mm:ss', { locale: idLocale })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admin</p>
                  <p>{selectedLog.adminName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aksi</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(selectedLog.action)}`}>
                    {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entity</p>
                  <p>{ENTITY_LABELS[selectedLog.entityType] || selectedLog.entityType} ({selectedLog.entityId?.slice(0, 8) || '-'})</p>
                </div>
              </div>

              {selectedLog.oldValue && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Nilai Sebelum</p>
                  <pre className="p-3 bg-secondary rounded-lg text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Nilai Sesudah</p>
                  <pre className="p-3 bg-secondary rounded-lg text-sm overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {(selectedLog.ipAddress || selectedLog.userAgent) && (
                <div className="text-sm text-muted-foreground border-t pt-4">
                  {selectedLog.ipAddress && <p>IP: {selectedLog.ipAddress}</p>}
                  {selectedLog.userAgent && <p className="truncate">User Agent: {selectedLog.userAgent}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
