import { useState, useEffect } from 'react';
import { Plus, Users, Wallet, Building2, Edit, Trash2 } from 'lucide-react';
import { VerifikatorLayout } from '@/components/verifikator/VerifikatorLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface TradeGroup {
  id: string;
  name: string;
  description: string | null;
  monthly_fee: number;
  is_active: boolean;
  created_at: string;
  member_count?: number;
  total_collected?: number;
  total_pending?: number;
}

export default function VerifikatorGroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TradeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TradeGroup | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('10000');
  const [saving, setSaving] = useState(false);

  const fetchGroups = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('trade_groups')
        .select('*')
        .eq('verifikator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch member counts and payment stats
      const groupsWithStats = await Promise.all((data || []).map(async (group) => {
        const { count: memberCount } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('status', 'ACTIVE');

        const { data: payments } = await supabase
          .from('kas_payments')
          .select('amount, status')
          .eq('group_id', group.id);

        const collected = (payments || [])
          .filter(p => p.status === 'PAID')
          .reduce((sum, p) => sum + p.amount, 0);
        
        const pending = (payments || [])
          .filter(p => p.status === 'UNPAID')
          .reduce((sum, p) => sum + p.amount, 0);

        return {
          ...group,
          member_count: memberCount || 0,
          total_collected: collected,
          total_pending: pending,
        };
      }));

      setGroups(groupsWithStats);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nama kelompok wajib diisi', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('trade_groups')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            monthly_fee: parseInt(monthlyFee) || 10000,
          })
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast({ title: 'Kelompok berhasil diperbarui' });
      } else {
        const { error } = await supabase
          .from('trade_groups')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            monthly_fee: parseInt(monthlyFee) || 10000,
            verifikator_id: user?.id,
          });

        if (error) throw error;
        toast({ title: 'Kelompok berhasil ditambahkan' });
      }

      setDialogOpen(false);
      resetForm();
      fetchGroups();
    } catch (error: any) {
      toast({ 
        title: 'Gagal menyimpan', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Yakin ingin menghapus kelompok ini?')) return;

    try {
      const { error } = await supabase
        .from('trade_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      toast({ title: 'Kelompok berhasil dihapus' });
      fetchGroups();
    } catch (error: any) {
      toast({ 
        title: 'Gagal menghapus', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setMonthlyFee('10000');
    setEditingGroup(null);
  };

  const openEditDialog = (group: TradeGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setDescription(group.description || '');
    setMonthlyFee(group.monthly_fee.toString());
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <VerifikatorLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </VerifikatorLayout>
    );
  }

  return (
    <VerifikatorLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Kelompok Dagang</h1>
            <p className="text-muted-foreground">Kelola kelompok dagang dan kas bulanan</p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kelompok
          </Button>
        </div>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum Ada Kelompok</h3>
              <p className="text-muted-foreground text-center mb-4">
                Buat kelompok dagang pertama untuk mulai mengelola kas pedagang
              </p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Kelompok
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card key={group.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {group.description || 'Tidak ada deskripsi'}
                      </CardDescription>
                    </div>
                    <Badge variant={group.is_active ? 'default' : 'secondary'}>
                      {group.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{group.member_count} Anggota</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span>{formatPrice(group.monthly_fee)}/bln</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Terkumpul</span>
                      <span className="font-medium text-primary">
                        {formatPrice(group.total_collected || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Belum Bayar</span>
                      <span className="font-medium text-destructive">
                        {formatPrice(group.total_pending || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => navigate(`/verifikator/groups/${group.id}`)}
                    >
                      <Wallet className="h-4 w-4 mr-1" />
                      Kelola Kas
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(group)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(group.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Kelompok' : 'Tambah Kelompok Dagang'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup 
                ? 'Perbarui informasi kelompok dagang' 
                : 'Buat kelompok dagang baru untuk mengelola kas pedagang'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Kelompok *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Kelompok Kuliner Pasar Desa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat tentang kelompok ini"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee">Iuran Bulanan (Rp)</Label>
              <Input
                id="fee"
                type="number"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VerifikatorLayout>
  );
}
