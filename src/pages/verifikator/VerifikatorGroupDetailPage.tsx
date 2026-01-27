import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Check, X, Calendar, Wallet, UserPlus, Trash2 } from 'lucide-react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';

interface TradeGroup {
  id: string;
  name: string;
  description: string | null;
  monthly_fee: number;
}

interface GroupMember {
  id: string;
  merchant_id: string;
  joined_at: string;
  status: string;
  merchant: {
    id: string;
    name: string;
    phone: string | null;
  };
}

interface KasPayment {
  id: string;
  merchant_id: string;
  amount: number;
  payment_month: number;
  payment_year: number;
  payment_date: string | null;
  status: string;
  merchant: {
    name: string;
  };
}

interface AvailableMerchant {
  id: string;
  name: string;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function VerifikatorGroupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [group, setGroup] = useState<TradeGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [payments, setPayments] = useState<KasPayment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableMerchants, setAvailableMerchants] = useState<AvailableMerchant[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const fetchGroup = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (error) {
      console.error('Error fetching group:', error);
      navigate('/verifikator/groups');
    }
  };

  const fetchMembers = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          *,
          merchant:merchants(id, name, phone)
        `)
        .eq('group_id', id)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchPayments = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('kas_payments')
        .select(`
          *,
          merchant:merchants(name)
        `)
        .eq('group_id', id)
        .eq('payment_month', selectedMonth)
        .eq('payment_year', selectedYear)
        .order('status', { ascending: true });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const fetchAvailableMerchants = async () => {
    if (!id) return;
    
    try {
      // Get merchants that are not already in this group
      const { data: existingMembers } = await supabase
        .from('group_members')
        .select('merchant_id')
        .eq('group_id', id);

      const existingIds = (existingMembers || []).map(m => m.merchant_id);

      const { data, error } = await supabase
        .from('merchants')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .eq('registration_status', 'APPROVED');

      if (error) throw error;
      
      const available = (data || []).filter(m => !existingIds.includes(m.id));
      setAvailableMerchants(available);
    } catch (error) {
      console.error('Error fetching available merchants:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchGroup(), fetchMembers()]);
      setLoading(false);
    };
    loadData();
  }, [id]);

  useEffect(() => {
    fetchPayments();
  }, [id, selectedMonth, selectedYear]);

  const handleAddMember = async () => {
    if (!selectedMerchant || !id) return;
    
    setAddingMember(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: id,
          merchant_id: selectedMerchant,
          status: 'ACTIVE',
        });

      if (error) throw error;
      
      toast({ title: 'Anggota berhasil ditambahkan' });
      setAddMemberOpen(false);
      setSelectedMerchant('');
      fetchMembers();
    } catch (error: any) {
      toast({ 
        title: 'Gagal menambahkan anggota', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Yakin ingin menghapus anggota ini?')) return;
    
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      toast({ title: 'Anggota berhasil dihapus' });
      fetchMembers();
    } catch (error: any) {
      toast({ 
        title: 'Gagal menghapus', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleGenerateKas = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase.rpc('generate_monthly_kas', {
        p_group_id: id,
        p_month: selectedMonth,
        p_year: selectedYear,
      });

      if (error) throw error;
      
      toast({ 
        title: 'Tagihan berhasil dibuat',
        description: `${data} tagihan kas telah dibuat untuk bulan ${MONTHS[selectedMonth - 1]} ${selectedYear}`,
      });
      fetchPayments();
    } catch (error: any) {
      toast({ 
        title: 'Gagal membuat tagihan', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('kas_payments')
        .update({
          status: 'PAID',
          payment_date: new Date().toISOString(),
          collected_by: user?.id,
        })
        .eq('id', paymentId);

      if (error) throw error;
      toast({ title: 'Pembayaran berhasil dicatat' });
      fetchPayments();
    } catch (error: any) {
      toast({ 
        title: 'Gagal mencatat pembayaran', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleMarkAsUnpaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('kas_payments')
        .update({
          status: 'UNPAID',
          payment_date: null,
          collected_by: null,
        })
        .eq('id', paymentId);

      if (error) throw error;
      toast({ title: 'Status pembayaran diperbarui' });
      fetchPayments();
    } catch (error: any) {
      toast({ 
        title: 'Gagal memperbarui status', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  if (loading || !group) {
    return (
      <VerifikatorLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </VerifikatorLayout>
    );
  }

  const paidCount = payments.filter(p => p.status === 'PAID').length;
  const unpaidCount = payments.filter(p => p.status === 'UNPAID').length;
  const totalCollected = payments
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <VerifikatorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/verifikator/groups')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="text-muted-foreground">
              {group.description || 'Kelola anggota dan kas bulanan'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{members.length}</p>
                  <p className="text-sm text-muted-foreground">Total Anggota</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{formatPrice(group.monthly_fee)}</p>
                  <p className="text-sm text-muted-foreground">Iuran/Bulan</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Check className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{paidCount}</p>
                  <p className="text-sm text-muted-foreground">Sudah Bayar</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <X className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{unpaidCount}</p>
                  <p className="text-sm text-muted-foreground">Belum Bayar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">
              <Wallet className="h-4 w-4 mr-2" />
              Pembayaran Kas
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-2" />
              Anggota ({members.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle>Pembayaran Kas Bulanan</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(v) => setSelectedMonth(parseInt(v))}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month, i) => (
                          <SelectItem key={i} value={(i + 1).toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(v) => setSelectedYear(parseInt(v))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleGenerateKas}>
                      <Plus className="h-4 w-4 mr-2" />
                      Buat Tagihan
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Belum ada tagihan untuk {MONTHS[selectedMonth - 1]} {selectedYear}</p>
                    <Button variant="outline" className="mt-4" onClick={handleGenerateKas}>
                      Buat Tagihan Sekarang
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-muted rounded-lg flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Total Terkumpul {MONTHS[selectedMonth - 1]} {selectedYear}
                      </span>
                      <span className="font-bold text-primary">{formatPrice(totalCollected)}</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedagang</TableHead>
                          <TableHead>Nominal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tanggal Bayar</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {payment.merchant?.name || '-'}
                            </TableCell>
                            <TableCell>{formatPrice(payment.amount)}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === 'PAID' ? 'default' : 'destructive'}>
                                {payment.status === 'PAID' ? 'Lunas' : 'Belum Bayar'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {payment.payment_date 
                                ? new Date(payment.payment_date).toLocaleDateString('id-ID')
                                : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {payment.status === 'UNPAID' ? (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleMarkAsPaid(payment.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Bayar
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleMarkAsUnpaid(payment.id)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Batalkan
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Daftar Anggota</CardTitle>
                  <Button onClick={() => {
                    fetchAvailableMerchants();
                    setAddMemberOpen(true);
                  }}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Tambah Anggota
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Belum ada anggota di kelompok ini</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Toko</TableHead>
                        <TableHead>No. Telepon</TableHead>
                        <TableHead>Bergabung</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.merchant?.name || '-'}
                          </TableCell>
                          <TableCell>{member.merchant?.phone || '-'}</TableCell>
                          <TableCell>
                            {new Date(member.joined_at).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}>
                              {member.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Anggota</DialogTitle>
            <DialogDescription>
              Pilih pedagang yang akan ditambahkan ke kelompok ini
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {availableMerchants.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Tidak ada pedagang yang tersedia untuk ditambahkan
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Pilih Pedagang</Label>
                <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pedagang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMerchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleAddMember} 
              disabled={!selectedMerchant || addingMember}
            >
              {addingMember ? 'Menambahkan...' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VerifikatorLayout>
  );
}
