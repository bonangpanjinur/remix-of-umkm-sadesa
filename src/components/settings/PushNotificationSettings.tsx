import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getSubscriptionStatus,
} from '@/lib/pushNotification';
import { toast } from 'sonner';

export function PushNotificationSettings() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    checkStatus();
  }, [user]);

  const checkStatus = async () => {
    const isSupported = await isPushSupported();
    setSupported(isSupported);

    if (isSupported) {
      const perm = await getPushPermission();
      setPermission(perm);

      if (user && perm === 'granted') {
        const isSub = await getSubscriptionStatus(user.id);
        setSubscribed(isSub);
      }
    }

    setLoading(false);
  };

  const handleToggle = async (enabled: boolean) => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    setToggling(true);

    try {
      if (enabled) {
        const success = await subscribeToPush(user.id);
        if (success) {
          setSubscribed(true);
          setPermission('granted');
          toast.success('Notifikasi push diaktifkan');
        } else {
          toast.error('Gagal mengaktifkan notifikasi');
        }
      } else {
        const success = await unsubscribeFromPush(user.id);
        if (success) {
          setSubscribed(false);
          toast.success('Notifikasi push dinonaktifkan');
        }
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Memeriksa status...</span>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BellOff className="h-4 w-4" />
          <span className="text-sm">Browser tidak mendukung notifikasi push</span>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="p-4 bg-destructive/10 rounded-lg">
        <div className="flex items-center gap-2 text-destructive">
          <BellOff className="h-4 w-4" />
          <span className="text-sm">Notifikasi diblokir di browser Anda</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Untuk mengaktifkan, buka pengaturan browser dan izinkan notifikasi untuk situs ini.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${subscribed ? 'bg-primary/10' : 'bg-muted'}`}>
            <Bell className={`h-4 w-4 ${subscribed ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <Label htmlFor="push-toggle" className="font-medium cursor-pointer">
              Notifikasi Push
            </Label>
            <p className="text-xs text-muted-foreground">
              Terima notifikasi pesanan dan update penting
            </p>
          </div>
        </div>
        <Switch
          id="push-toggle"
          checked={subscribed}
          onCheckedChange={handleToggle}
          disabled={toggling}
        />
      </div>

      {subscribed && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            Notifikasi aktif
          </p>
        </div>
      )}
    </div>
  );
}
