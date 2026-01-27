import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, Settings, HelpCircle, LogIn, LogOut, Store, ChevronRight, Edit, Heart, 
  Bell, LayoutDashboard, Shield, CheckCircle, Bike, Building2 
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ProfileEditor } from '@/components/account/ProfileEditor';

interface Profile {
  full_name: string;
  phone: string | null;
  address: string | null;
  province_id?: string | null;
  province_name?: string | null;
  city_id?: string | null;
  city_name?: string | null;
  district_id?: string | null;
  district_name?: string | null;
  village_id?: string | null;
  village_name?: string | null;
  address_detail?: string | null;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading, roles, isAdmin, isVerifikator, isMerchant, isCourier, isAdminDesa } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

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
        .select('full_name, phone, address, province_id, province_name, city_id, city_name, district_id, district_name, village_id, village_name, address_detail')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = (data: { full_name: string; phone: string | null; address: string | null }) => {
    setProfile(data);
    setEditing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    toast({ title: 'Berhasil keluar' });
  };

  // Get dashboard buttons based on user roles
  const getDashboardButtons = () => {
    const buttons: { label: string; path: string; icon: React.ReactNode; color: string }[] = [];

    if (isAdmin) {
      buttons.push({
        label: 'Dashboard Admin',
        path: '/admin',
        icon: <Shield className="h-5 w-5" />,
        color: 'bg-red-500/10 text-red-600 border-red-200',
      });
    }

    if (isAdminDesa) {
      buttons.push({
        label: 'Dashboard Desa',
        path: '/desa',
        icon: <Building2 className="h-5 w-5" />,
        color: 'bg-green-500/10 text-green-600 border-green-200',
      });
    }

    if (isVerifikator) {
      buttons.push({
        label: 'Dashboard Verifikator',
        path: '/verifikator',
        icon: <CheckCircle className="h-5 w-5" />,
        color: 'bg-blue-500/10 text-blue-600 border-blue-200',
      });
    }

    if (isMerchant) {
      buttons.push({
        label: 'Dashboard Merchant',
        path: '/merchant',
        icon: <Store className="h-5 w-5" />,
        color: 'bg-orange-500/10 text-orange-600 border-orange-200',
      });
    }

    if (isCourier) {
      buttons.push({
        label: 'Dashboard Kurir',
        path: '/courier',
        icon: <Bike className="h-5 w-5" />,
        color: 'bg-purple-500/10 text-purple-600 border-purple-200',
      });
    }

    return buttons;
  };

  const dashboardButtons = getDashboardButtons();

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
                  <ProfileEditor
                    userId={user.id}
                    initialData={{
                      full_name: profile?.full_name || '',
                      phone: profile?.phone || null,
                      address: profile?.address || null,
                      province_id: profile?.province_id,
                      province_name: profile?.province_name,
                      city_id: profile?.city_id,
                      city_name: profile?.city_name,
                      district_id: profile?.district_id,
                      district_name: profile?.district_name,
                      village_id: profile?.village_id,
                      village_name: profile?.village_name,
                      address_detail: profile?.address_detail,
                    }}
                    onSave={handleProfileSave}
                    onCancel={() => setEditing(false)}
                  />
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

              {/* Dashboard Buttons */}
              {dashboardButtons.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard Anda
                  </h3>
                  <div className="grid gap-2">
                    {dashboardButtons.map((btn) => (
                      <button
                        key={btn.path}
                        onClick={() => navigate(btn.path)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition hover:shadow-md ${btn.color}`}
                      >
                        <div className="flex items-center gap-3">
                          {btn.icon}
                          <span className="font-medium">{btn.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
              onClick={() => navigate('/wishlist')}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
            >
              <div className="flex items-center gap-3">
                <Heart className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Wishlist</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button 
              onClick={() => navigate('/notifications')}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-secondary transition"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Notifikasi</span>
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
