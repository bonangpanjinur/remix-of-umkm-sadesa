import { motion } from 'framer-motion';
import { 
  Download, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Zap, 
  Bell, 
  Shield, 
  Check,
  Share,
  Plus,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePWA } from '@/hooks/usePWA';

export default function InstallPage() {
  const navigate = useNavigate();
  const { canInstall, isInstalled, isOnline, isUpdateAvailable, installApp, updateApp } = usePWA();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      // Show success feedback
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'Akses Cepat',
      description: 'Buka langsung dari homescreen tanpa browser',
    },
    {
      icon: WifiOff,
      title: 'Mode Offline',
      description: 'Tetap bisa browsing meski tanpa koneksi internet',
    },
    {
      icon: Bell,
      title: 'Notifikasi',
      description: 'Terima update pesanan dan promo secara real-time',
    },
    {
      icon: Shield,
      title: 'Aman & Privat',
      description: 'Data tersimpan aman di perangkat Anda',
    },
  ];

  return (
    <div className="mobile-shell bg-background min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-foreground">Install Aplikasi</h1>
            <p className="text-xs text-muted-foreground">Pasang DesaMart di perangkat Anda</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
                  <Smartphone className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">DesaMart</h2>
                  <p className="text-primary-foreground/80 text-sm">Marketplace UMKM & Desa Wisata</p>
                  <div className="flex items-center gap-2 mt-2">
                    {isOnline ? (
                      <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs">
                        <Wifi className="h-3 w-3 mr-1" />
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-destructive/20 text-destructive-foreground text-xs">
                        <WifiOff className="h-3 w-3 mr-1" />
                        Offline
                      </Badge>
                    )}
                    {isInstalled && (
                      <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Terinstall
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-4">
              {isInstalled ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Aplikasi Sudah Terinstall!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Anda sudah bisa menggunakan DesaMart dari homescreen
                  </p>
                  {isUpdateAvailable && (
                    <Button onClick={updateApp} className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Tersedia
                    </Button>
                  )}
                </div>
              ) : canInstall ? (
                <div className="space-y-3">
                  <Button onClick={handleInstall} className="w-full" size="lg">
                    <Download className="h-5 w-5 mr-2" />
                    Install Sekarang
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Gratis • Tidak perlu app store • Cepat & ringan
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {isIOS && (
                    <div className="bg-secondary/50 rounded-xl p-4">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Cara Install di iPhone/iPad
                      </h4>
                      <ol className="space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">1</span>
                          <span>Ketuk tombol <Share className="h-4 w-4 inline mx-1" /> Share di browser Safari</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">2</span>
                          <span>Scroll ke bawah, pilih <Plus className="h-4 w-4 inline mx-1" /> "Add to Home Screen"</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">3</span>
                          <span>Ketuk "Add" di pojok kanan atas</span>
                        </li>
                      </ol>
                    </div>
                  )}
                  {isAndroid && (
                    <div className="bg-secondary/50 rounded-xl p-4">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Cara Install di Android
                      </h4>
                      <ol className="space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">1</span>
                          <span>Ketuk menu ⋮ di pojok kanan atas browser</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">2</span>
                          <span>Pilih "Install app" atau "Add to Home Screen"</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">3</span>
                          <span>Konfirmasi dengan ketuk "Install"</span>
                        </li>
                      </ol>
                    </div>
                  )}
                  {!isIOS && !isAndroid && (
                    <div className="bg-secondary/50 rounded-xl p-4">
                      <h4 className="font-semibold text-foreground mb-3">Cara Install di Desktop</h4>
                      <p className="text-sm text-muted-foreground">
                        Klik ikon install di address bar browser atau gunakan menu browser → "Install DesaMart"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-semibold text-foreground mb-3">Keuntungan Install Aplikasi</h3>
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-medium text-foreground text-sm mb-1">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pertanyaan Umum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground text-sm">Apakah aplikasi ini gratis?</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Ya, 100% gratis! Tidak perlu download dari Play Store atau App Store.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">Berapa ukuran aplikasinya?</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Sangat ringan, kurang dari 5MB. Tidak memakan banyak ruang penyimpanan.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">Bagaimana cara menghapusnya?</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Sama seperti aplikasi biasa, tekan lama ikon dan pilih "Uninstall" atau "Hapus".
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
