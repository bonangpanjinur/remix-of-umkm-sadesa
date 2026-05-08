/**
 * S6-08: Admin WhatsApp Notification Settings
 */
import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageCircle, Save, TestTube, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WASettings {
  enabled: boolean;
  provider: 'fonnte' | 'wablas' | 'custom';
  api_key: string;
  api_url: string;
  sender_number: string;
}

const DEFAULT_SETTINGS: WASettings = {
  enabled: false,
  provider: 'fonnte',
  api_key: '',
  api_url: '',
  sender_number: '',
};

const NOTIFICATION_EVENTS = [
  { event: 'NEW', label: 'Pesanan Baru (ke Merchant)', icon: '🛍️' },
  { event: 'CONFIRMED', label: 'Pesanan Dikonfirmasi (ke Pembeli)', icon: '✅' },
  { event: 'ASSIGNED', label: 'Kurir Ditemukan (ke Pembeli)', icon: '🚴' },
  { event: 'DELIVERED', label: 'Pesanan Tiba (ke Pembeli)', icon: '📦' },
  { event: 'DONE', label: 'Pesanan Selesai (ke Pembeli)', icon: '🙏' },
];

export default function AdminWhatsAppPage() {
  const [settings, setSettings] = useState<WASettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('app_settings' as any)
        .select('value')
        .eq('key', 'whatsapp_settings')
        .maybeSingle();

      if (data && (data as any).value) {
        setSettings({ ...DEFAULT_SETTINGS, ...(data as any).value });
      }
    } catch (err) {
      console.error('Failed to fetch WA settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await supabase
        .from('app_settings' as any)
        .upsert({ key: 'whatsapp_settings', value: settings }, { onConflict: 'key' });

      toast.success('Pengaturan WhatsApp berhasil disimpan');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + (err.message || 'Coba lagi'));
    } finally {
      setSaving(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone) { toast.error('Masukkan nomor HP untuk tes'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/whatsapp/test?phone=${encodeURIComponent(testPhone)}`);
      const data = await res.json();
      if (data.success) {
        setTestResult('success');
        toast.success('Pesan tes berhasil dikirim!');
      } else {
        setTestResult('error');
        toast.error('Gagal mengirim pesan tes: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      setTestResult('error');
      toast.error('Error: ' + (err.message || 'Coba lagi'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="WhatsApp Notification">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="WhatsApp Notification">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-green-600" />
              WhatsApp Notification
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Kirim notifikasi otomatis ke pembeli & merchant via WhatsApp
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Aktifkan</Label>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>
        </div>

        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config">Konfigurasi API</TabsTrigger>
            <TabsTrigger value="events">Event Notifikasi</TabsTrigger>
            <TabsTrigger value="test">Tes Kirim</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Provider WhatsApp</CardTitle>
                <CardDescription>Pilih gateway WhatsApp yang akan digunakan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Provider</Label>
                  <Select
                    value={settings.provider}
                    onValueChange={(v) => setSettings({ ...settings, provider: v as any })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fonnte">Fonnte (fonnte.com)</SelectItem>
                      <SelectItem value="wablas">WAblas (wablas.com)</SelectItem>
                      <SelectItem value="custom">Custom API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>API Key / Token</Label>
                  <Input
                    type="password"
                    placeholder="Masukkan API key dari provider"
                    value={settings.api_key}
                    onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                    className="mt-1"
                  />
                </div>

                {settings.provider === 'custom' && (
                  <div>
                    <Label>API URL</Label>
                    <Input
                      type="url"
                      placeholder="https://api.example.com/send"
                      value={settings.api_url}
                      onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label>Nomor Pengirim (opsional)</Label>
                  <Input
                    placeholder="628123456789"
                    value={settings.sender_number}
                    onChange={(e) => setSettings({ ...settings, sender_number: e.target.value })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Format internasional tanpa tanda +</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>Fonnte:</strong> Daftar di fonnte.com → Token → masukkan di atas</p>
                    <p><strong>WAblas:</strong> Daftar di wablas.com → API Key → masukkan di atas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : <><Save className="h-4 w-4 mr-2" />Simpan Pengaturan</>}
            </Button>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event yang Dikirim</CardTitle>
                <CardDescription>Notifikasi WhatsApp dikirim otomatis saat status pesanan berubah</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {NOTIFICATION_EVENTS.map((ev) => (
                  <div key={ev.event} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{ev.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{ev.label}</p>
                        <p className="text-xs text-muted-foreground">Status: {ev.event}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">Aktif</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2">
                  * Notifikasi hanya dikirim jika nomor HP tersimpan di profil pengguna/merchant
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tes Pengiriman</CardTitle>
                <CardDescription>Kirim pesan tes untuk memverifikasi konfigurasi WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nomor HP Penerima</Label>
                  <Input
                    placeholder="08123456789 atau 628123456789"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {testResult === 'success' && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    Pesan tes berhasil dikirim!
                  </div>
                )}
                {testResult === 'error' && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Gagal mengirim. Periksa API key dan provider.
                  </div>
                )}

                <Button onClick={sendTestMessage} disabled={testing || !settings.enabled} className="w-full">
                  {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mengirim...</> : <><TestTube className="h-4 w-4 mr-2" />Kirim Pesan Tes</>}
                </Button>
                {!settings.enabled && (
                  <p className="text-xs text-muted-foreground text-center">Aktifkan WhatsApp terlebih dahulu untuk mengirim tes</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
