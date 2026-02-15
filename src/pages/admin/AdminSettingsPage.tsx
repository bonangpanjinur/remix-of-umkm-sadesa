import { useState, useEffect } from 'react';
import { Save, ToggleLeft, Globe, CreditCard, AlertCircle, Truck, Percent, Plus, Trash2, ShieldCheck, Palette, Package } from 'lucide-react';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchAppSettings, updateAppSetting } from '@/lib/adminApi';
import { clearCODSettingsCache } from '@/lib/codSecurity';
import { BrandingAppearanceSettings } from '@/components/admin/BrandingAppearanceSettings';
import type { 
  AppSetting, 
  RegistrationSettings, 
  PaymentSettings, 
  AddressApiSettings,
  ShippingFeeSettings,
  PlatformFeeSettings,
  ShippingZonesSettings,
  ShippingZone,
  CODSettings,
} from '@/types/admin';
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
  const shippingBaseFee = getSetting('shipping_base_fee')?.value as unknown as ShippingFeeSettings | undefined;
  const platformFee = getSetting('platform_fee')?.value as unknown as PlatformFeeSettings | undefined;
  const shippingZones = getSetting('shipping_zones')?.value as unknown as ShippingZonesSettings | undefined;
  const codSettings = getSetting('cod_settings')?.value as unknown as CODSettings | undefined;
  const adminPaymentInfo = getSetting('admin_payment_info')?.value as unknown as { bank_name: string; bank_account_number: string; bank_account_name: string; qris_image_url: string } | undefined;
  const freeTierQuota = getSetting('free_tier_quota')?.value as unknown as { limit: number } | undefined;
  const courierCommission = getSetting('courier_commission')?.value as unknown as { percent: number } | undefined;

  return (
    <AdminLayout title="Pengaturan" subtitle="Konfigurasi fitur dan kustomisasi aplikasi">
      <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Tabs defaultValue="branding" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="branding">Kustomisasi</TabsTrigger>
                <TabsTrigger value="features">Fitur & Registrasi</TabsTrigger>
                <TabsTrigger value="shipping">Pengiriman</TabsTrigger>
                <TabsTrigger value="payment">Pembayaran & API</TabsTrigger>
              </TabsList>

              {/* Branding & Appearance Tab */}
              <TabsContent value="branding">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Branding & Tampilan
                    </CardTitle>
                    <CardDescription>
                      Kelola identitas brand, pengaturan PWA, SEO, dan layout homepage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BrandingAppearanceSettings isSaving={saving} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Features & Registration Tab */}
              <TabsContent value="features" className="space-y-6">
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

                {/* Free Tier Quota */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Kuota Gratis Merchant
                    </CardTitle>
                    <CardDescription>
                      Jumlah kuota transaksi gratis per bulan untuk merchant tanpa paket berbayar
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FreeTierQuotaForm
                      initialLimit={freeTierQuota?.limit ?? 100}
                      onSave={async (limit) => {
                        setSaving('free_tier_quota');
                        const success = await updateAppSetting('free_tier_quota', { limit });
                        if (success) {
                          toast.success('Kuota gratis berhasil disimpan');
                          loadSettings();
                        } else {
                          toast.error('Gagal menyimpan');
                        }
                        setSaving(null);
                      }}
                      isSaving={saving === 'free_tier_quota'}
                    />
                  </CardContent>
                </Card>

                {/* Courier Commission */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Komisi Kurir
                    </CardTitle>
                    <CardDescription>
                      Persentase komisi kurir dari biaya pengiriman
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CourierCommissionForm
                      initialPercent={courierCommission?.percent ?? 80}
                      onSave={async (percent) => {
                        setSaving('courier_commission');
                        const success = await updateAppSetting('courier_commission', { percent });
                        if (success) {
                          toast.success('Komisi kurir berhasil disimpan');
                          loadSettings();
                        } else {
                          toast.error('Gagal menyimpan');
                        }
                        setSaving(null);
                      }}
                      isSaving={saving === 'courier_commission'}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Pengaturan COD (Cash on Delivery)
                    </CardTitle>
                    <CardDescription>
                      Konfigurasi keamanan dan batasan fitur COD
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CODSettingsForm
                      initialValues={codSettings}
                      onSave={async (values) => {
                        setSaving('cod_settings');
                        const success = await updateAppSetting('cod_settings', values as unknown as Record<string, unknown>);
                        if (success) {
                          clearCODSettingsCache();
                          toast.success('Pengaturan COD berhasil disimpan');
                          loadSettings();
                        } else {
                          toast.error('Gagal menyimpan pengaturan');
                        }
                        setSaving(null);
                      }}
                      isSaving={saving === 'cod_settings'}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Pengaturan Biaya Platform
                    </CardTitle>
                    <CardDescription>
                      Konfigurasi komisi platform dari setiap transaksi
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PlatformFeeForm
                      initialValues={platformFee}
                      onSave={async (values) => {
                        setSaving('platform_fee');
                        const success = await updateAppSetting('platform_fee', values as unknown as Record<string, unknown>);
                        if (success) {
                          toast.success('Pengaturan biaya platform berhasil disimpan');
                          loadSettings();
                        } else {
                          toast.error('Gagal menyimpan pengaturan');
                        }
                        setSaving(null);
                      }}
                      isSaving={saving === 'platform_fee'}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Shipping Tab */}
              <TabsContent value="shipping" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Pengaturan Biaya Kirim
                    </CardTitle>
                    <CardDescription>
                      Konfigurasi biaya pengiriman berdasarkan jarak dan zona
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ShippingFeeForm
                      initialValues={shippingBaseFee}
                      onSave={async (values) => {
                        setSaving('shipping_base_fee');
                        const success = await updateAppSetting('shipping_base_fee', values as unknown as Record<string, unknown>);
                        if (success) {
                          toast.success('Pengaturan biaya kirim berhasil disimpan');
                          loadSettings();
                        } else {
                          toast.error('Gagal menyimpan pengaturan');
                        }
                        setSaving(null);
                      }}
                      isSaving={saving === 'shipping_base_fee'}
                    />

                    <div className="border-t border-border pt-6">
                      <h4 className="font-medium mb-4">Zona Pengiriman</h4>
                      <ShippingZonesForm
                        initialValues={shippingZones}
                        onSave={async (values) => {
                          setSaving('shipping_zones');
                          const success = await updateAppSetting('shipping_zones', values as unknown as Record<string, unknown>);
                          if (success) {
                            toast.success('Zona pengiriman berhasil disimpan');
                            loadSettings();
                          } else {
                            toast.error('Gagal menyimpan zona');
                          }
                          setSaving(null);
                        }}
                        isSaving={saving === 'shipping_zones'}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payment & API Tab */}
              <TabsContent value="payment" className="space-y-6">
                {/* Admin Default Payment Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Rekening & QRIS Default Admin
                    </CardTitle>
                    <CardDescription>
                      Rekening dan QRIS ini digunakan untuk merchant yang belum mengatur pembayaran sendiri
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminPaymentInfoForm
                      initialValues={adminPaymentInfo}
                      onSave={async (values) => {
                        setSaving('admin_payment_info');
                        const success = await updateAppSetting('admin_payment_info', values as unknown as Record<string, unknown>);
                        if (success) {
                          toast.success('Rekening default berhasil disimpan');
                          loadSettings();
                        } else {
                          toast.error('Gagal menyimpan');
                        }
                        setSaving(null);
                      }}
                      isSaving={saving === 'admin_payment_info'}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      API Alamat Wilayah
                    </CardTitle>
                    <CardDescription>
                      Konfigurasi API untuk data wilayah Indonesia
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

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Gateway
                    </CardTitle>
                    <CardDescription>
                      Konfigurasi gateway pembayaran (Midtrans & Xendit)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium">Midtrans</h3>
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

                    <div className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium">Xendit</h3>
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
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
      </div>
    </AdminLayout>
  );
}

// Sub-form components (AddressApiForm, PaymentMidtransForm, PaymentXenditForm, ShippingFeeForm, ShippingZonesForm, PlatformFeeForm, CODSettingsForm)
// [Keeping the existing implementations from the original file...]

function AddressApiForm({ initialValues, onSave, isSaving }: { initialValues?: AddressApiSettings; onSave: (values: AddressApiSettings) => Promise<void>; isSaving: boolean; }) {
  const [provider, setProvider] = useState(initialValues?.provider || 'wilayah.id');
  const [baseUrl, setBaseUrl] = useState(initialValues?.base_url || 'https://wilayah.id/api');
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ provider, base_url: baseUrl }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Provider</Label><Input value={provider} onChange={(e) => setProvider(e.target.value)} /></div>
        <div className="space-y-2"><Label>Base URL</Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></div>
      </div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function PaymentMidtransForm({ initialValues, onSave, isSaving }: { initialValues?: PaymentSettings; onSave: (values: PaymentSettings) => Promise<void>; isSaving: boolean; }) {
  const [serverKey, setServerKey] = useState(initialValues?.server_key || '');
  const [clientKey, setClientKey] = useState(initialValues?.client_key || '');
  const [isProduction, setIsProduction] = useState(initialValues?.is_production || false);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ enabled: true, server_key: serverKey, client_key: clientKey, is_production: isProduction }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Server Key</Label><Input type="password" value={serverKey} onChange={(e) => setServerKey(e.target.value)} /></div>
        <div className="space-y-2"><Label>Client Key</Label><Input value={clientKey} onChange={(e) => setClientKey(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2"><Switch checked={isProduction} onCheckedChange={setIsProduction} /><Label className="text-sm">Mode Production</Label></div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function PaymentXenditForm({ initialValues, onSave, isSaving }: { initialValues?: PaymentSettings; onSave: (values: PaymentSettings) => Promise<void>; isSaving: boolean; }) {
  const [secretKey, setSecretKey] = useState(initialValues?.secret_key || '');
  const [publicKey, setPublicKey] = useState(initialValues?.public_key || '');
  const [callbackToken, setCallbackToken] = useState(initialValues?.callback_token || '');
  const [isProduction, setIsProduction] = useState(initialValues?.is_production || false);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ enabled: true, secret_key: secretKey, public_key: publicKey, callback_token: callbackToken, is_production: isProduction }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Secret Key</Label><Input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} /></div>
        <div className="space-y-2"><Label>Public Key</Label><Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} /></div>
        <div className="space-y-2"><Label>Callback Token</Label><Input type="password" value={callbackToken} onChange={(e) => setCallbackToken(e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2"><Switch checked={isProduction} onCheckedChange={setIsProduction} /><Label className="text-sm">Mode Production</Label></div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function ShippingFeeForm({ initialValues, onSave, isSaving }: { initialValues?: ShippingFeeSettings; onSave: (values: ShippingFeeSettings) => Promise<void>; isSaving: boolean; }) {
  const [baseFee, setBaseFee] = useState(initialValues?.base_fee?.toString() || '5000');
  const [perKmFee, setPerKmFee] = useState(initialValues?.per_km_fee?.toString() || '2000');
  const [minFee, setMinFee] = useState(initialValues?.min_fee?.toString() || '5000');
  const [maxFee, setMaxFee] = useState(initialValues?.max_fee?.toString() || '50000');
  const [freeShippingMinOrder, setFreeShippingMinOrder] = useState(initialValues?.free_shipping_min_order?.toString() || '100000');
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ base_fee: parseInt(baseFee) || 0, per_km_fee: parseInt(perKmFee) || 0, min_fee: parseInt(minFee) || 0, max_fee: parseInt(maxFee) || 0, free_shipping_min_order: parseInt(freeShippingMinOrder) || 0 }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Biaya Dasar (Rp)</Label><Input type="number" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} /></div>
        <div className="space-y-2"><Label>Biaya per KM (Rp)</Label><Input type="number" value={perKmFee} onChange={(e) => setPerKmFee(e.target.value)} /></div>
        <div className="space-y-2"><Label>Biaya Minimum (Rp)</Label><Input type="number" value={minFee} onChange={(e) => setMinFee(e.target.value)} /></div>
        <div className="space-y-2"><Label>Biaya Maksimum (Rp)</Label><Input type="number" value={maxFee} onChange={(e) => setMaxFee(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>Gratis Ongkir Min. Order (Rp)</Label><Input type="number" value={freeShippingMinOrder} onChange={(e) => setFreeShippingMinOrder(e.target.value)} /></div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function ShippingZonesForm({ initialValues, onSave, isSaving }: { initialValues?: ShippingZonesSettings; onSave: (values: ShippingZonesSettings) => Promise<void>; isSaving: boolean; }) {
  const [zones, setZones] = useState<ShippingZone[]>(initialValues?.zones || [{ name: 'Dalam Desa', max_distance_km: 5, fee: 5000 }]);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ zones }); };
  const updateZone = (index: number, field: keyof ShippingZone, value: string | number) => { setZones(prev => prev.map((z, i) => i === index ? { ...z, [field]: field === 'name' ? value : parseInt(value as string) || 0 } : z)); };
  const addZone = () => { setZones(prev => [...prev, { name: 'Zona Baru', max_distance_km: 0, fee: 0 }]); };
  const removeZone = (index: number) => { setZones(prev => prev.filter((_, i) => i !== index)); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {zones.map((zone, index) => (
          <div key={index} className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
            <div className="flex-1 grid gap-2 md:grid-cols-3">
              <Input value={zone.name} onChange={(e) => updateZone(index, 'name', e.target.value)} />
              <Input type="number" value={zone.max_distance_km} onChange={(e) => updateZone(index, 'max_distance_km', e.target.value)} />
              <Input type="number" value={zone.fee} onChange={(e) => updateZone(index, 'fee', e.target.value)} />
            </div>
            <Button type="button" variant="ghost" onClick={() => removeZone(index)} disabled={zones.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2"><Button type="button" variant="outline" onClick={addZone}><Plus className="h-4 w-4 mr-2" /> Tambah Zona</Button><Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button></div>
    </form>
  );
}

function PlatformFeeForm({ initialValues, onSave, isSaving }: { initialValues?: PlatformFeeSettings; onSave: (values: PlatformFeeSettings) => Promise<void>; isSaving: boolean; }) {
  const [enabled, setEnabled] = useState(initialValues?.enabled ?? true);
  const [percentage, setPercentage] = useState(initialValues?.percentage?.toString() || '5');
  const [minFee, setMinFee] = useState(initialValues?.min_fee?.toString() || '1000');
  const [maxFee, setMaxFee] = useState(initialValues?.max_fee?.toString() || '50000');
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ enabled, percentage: parseFloat(percentage) || 0, min_fee: parseInt(minFee) || 0, max_fee: parseInt(maxFee) || 0 }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg"><div><p className="font-medium text-sm">Aktifkan Biaya Platform</p></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
      {enabled && <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Persentase (%)</Label><Input type="number" step="0.1" value={percentage} onChange={(e) => setPercentage(e.target.value)} /></div><div className="space-y-2"><Label>Minimum (Rp)</Label><Input type="number" value={minFee} onChange={(e) => setMinFee(e.target.value)} /></div><div className="space-y-2"><Label>Maksimum (Rp)</Label><Input type="number" value={maxFee} onChange={(e) => setMaxFee(e.target.value)} /></div></div>}
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function CODSettingsForm({ initialValues, onSave, isSaving }: { initialValues?: CODSettings; onSave: (values: CODSettings) => Promise<void>; isSaving: boolean; }) {
  const [enabled, setEnabled] = useState(initialValues?.enabled ?? true);
  const [maxAmount, setMaxAmount] = useState(initialValues?.max_amount?.toString() || '75000');
  const [maxDistance, setMaxDistance] = useState(initialValues?.max_distance_km?.toString() || '3');
  const [serviceFee, setServiceFee] = useState(initialValues?.service_fee?.toString() || '1000');
  const [minTrustScore, setMinTrustScore] = useState(initialValues?.min_trust_score?.toString() || '50');
  const [confirmationTimeout, setConfirmationTimeout] = useState(initialValues?.confirmation_timeout_minutes?.toString() || '15');
  const [penaltyPoints, setPenaltyPoints] = useState(initialValues?.penalty_points?.toString() || '50');
  const [successBonus, setSuccessBonus] = useState(initialValues?.success_bonus_points?.toString() || '1');
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ enabled, max_amount: parseInt(maxAmount) || 75000, max_distance_km: parseInt(maxDistance) || 3, service_fee: parseInt(serviceFee) || 1000, min_trust_score: parseInt(minTrustScore) || 50, confirmation_timeout_minutes: parseInt(confirmationTimeout) || 15, penalty_points: parseInt(penaltyPoints) || 50, success_bonus_points: parseInt(successBonus) || 1 }); };
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg"><div><p className="font-medium text-sm">Aktifkan Fitur COD</p></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div>
      {enabled && <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Maksimal Nominal COD (Rp)</Label><Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} /></div><div className="space-y-2"><Label>Maksimal Jarak (KM)</Label><Input type="number" value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} /></div></div>}
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

interface AdminPaymentInfoValues {
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  qris_image_url: string;
}

function AdminPaymentInfoForm({ initialValues, onSave, isSaving }: { initialValues?: AdminPaymentInfoValues; onSave: (values: AdminPaymentInfoValues) => Promise<void>; isSaving: boolean; }) {
  const [bankName, setBankName] = useState(initialValues?.bank_name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(initialValues?.bank_account_number || '');
  const [bankAccountName, setBankAccountName] = useState(initialValues?.bank_account_name || '');
  const [qrisImageUrl, setQrisImageUrl] = useState(initialValues?.qris_image_url || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ bank_name: bankName, bank_account_number: bankAccountNumber, bank_account_name: bankAccountName, qris_image_url: qrisImageUrl });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Nama Bank</Label>
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BRI, BCA, Mandiri" />
        </div>
        <div className="space-y-2">
          <Label>Nomor Rekening</Label>
          <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Nomor rekening admin" />
        </div>
        <div className="space-y-2">
          <Label>Atas Nama</Label>
          <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Nama pemilik" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Gambar QRIS Admin</Label>
        <ImageUpload
          value={qrisImageUrl || null}
          onChange={(url) => setQrisImageUrl(url || '')}
          bucket="admin-assets"
          path="qris"
          aspectRatio="square"
          placeholder="Upload gambar QRIS"
          maxSizeMB={3}
        />
      </div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function FreeTierQuotaForm({ initialLimit, onSave, isSaving }: { initialLimit: number; onSave: (limit: number) => Promise<void>; isSaving: boolean }) {
  const [limit, setLimit] = useState(initialLimit.toString());
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(parseInt(limit) || 100); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Jumlah Kuota Gratis per Bulan</Label>
        <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} min={0} />
        <p className="text-xs text-muted-foreground">Merchant tanpa paket berbayar akan mendapat kuota ini setiap bulan secara gratis</p>
      </div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}

function CourierCommissionForm({ initialPercent, onSave, isSaving }: { initialPercent: number; onSave: (percent: number) => Promise<void>; isSaving: boolean }) {
  const [percent, setPercent] = useState(initialPercent.toString());
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(parseFloat(percent) || 80); };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Persentase Komisi (%)</Label>
        <Input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} min={0} max={100} />
        <p className="text-xs text-muted-foreground">Kurir akan mendapatkan {percent}% dari biaya ongkir setiap pengiriman</p>
      </div>
      <Button type="submit" disabled={isSaving}><Save className="h-4 w-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan'}</Button>
    </form>
  );
}
