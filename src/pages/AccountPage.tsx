import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Settings, HelpCircle, LogIn, LogOut, Store, ChevronRight, Edit, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Profile {
  full_name: string;
  phone: string | null;
  address: string | null;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (!authLoading && user) {
      fetchProfile();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, address')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          address: data.address || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          address: formData.address || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({
        full_name: formData.full_name,
        phone: formData.phone || null,
        address: formData.address || null,
      });
      setEditing(false);
      toast({ title: 'Profil berhasil diperbarui' });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Gagal memperbarui profil',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    toast({ title: 'Berhasil keluar' });
  };

  if (authLoading || loading) {
    return (
      <div className="mobile-shell bg-background flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 py-4"
        >
          {user ? (
            <>
              {/* Profile Card */}
              <div className="bg-card rounded-2xl p-6 border border-border mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-lg text-foreground">
                      {profile?.full_name || 'Pengguna'}
                    </h2>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  {!editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-2 hover:bg-secondary rounded-lg transition"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nama Lengkap</Label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Nama lengkap"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>No. Telepon</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="08xxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alamat</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Alamat lengkap"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditing(false)}
                        className="flex-1"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleSave}
                        className="flex-1"
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {profile?.phone && (
                      <p className="text-muted-foreground">📱 {profile.phone}</p>
                    )}
                    {profile?.address && (
                      <p className="text-muted-foreground">📍 {profile.address}</p>
                    )}
                    {!profile?.phone && !profile?.address && (
                      <p className="text-muted-foreground italic">
                        Lengkapi profil Anda untuk checkout lebih cepat
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-card rounded-2xl p-6 border border-border text-center mb-6">
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="font-bold text-lg text-foreground mb-1">Masuk ke Akun</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Kelola pesanan dan lihat riwayat belanja
              </p>
              <Button className="w-full shadow-brand" onClick={() => navigate('/auth')}>
                <LogIn className="h-4 w-4 mr-2" />
                Masuk / Daftar
              </Button>
            </div>
          )}
          
          {/* Merchant/Village Registration CTA */}
          <div 
            onClick={() => navigate('/register')}
            className="bg-gradient-to-r from-primary to-brand-dark rounded-2xl p-5 mb-6 text-primary-foreground relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Store className="h-5 w-5" />
                <h3 className="font-bold">Bergabung Bersama Kami</h3>
              </div>
              <p className="text-sm opacity-90 mb-3">
                Daftarkan desa wisata atau usaha UMKM Anda
              </p>
              <Button 
                variant="secondary"
                size="sm"
              >
                Daftar Sekarang
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary-foreground/10 rounded-full" />
          </div>
          
          {/* Menu Items */}
          <div className="space-y-2">
            <button 
              onClick={() => navigate('/orders')}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
            >
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Pesanan Saya</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button 
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Bantuan</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <button 
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
            >
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Pengaturan</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            {user && (
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-destructive/20 hover:bg-destructive/5 transition"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5 text-destructive" />
                  <span className="font-medium text-destructive">Keluar</span>
                </div>
              </button>
            )}
          </div>
          
          <p className="text-center text-xs text-muted-foreground mt-8">
            DesaMart v1.0.0 • Platform UMKM Desa
          </p>
        </motion.div>
      </div>
      
      <BottomNav />
    </div>
  );
}
