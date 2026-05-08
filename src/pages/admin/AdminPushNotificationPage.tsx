/**
 * P2-05: Admin Push Notification Settings
 * Konfigurasi VAPID keys, test kirim push, broadcast ke semua user.
 */
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bell, Save, Send, TestTube, CheckCircle, AlertCircle,
  Loader2, Key, Users, Info, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PushSettings {
  enabled: boolean;
  vapid_public_key: string;
  vapid_private_key: string;
  vapid_email: string;
}

const DEFAULT_SETTINGS: PushSettings = {
  enabled: false,
  vapid_public_key: '',
  vapid_private_key: '',
  vapid_email: 'mailto:admin@desamart.id',
};

export default function AdminPushNotificationPage() {
  const [settings, setSettings] = useState<PushSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Test push state
  const [testUserId, setTestUserId] = useState('');
  const [testTitle, setTestTitle] = useState('Test Push Notification');
  const [testBody, setTestBody] = useState('Halo! Ini adalah test push notification dari DesaMart.');
  const [testing, setTesting] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('/');
  const [broadcasting, setBroadcasting] = useState(false);

  // Subscriber count
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchSubscriberCount();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('app_settings' as any)
        .select('value')
        .eq('key', 'push_notification_settings')
        .maybeSingle();

      if (data?.value) {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.value as any) });
      }
    } catch (err) {
      console.error('Error fetching push settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriberCount = async () => {
    try {
      const { count } = await supabase
        .from('push_subscriptions' as any)
        .select('*', { count: 'exact', head: true });
      setSubscriberCount(count ?? 0);
    } catch {
      setSubscriberCount(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings' as any)
        .upsert(
          {
            key: 'push_notification_settings',
            value: settings as any,
            category: 'notification',
            description: 'Konfigurasi VAPID keys untuk Web Push Notification',
          },
          { onConflict: 'key' }
        );

      if (error) throw error;

      // Also update server env via API
      await fetch('/api/push/update-vapid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_key: settings.vapid_public_key,
          private_key: settings.vapid_private_key,
          email: settings.vapid_email,
        }),
      }).catch(() => {});

      toast.success('Pengaturan push notification berhasil disimpan');
    } catch (err) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateKeys = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/push/generate-vapid');
      if (!res.ok) throw new Error('Gagal generate keys');
      const { publicKey, privateKey } = await res.json();
      setSettings(prev => ({
        ...prev,
        vapid_public_key: publicKey,
        vapid_private_key: privateKey,
      }));
      toast.success('VAPID keys berhasil di-generate! Jangan lupa simpan.');
    } catch (err) {
      toast.error('Gagal generate VAPID keys');
    } finally {
      setGenerating(false);
    }
  };

  const handleTestPush = async () => {
    if (!testUserId.trim()) {
      toast.error('User ID wajib diisi');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: testUserId,
          title: testTitle,
          body: testBody,
          url: '/',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengirim');
      toast.success(`Push dikirim ke ${json.sent}/${json.total} subscription`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim test push');
    } finally {
      setTesting(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      toast.error('Judul dan pesan wajib diisi');
      return;
    }
    setBroadcasting(true);
    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          body: broadcastBody,
          url: broadcastUrl || '/',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal broadcast');
      toast.success(`Broadcast terkirim ke ${json.sent}/${json.total} user`);
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal broadcast');
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Push Notification" subtitle="Konfigurasi web push notification">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Push Notification" subtitle="Konfigurasi web push notification ke pengguna">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Subscriber</p>
                <p className="text-xl font-bold">
                  {subscriberCount !== null ? subscriberCount.toLocaleString('id-ID') : '—'}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={fetchSubscriberCount}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.enabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                <Bell className={`h-5 w-5 ${settings.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status Push</p>
                <Badge variant={settings.enabled && settings.vapid_public_key ? 'default' : 'secondary'}>
                  {settings.enabled && settings.vapid_public_key ? 'Aktif' : 'Belum dikonfigurasi'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="config">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">
              <Key className="h-4 w-4 mr-1.5" />
              Konfigurasi
            </TabsTrigger>
            <TabsTrigger value="test">
              <TestTube className="h-4 w-4 mr-1.5" />
              Test Kirim
            </TabsTrigger>
            <TabsTrigger value="broadcast">
              <Users className="h-4 w-4 mr-1.5" />
              Broadcast
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Konfigurasi ── */}
          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  VAPID Keys
                </CardTitle>
                <CardDescription>
                  VAPID keys digunakan untuk mengotentikasi server push notification ke browser.
                  Generate sekali dan simpan — jangan ubah setelah ada subscriber aktif.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Jika belum punya VAPID keys, klik tombol "Generate Keys" di bawah.
                    Setelah disimpan, pengguna perlu subscribe ulang jika keys diubah.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="vapid-email">Email VAPID (Contact)</Label>
                    <Input
                      id="vapid-email"
                      value={settings.vapid_email}
                      onChange={e => setSettings(prev => ({ ...prev, vapid_email: e.target.value }))}
                      placeholder="mailto:admin@desamart.id"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vapid-public">VAPID Public Key</Label>
                    <Input
                      id="vapid-public"
                      value={settings.vapid_public_key}
                      onChange={e => setSettings(prev => ({ ...prev, vapid_public_key: e.target.value }))}
                      placeholder="BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vapid-private">VAPID Private Key</Label>
                    <div className="relative mt-1">
                      <Input
                        id="vapid-private"
                        type={showPrivateKey ? 'text' : 'password'}
                        value={settings.vapid_private_key}
                        onChange={e => setSettings(prev => ({ ...prev, vapid_private_key: e.target.value }))}
                        placeholder="Private key (rahasia, jangan disebarkan)"
                        className="font-mono text-xs pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPrivateKey(v => !v)}
                      >
                        {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Private key disimpan terenkripsi di database. Jangan bagikan ke siapapun.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateKeys}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Generate Keys Baru
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Simpan Pengaturan
                  </Button>
                </div>

                {settings.vapid_public_key && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium mb-1">Public Key untuk Frontend (VITE_VAPID_PUBLIC_KEY):</p>
                    <code className="text-xs break-all text-muted-foreground">{settings.vapid_public_key}</code>
                    <p className="text-xs text-muted-foreground mt-2">
                      Salin nilai ini ke environment variable <code>VITE_VAPID_PUBLIC_KEY</code> di Replit Secrets.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Test Kirim ── */}
          <TabsContent value="test">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Test Push ke User
                </CardTitle>
                <CardDescription>
                  Kirim push notification ke satu user berdasarkan User ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="test-user-id">User ID</Label>
                  <Input
                    id="test-user-id"
                    value={testUserId}
                    onChange={e => setTestUserId(e.target.value)}
                    placeholder="UUID user (dari tabel profiles)"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="test-title">Judul Notifikasi</Label>
                  <Input
                    id="test-title"
                    value={testTitle}
                    onChange={e => setTestTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="test-body">Isi Notifikasi</Label>
                  <Textarea
                    id="test-body"
                    value={testBody}
                    onChange={e => setTestBody(e.target.value)}
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleTestPush} disabled={testing || !settings.vapid_public_key}>
                  {testing
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim...</>
                    : <><Send className="h-4 w-4 mr-2" />Kirim Test Push</>
                  }
                </Button>
                {!settings.vapid_public_key && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    VAPID keys belum dikonfigurasi. Setup di tab Konfigurasi dulu.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab Broadcast ── */}
          <TabsContent value="broadcast">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Broadcast ke Semua Subscriber
                </CardTitle>
                <CardDescription>
                  Kirim push notification ke semua pengguna yang sudah subscribe.
                  {subscriberCount !== null && (
                    <span className="font-medium text-foreground"> ({subscriberCount} subscriber aktif)</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bc-title">Judul Broadcast</Label>
                  <Input
                    id="bc-title"
                    value={broadcastTitle}
                    onChange={e => setBroadcastTitle(e.target.value)}
                    placeholder="Promo Hari Ini! 🎉"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bc-body">Isi Pesan</Label>
                  <Textarea
                    id="bc-body"
                    value={broadcastBody}
                    onChange={e => setBroadcastBody(e.target.value)}
                    placeholder="Dapatkan diskon 30% untuk semua produk UMKM hari ini saja!"
                    rows={4}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bc-url">URL Tujuan (opsional)</Label>
                  <Input
                    id="bc-url"
                    value={broadcastUrl}
                    onChange={e => setBroadcastUrl(e.target.value)}
                    placeholder="/products"
                    className="mt-1"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Broadcast akan dikirim ke <strong>semua subscriber aktif</strong>.
                    Pastikan konten sudah benar sebelum mengirim.
                  </p>
                </div>

                <Button
                  onClick={handleBroadcast}
                  disabled={broadcasting || !settings.vapid_public_key}
                  className="w-full"
                >
                  {broadcasting
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim Broadcast...</>
                    : <><Send className="h-4 w-4 mr-2" />Kirim Broadcast</>
                  }
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
