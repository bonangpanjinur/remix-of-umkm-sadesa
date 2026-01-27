import { useState, useEffect } from 'react';
import { Save, ToggleLeft, ToggleRight, Globe, CreditCard, AlertCircle } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchAppSettings, updateAppSetting } from '@/lib/adminApi';
import type { AppSetting, RegistrationSettings, PaymentSettings, AddressApiSettings } from '@/types/admin';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await fetchAppSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSetting = (key: string): AppSetting | undefined => {
    return settings.find(s => s.key === key);
  };

  const handleToggleRegistration = async (key: string, currentValue: boolean) => {
    setSaving(key);
    const success = await updateAppSetting(key, { enabled: !currentValue });
    if (success) {
      toast.success('Pengaturan berhasil disimpan');
      loadSettings();
    } else {
      toast.error('Gagal menyimpan pengaturan');
    }
    setSaving(null);
  };

  const handleSavePayment = async (key: string, values: PaymentSettings) => {
    setSaving(key);
    const success = await updateAppSetting(key, values as unknown as Record<string, unknown>);
    if (success) {
      toast.success('Pengaturan payment gateway berhasil disimpan');
      loadSettings();
    } else {
      toast.error('Gagal menyimpan pengaturan');
    }
    setSaving(null);
  };

  const handleSaveAddressApi = async (values: AddressApiSettings) => {
    setSaving('address_api');
    const success = await updateAppSetting('address_api', values as unknown as Record<string, unknown>);
    if (success) {
      toast.success('Pengaturan API alamat berhasil disimpan');
      loadSettings();
    } else {
      toast.error('Gagal menyimpan pengaturan');
    }
    setSaving(null);
  };

  const registrationVillage = getSetting('registration_village')?.value as unknown as RegistrationSettings | undefined;
  const registrationMerchant = getSetting('registration_merchant')?.value as unknown as RegistrationSettings | undefined;
  const registrationCourier = getSetting('registration_courier')?.value as unknown as RegistrationSettings | undefined;
  const addressApi = getSetting('address_api')?.value as unknown as AddressApiSettings | undefined;
  const paymentMidtrans = getSetting('payment_midtrans')?.value as unknown as PaymentSettings | undefined;
  const paymentXendit = getSetting('payment_xendit')?.value as unknown as PaymentSettings | undefined;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Pengaturan</h1>
            <p className="text-muted-foreground text-sm">Konfigurasi fitur dan integrasi aplikasi</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Registration Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ToggleLeft className="h-5 w-5" />
                    Pengaturan Registrasi
                  </CardTitle>
                  <CardDescription>
                    Aktifkan atau nonaktifkan fitur pendaftaran untuk berbagai entitas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Registrasi Desa Wisata</p>
                      <p className="text-xs text-muted-foreground">Izinkan pendaftaran desa wisata baru</p>
                    </div>
                    <Switch
                      checked={registrationVillage?.enabled ?? true}
                      onCheckedChange={() => handleToggleRegistration('registration_village', registrationVillage?.enabled ?? true)}
                      disabled={saving === 'registration_village'}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Registrasi Pedagang/UMKM</p>
                      <p className="text-xs text-muted-foreground">Izinkan pendaftaran merchant baru</p>
                    </div>
                    <Switch
                      checked={registrationMerchant?.enabled ?? true}
                      onCheckedChange={() => handleToggleRegistration('registration_merchant', registrationMerchant?.enabled ?? true)}
                      disabled={saving === 'registration_merchant'}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Registrasi Kurir/Ojek</p>
                      <p className="text-xs text-muted-foreground">Izinkan pendaftaran kurir atau ojek desa</p>
                    </div>
                    <Switch
                      checked={registrationCourier?.enabled ?? true}
                      onCheckedChange={() => handleToggleRegistration('registration_courier', registrationCourier?.enabled ?? true)}
                      disabled={saving === 'registration_courier'}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Address API Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    API Alamat Wilayah
                  </CardTitle>
                  <CardDescription>
                    Konfigurasi API untuk data provinsi, kota, kecamatan, dan kelurahan
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AddressApiForm
                    initialValues={addressApi}
                    onSave={handleSaveAddressApi}
                    isSaving={saving === 'address_api'}
                  />
                </CardContent>
              </Card>

              {/* Payment Gateway Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Gateway
                  </CardTitle>
                  <CardDescription>
                    Konfigurasi gateway pembayaran untuk transaksi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Midtrans */}
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium">Midtrans</h3>
                        <p className="text-xs text-muted-foreground">Payment gateway populer di Indonesia</p>
                      </div>
                      <Switch
                        checked={paymentMidtrans?.enabled ?? false}
                        onCheckedChange={(checked) => handleSavePayment('payment_midtrans', { ...paymentMidtrans, enabled: checked } as PaymentSettings)}
                        disabled={saving === 'payment_midtrans'}
                      />
                    </div>
                    {paymentMidtrans?.enabled && (
                      <PaymentMidtransForm
                        initialValues={paymentMidtrans}
                        onSave={(values) => handleSavePayment('payment_midtrans', values)}
                        isSaving={saving === 'payment_midtrans'}
                      />
                    )}
                  </div>

                  {/* Xendit */}
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium">Xendit</h3>
                        <p className="text-xs text-muted-foreground">Support QRIS dan Virtual Account</p>
                      </div>
                      <Switch
                        checked={paymentXendit?.enabled ?? false}
                        onCheckedChange={(checked) => handleSavePayment('payment_xendit', { ...paymentXendit, enabled: checked } as PaymentSettings)}
                        disabled={saving === 'payment_xendit'}
                      />
                    </div>
                    {paymentXendit?.enabled && (
                      <PaymentXenditForm
                        initialValues={paymentXendit}
                        onSave={(values) => handleSavePayment('payment_xendit', values)}
                        isSaving={saving === 'payment_xendit'}
                      />
                    )}
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      API key yang disimpan di sini akan dienkripsi. Pastikan menggunakan key dari mode sandbox untuk testing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Address API Form Component
function AddressApiForm({ 
  initialValues, 
  onSave, 
  isSaving 
}: { 
  initialValues?: AddressApiSettings; 
  onSave: (values: AddressApiSettings) => Promise<void>;
  isSaving: boolean;
}) {
  const [provider, setProvider] = useState(initialValues?.provider || 'emsifa');
  const [baseUrl, setBaseUrl] = useState(initialValues?.base_url || 'https://emsifa.github.io/api-wilayah-indonesia/api');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ provider, base_url: baseUrl });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Input
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="emsifa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
      <Button type="submit" disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}

// Midtrans Form Component
function PaymentMidtransForm({ 
  initialValues, 
  onSave, 
  isSaving 
}: { 
  initialValues?: PaymentSettings; 
  onSave: (values: PaymentSettings) => Promise<void>;
  isSaving: boolean;
}) {
  const [serverKey, setServerKey] = useState(initialValues?.server_key || '');
  const [clientKey, setClientKey] = useState(initialValues?.client_key || '');
  const [isProduction, setIsProduction] = useState(initialValues?.is_production || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      enabled: true, 
      server_key: serverKey, 
      client_key: clientKey, 
      is_production: isProduction 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="midtrans-server">Server Key</Label>
          <Input
            id="midtrans-server"
            type="password"
            value={serverKey}
            onChange={(e) => setServerKey(e.target.value)}
            placeholder="SB-Mid-server-..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="midtrans-client">Client Key</Label>
          <Input
            id="midtrans-client"
            value={clientKey}
            onChange={(e) => setClientKey(e.target.value)}
            placeholder="SB-Mid-client-..."
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="midtrans-production"
          checked={isProduction}
          onCheckedChange={setIsProduction}
        />
        <Label htmlFor="midtrans-production" className="text-sm">Mode Production</Label>
      </div>
      <Button type="submit" disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}

// Xendit Form Component
function PaymentXenditForm({ 
  initialValues, 
  onSave, 
  isSaving 
}: { 
  initialValues?: PaymentSettings; 
  onSave: (values: PaymentSettings) => Promise<void>;
  isSaving: boolean;
}) {
  const [secretKey, setSecretKey] = useState(initialValues?.secret_key || '');
  const [publicKey, setPublicKey] = useState(initialValues?.public_key || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      enabled: true, 
      secret_key: secretKey, 
      public_key: publicKey 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="xendit-secret">Secret Key</Label>
          <Input
            id="xendit-secret"
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="xnd_development_..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="xendit-public">Public Key</Label>
          <Input
            id="xendit-public"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="xnd_public_development_..."
          />
        </div>
      </div>
      <Button type="submit" disabled={isSaving}>
        <Save className="h-4 w-4 mr-2" />
        {isSaving ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
