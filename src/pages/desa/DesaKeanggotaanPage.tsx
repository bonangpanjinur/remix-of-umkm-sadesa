import { useState, useEffect } from 'react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Search, Award, Store, CheckCircle, XCircle, Clock, QrCode, Download } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface MerchantMember {
  id: string;
  name: string;
  business_category: string | null;
  phone: string | null;
  address: string | null;
  registration_status: string;
  status: string;
  membership_status: string;
  membership_number: string | null;
  membership_expires_at: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Terverifikasi', color: 'bg-emerald-100 text-emerald-800' },
  PENDING:  { label: 'Menunggu',      color: 'bg-yellow-100 text-yellow-800' },
  REJECTED: { label: 'Ditolak',       color: 'bg-red-100 text-red-800' },
};

const MEMBERSHIP_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: 'Aktif',          color: 'bg-emerald-100 text-emerald-800' },
  pending:  { label: 'Proses',         color: 'bg-blue-100 text-blue-800' },
  inactive: { label: 'Tidak Aktif',    color: 'bg-gray-100 text-gray-600' },
  expired:  { label: 'Kedaluwarsa',    color: 'bg-red-100 text-red-800' },
};

export default function DesaKeanggotaanPage() {
  const { user } = useAuth();
  const [villageId, setVillageId] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<MerchantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [certDialog, setCertDialog] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantMember | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const fetchVillage = async () => {
      if (!user) return;
      const { data } = await supabase.from('user_villages').select('village_id').eq('user_id', user.id).maybeSingle();
      if (data?.village_id) setVillageId(data.village_id);
    };
    fetchVillage();
  }, [user]);

  useEffect(() => { if (villageId) fetchMerchants(); }, [villageId]);

  const fetchMerchants = async () => {
    if (!villageId) return;
    setLoading(true);
    const { data } = await supabase
      .from('merchants')
      .select('id, name, business_category, phone, address, registration_status, status, created_at')
      .eq('village_id', villageId)
      .order('created_at', { ascending: false });

    setMerchants(((data || []) as any[]).map(m => ({
      ...m,
      membership_status: m.registration_status === 'APPROVED' ? 'active' : m.registration_status === 'PENDING' ? 'pending' : 'inactive',
      membership_number: m.registration_status === 'APPROVED' ? `UMKM-${m.id.substring(0, 8).toUpperCase()}` : null,
      membership_expires_at: null,
    })));
    setLoading(false);
  };

  const handleVerify = async (merchantId: string, approved: boolean) => {
    setApproving(true);
    try {
      await supabase.from('merchants').update({
        registration_status: approved ? 'APPROVED' : 'REJECTED',
        status: approved ? 'ACTIVE' : 'INACTIVE',
      }).eq('id', merchantId);
      toast.success(approved ? 'Anggota UMKM diverifikasi' : 'Anggota UMKM ditolak');
      fetchMerchants();
    } catch (err) {
      toast.error('Gagal memperbarui status');
    } finally {
      setApproving(false);
    }
  };

  const showCert = (m: MerchantMember) => {
    setSelectedMerchant(m);
    setCertDialog(true);
  };

  const downloadCert = () => {
    if (!selectedMerchant) return;
    const certData = `SERTIFIKAT ANGGOTA UMKM DESA\n\nNomor: ${selectedMerchant.membership_number}\nNama Usaha: ${selectedMerchant.name}\nKategori: ${selectedMerchant.business_category || '-'}\nAlamat: ${selectedMerchant.address || '-'}\nStatus: Terverifikasi\nTanggal: ${format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([certData], { type: 'text/plain' }));
    a.download = `sertifikat-${selectedMerchant.membership_number}.txt`;
    a.click();
    toast.success('Sertifikat diunduh');
  };

  const filtered = merchants.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || (m.phone || '').includes(search);
    if (!matchSearch) return false;
    if (filterStatus === 'all') return true;
    return m.registration_status === filterStatus;
  });

  const counts = {
    total: merchants.length,
    approved: merchants.filter(m => m.registration_status === 'APPROVED').length,
    pending: merchants.filter(m => m.registration_status === 'PENDING').length,
  };

  return (
    <DesaLayout title="Keanggotaan UMKM" subtitle="Daftar, verifikasi, dan sertifikat digital UMKM desa">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total UMKM', value: counts.total, color: 'text-foreground' },
            { label: 'Terverifikasi', value: counts.approved, color: 'text-emerald-600' },
            { label: 'Menunggu', value: counts.pending, color: 'text-yellow-600' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama atau nomor HP..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="APPROVED">Terverifikasi</SelectItem>
              <SelectItem value="PENDING">Menunggu</SelectItem>
              <SelectItem value="REJECTED">Ditolak</SelectItem>
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
                    <TableHead>Nama Usaha</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>No. Anggota</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bergabung</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Tidak ada data UMKM
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(m => {
                      const statusCfg = STATUS_MAP[m.registration_status] || STATUS_MAP.PENDING;
                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{m.name}</p>
                              {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{m.business_category || '-'}</TableCell>
                          <TableCell className="text-sm font-mono text-xs">
                            {m.membership_number || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(m.created_at), 'dd MMM yyyy', { locale: idLocale })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              {m.registration_status === 'PENDING' && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleVerify(m.id, true)} disabled={approving}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Verifikasi
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleVerify(m.id, false)} disabled={approving}>
                                    <XCircle className="h-3.5 w-3.5 mr-1" />Tolak
                                  </Button>
                                </>
                              )}
                              {m.registration_status === 'APPROVED' && (
                                <Button size="sm" variant="outline" className="h-7" onClick={() => showCert(m)}>
                                  <Award className="h-3.5 w-3.5 mr-1" />Sertifikat
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Certificate Dialog */}
      <Dialog open={certDialog} onOpenChange={setCertDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sertifikat Digital UMKM</DialogTitle>
          </DialogHeader>
          {selectedMerchant && (
            <div className="border-2 border-emerald-500 rounded-xl p-6 text-center space-y-3 bg-gradient-to-br from-emerald-50 to-white">
              <div className="flex items-center justify-center">
                <Award className="h-12 w-12 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Sertifikat Anggota UMKM Desa</p>
                <h3 className="text-xl font-bold mt-1">{selectedMerchant.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedMerchant.business_category || 'UMKM'}</p>
              </div>
              <div className="bg-emerald-100 rounded-lg py-2 px-4">
                <p className="text-xs text-emerald-600">Nomor Anggota</p>
                <p className="font-mono font-bold text-emerald-800">{selectedMerchant.membership_number}</p>
              </div>
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                <QrCode className="h-8 w-8 text-gray-400" />
                <span>QR Code verifikasi</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Terverifikasi {format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialog(false)}>Tutup</Button>
            <Button onClick={downloadCert} className="gap-1.5">
              <Download className="h-4 w-4" />Unduh Sertifikat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
