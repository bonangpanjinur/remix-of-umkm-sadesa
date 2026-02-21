import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Moon, Sun, Globe, Shield, Lock, Trash2, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password berhasil diubah');
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Gagal mengubah password');
    } finally {
      setChangingPassword(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className="mobile-shell bg-background flex flex-col min-h-screen">
      <Header />
      
      <div className="flex-1 overflow-y-auto pb-24">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 py-4"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Pengaturan</h1>
              <p className="text-sm text-muted-foreground">Kelola preferensi aplikasi</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Push Notifications */}
            {user && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Notifikasi Push</CardTitle>
                  </div>
                  <CardDescription>
                    Terima notifikasi untuk pesanan, promo, dan update penting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PushNotificationSettings />
                </CardContent>
              </Card>
            )}

            {/* Theme */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {isDark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                  <CardTitle className="text-base">Tampilan</CardTitle>
                </div>
                <CardDescription>
                  Sesuaikan tema dan tampilan aplikasi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mode Gelap</span>
                  <Switch
                    checked={isDark}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Language */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Bahasa</CardTitle>
                </div>
                <CardDescription>
                  Pilih bahasa tampilan aplikasi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bahasa Aktif</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Bahasa Indonesia</span>
                    <Badge variant="secondary" className="text-[10px]">Segera hadir</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Privacy */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Privasi & Keamanan</CardTitle>
                </div>
                <CardDescription>
                  Kelola data dan keamanan akun Anda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Change Password */}
                {user && (
                  <>
                    {!showPasswordForm ? (
                      <Button variant="outline" className="w-full justify-start" onClick={() => setShowPasswordForm(true)}>
                        <Lock className="h-4 w-4 mr-2" />
                        Ubah Password
                      </Button>
                    ) : (
                      <div className="space-y-3 p-3 border border-border rounded-lg">
                        <div className="space-y-1.5">
                          <Label htmlFor="new-password" className="text-xs">Password Baru</Label>
                          <Input
                            id="new-password"
                            type="password"
                            placeholder="Minimal 6 karakter"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="confirm-password" className="text-xs">Konfirmasi Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Ulangi password baru"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleChangePassword} disabled={changingPassword}>
                            {changingPassword && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Simpan
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}>
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled>
                  Kebijakan Privasi
                  <Badge variant="secondary" className="ml-auto text-[10px]">Segera hadir</Badge>
                </Button>
                <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled>
                  Syarat & Ketentuan
                  <Badge variant="secondary" className="ml-auto text-[10px]">Segera hadir</Badge>
                </Button>
              </CardContent>
            </Card>
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
