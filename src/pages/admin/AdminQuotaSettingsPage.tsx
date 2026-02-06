import { useState, useEffect } from 'react';
import { Settings, Info, Plus, Trash2, Save, Edit2, X } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

interface QuotaTier {
  id: string;
  min_price: number;
  max_price: number | null;
  credit_cost: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export default function AdminQuotaSettingsPage() {
  const [tiers, setTiers] = useState<QuotaTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTier, setEditingTier] = useState<QuotaTier | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    min_price: 0,
    max_price: '',
    credit_cost: 1,
    description: ''
  });

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('quota_tiers')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (error) {
      console.error('Error fetching quota tiers:', error);
      toast.error('Gagal memuat data tier kuota');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      min_price: 0,
      max_price: '',
      credit_cost: 1,
      description: ''
    });
    setEditingTier(null);
  };

  const handleAddTier = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('quota_tiers')
        .insert({
          min_price: formData.min_price,
          max_price: formData.max_price ? parseInt(formData.max_price) : null,
          credit_cost: formData.credit_cost,
          description: formData.description || null,
          sort_order: tiers.length + 1,
          is_active: true
        });

      if (error) throw error;
      
      toast.success('Tier kuota berhasil ditambahkan');
      setShowAddDialog(false);
      resetForm();
      fetchTiers();
    } catch (error) {
      console.error('Error adding tier:', error);
      toast.error('Gagal menambahkan tier kuota');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('quota_tiers')
        .update({
          min_price: formData.min_price,
          max_price: formData.max_price ? parseInt(formData.max_price) : null,
          credit_cost: formData.credit_cost,
          description: formData.description || null
        })
        .eq('id', editingTier.id);

      if (error) throw error;
      
      toast.success('Tier kuota berhasil diperbarui');
      setEditingTier(null);
      resetForm();
      fetchTiers();
    } catch (error) {
      console.error('Error updating tier:', error);
      toast.error('Gagal memperbarui tier kuota');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Yakin ingin menghapus tier ini?')) return;
    
    try {
      const { error } = await supabase
        .from('quota_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Tier kuota berhasil dihapus');
      fetchTiers();
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('Gagal menghapus tier kuota');
    }
  };

  const startEditing = (tier: QuotaTier) => {
    setEditingTier(tier);
    setFormData({
      min_price: tier.min_price,
      max_price: tier.max_price?.toString() || '',
      credit_cost: tier.credit_cost,
      description: tier.description || ''
    });
  };

  const TierForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Harga Minimal (Rp)</Label>
          <Input
            type="number"
            value={formData.min_price}
            onChange={(e) => setFormData(prev => ({ ...prev, min_price: parseInt(e.target.value) || 0 }))}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Harga Maksimal (Rp)</Label>
          <Input
            type="number"
            value={formData.max_price}
            onChange={(e) => setFormData(prev => ({ ...prev, max_price: e.target.value }))}
            placeholder="Kosongkan untuk tak terbatas"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Jumlah Kuota yang Dihabiskan</Label>
        <Input
          type="number"
          min={1}
          value={formData.credit_cost}
          onChange={(e) => setFormData(prev => ({ ...prev, credit_cost: parseInt(e.target.value) || 1 }))}
        />
      </div>
      
      <div className="space-y-2">
        <Label>Deskripsi (Opsional)</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Contoh: Produk harga rendah"
        />
      </div>
    </div>
  );

  return (
    <AdminLayout title="Pengaturan Kuota" subtitle="Biaya kuota transaksi berdasarkan harga produk">
      <div className="space-y-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-foreground">Informasi</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Tier kuota menentukan berapa kuota yang dihabiskan untuk setiap transaksi berdasarkan rentang harga produk.
            Contoh: Jika produk seharga Rp 40.000 masuk dalam tier Rp 0 - Rp 50.000 dengan biaya 1 kuota, maka 1 kuota akan dipotong.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Tier Biaya Kuota</CardTitle>
                  <CardDescription>
                    Biaya kuota yang dipotong berdasarkan rentang harga produk
                  </CardDescription>
                </div>
              </div>
              
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => resetForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Tier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tambah Tier Kuota</DialogTitle>
                  </DialogHeader>
                  <TierForm />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
                    <Button onClick={handleAddTier} disabled={saving}>
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : tiers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Belum ada tier kuota. Klik "Tambah Tier" untuk membuat yang baru.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, index) => (
                  <div 
                    key={tier.id} 
                    className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border"
                  >
                    {editingTier?.id === tier.id ? (
                      <div className="flex-1 mr-4">
                        <TierForm />
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" onClick={handleUpdateTier} disabled={saving}>
                            <Save className="h-4 w-4 mr-1" />
                            {saving ? 'Menyimpan...' : 'Simpan'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { resetForm(); setEditingTier(null); }}>
                            <X className="h-4 w-4 mr-1" />
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium">Tier {index + 1}: {tier.description || 'Tanpa Deskripsi'}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(tier.min_price)} - {tier.max_price ? formatPrice(tier.max_price) : 'Tidak terbatas'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-primary">{tier.credit_cost} Kuota</p>
                            <p className="text-xs text-muted-foreground">per transaksi</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => startEditing(tier)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteTier(tier.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
