import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Moon, Globe, Shield } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
                  <Moon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Tampilan</CardTitle>
                </div>
                <CardDescription>
                  Sesuaikan tema dan tampilan aplikasi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mode Gelap</span>
                  <span className="text-sm text-muted-foreground">
                    Otomatis (ikuti sistem)
                  </span>
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
                  <span className="text-sm text-muted-foreground">
                    Bahasa Indonesia
                  </span>
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
                <Button variant="outline" className="w-full justify-start" disabled>
                  Kebijakan Privasi
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  Syarat & Ketentuan
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
