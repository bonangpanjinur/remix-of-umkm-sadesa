import { useState, useEffect } from 'react';
import { Database, Download, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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

const BACKUP_TABLES = [
  'merchants',
  'products',
  'orders',
  'order_items',
  'villages',
  'tourism',
  'couriers',
  'profiles',
  'vouchers',
  'reviews',
];

export default function AdminBackupPage() {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setBackups(data || []);
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      // Create backup log entry
      const { data: backupLog, error: logError } = await supabase
        .from('backup_logs')
        .insert([{
          backup_type: 'manual',
          status: 'in_progress',
          tables_included: BACKUP_TABLES,
        }])
        .select()
        .single();

      if (logError) throw logError;

      // Fetch data from all tables
      const backupData: Record<string, any[]> = {};
      
      // Fetch each table individually with proper typing
      const tableQueries = {
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
        if (error) {
          console.warn(`Error backing up ${table}:`, error);
          continue;
        }
        backupData[table] = data || [];
      }

      // Create JSON file
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `backup_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update backup log as completed
      await supabase
        .from('backup_logs')
        .update({
          status: 'completed',
          file_size: blob.size,
          completed_at: new Date().toISOString(),
        })
        .eq('id', backupLog.id);

      toast.success('Backup berhasil dibuat dan diunduh');
      fetchBackups();
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Gagal membuat backup');
    } finally {
      setCreating(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Selesai</Badge>;
      case 'in_progress':
        return <Badge variant="info">Proses</Badge>;
      case 'failed':
        return <Badge variant="destructive">Gagal</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminLayout title="Backup & Restore" subtitle="Kelola backup data aplikasi">
      <div className="space-y-6">
        {/* Actions */}
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
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {creating ? 'Membuat Backup...' : 'Buat Backup Sekarang'}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-info/10 border-info/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-info mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Backup Otomatis</p>
                <p className="text-sm text-muted-foreground">
                  Database dibackup secara otomatis oleh sistem cloud setiap hari. 
                  Backup manual ini untuk kebutuhan ekspor data tambahan.
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
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
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
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : backup.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-info" />
                      )}
                      <div>
                        <p className="font-medium text-sm">
                          Backup {backup.backup_type === 'manual' ? 'Manual' : 'Otomatis'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(backup.started_at), 'dd MMM yyyy HH:mm', { locale: id })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(backup.file_size)}
                      </span>
                      {getStatusBadge(backup.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
