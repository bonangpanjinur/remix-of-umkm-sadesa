import { useState } from 'react';
import {
  Heart, Plus, Edit2, Trash2, Eye, EyeOff, Target, Users,
  TrendingUp, Download, Save, Calendar, DollarSign, CheckCircle2,
  Share2, Copy, ExternalLink, BarChart2
} from 'lucide-react';
import { DesaLayout } from '@/components/desa/DesaLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface Campaign {
  id: string;
  village_id: string;
  title: string;
  description: string | null;
  story: string | null;
  image_url: string | null;
  target_amount: number;
  current_amount: number;
  donor_count: number;
  category: string;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
}

interface Donation {
  id: string;
  campaign_id: string;
  donor_id: string | null;
  amount: number;
  message: string | null;
  is_anonymous: boolean;
  created_at: string;
  donor_name?: string;
}

const CATEGORIES = [
  { value: 'infrastruktur',   label: 'Infrastruktur Desa' },
  { value: 'pendidikan',      label: 'Pendidikan' },
  { value: 'kesehatan',       label: 'Kesehatan' },
  { value: 'wisata',          label: 'Pengembangan Wisata' },
  { value: 'bencana',         label: 'Penanggulangan Bencana' },
  { value: 'keagamaan',       label: 'Keagamaan' },
  { value: 'lingkungan',      label: 'Lingkungan Hidup' },
  { value: 'umkm',            label: 'Pemberdayaan UMKM' },
  { value: 'lainnya',         label: 'Lainnya' },
];

const emptyCampaign = (): Partial<Campaign> => ({
  title: '',
  description: '',
  story: '',
  image_url: '',
  target_amount: 0,
  category: 'infrastruktur',
  deadline: null,
  is_active: true,
});

export default function DesaDonasiPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab]         = useState('kampanye');
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [donationFilter, setDonationFilter] = useState<string | null>(null);

  // Ambil village_id / Get village_id
  const { data: villageId } = useQuery<string | null>({
    queryKey: ['desa-village-id-donasi', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_villages').select('village_id').eq('user_id', user!.id).maybeSingle();
      return data?.village_id ?? null;
    },
    enabled: !!user,
  });

  // Ambil semua kampanye / Fetch all campaigns
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['desa-campaigns', villageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donation_campaigns')
        .select('*')
        .eq('village_id', villageId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Campaign[];
    },
    enabled: !!villageId,
    staleTime: 30_000,
  });

  // Ambil donasi untuk kampanye / Fetch donations for campaign
  const { data: donations = [] } = useQuery<Donation[]>({
    queryKey: ['desa-donations', donationFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('campaign_id', donationFilter!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const donorIds = (data || []).filter((d: any) => d.donor_id && !d.is_anonymous).map((d: any) => d.donor_id);
      let nameMap: Record<string, string> = {};
      if (donorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', donorIds);
        nameMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name || 'Donatur']));
      }

      return (data || []).map((d: any) => ({
        ...d,
        donor_name: d.is_anonymous ? 'Anonim' : (nameMap[d.donor_id] || 'Donatur'),
      }));
    },
    enabled: !!donationFilter,
    staleTime: 15_000,
  });

  // Simpan kampanye / Save campaign
  const saveMutation = useMutation({
    mutationFn: async (c: Partial<Campaign>) => {
      const payload = {
        village_id: villageId,
        title: c.title,
        description: c.description || null,
        story: c.story || null,
        image_url: c.image_url || null,
        target_amount: c.target_amount,
        category: c.category,
        deadline: c.deadline || null,
        is_active: c.is_active ?? true,
      };
      if ((c as any).id) {
        const { error } = await supabase.from('donation_campaigns').update(payload).eq('id', (c as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('donation_campaigns').insert({
          ...payload,
          current_amount: 0,
          donor_count: 0,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Kampanye berhasil disimpan');
      setDialogOpen(false);
      setEditingCampaign(null);
      queryClient.invalidateQueries({ queryKey: ['desa-campaigns'] });
    },
    onError: (e: any) => toast.error('Gagal: ' + e.message),
  });

  // Toggle aktif / Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('donation_campaigns').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['desa-campaigns'] }),
  });

  const shareCampaign = (campaign: Campaign) => {
    const url = `${window.location.origin}/donasi/${campaign.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link kampanye disalin!');
  };

  // Statistik / Statistics
  const totalRaised    = campaigns.reduce((s, c) => s + c.current_amount, 0);
  const totalTarget    = campaigns.reduce((s, c) => s + c.target_amount, 0);
  const totalDonors    = campaigns.reduce((s, c) => s + c.donor_count, 0);
  const activeCampaigns = campaigns.filter(c => c.is_active).length;

  return (
    <DesaLayout title="Donasi & Crowdfunding" subtitle="Galang dana untuk pembangunan dan program desa">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Terkumpul',  value: formatPrice(totalRaised),  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Target Total',     value: formatPrice(totalTarget),   color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: 'Total Donatur',    value: totalDonors,                color: 'text-purple-600',  bg: 'bg-purple-50' },
          { label: 'Kampanye Aktif',   value: activeCampaigns,            color: 'text-amber-600',   bg: 'bg-amber-50' },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.bg} border-0`}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="kampanye"><Heart className="h-3.5 w-3.5 mr-1.5" />Kampanye</TabsTrigger>
          <TabsTrigger value="donatur"><Users className="h-3.5 w-3.5 mr-1.5" />Donatur</TabsTrigger>
        </TabsList>

        {/* ===== DAFTAR KAMPANYE ===== */}
        <TabsContent value="kampanye">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Buat kampanye galang dana untuk berbagai kebutuhan desa.
            </p>
            <Button size="sm" onClick={() => { setEditingCampaign(emptyCampaign()); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Buat Kampanye
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Heart className="h-16 w-16 mx-auto mb-3 opacity-20" />
              <h3 className="font-semibold text-foreground mb-1">Belum ada kampanye donasi</h3>
              <p className="text-sm mb-4">Mulai galang dana untuk kebutuhan desa Anda</p>
              <Button onClick={() => { setEditingCampaign(emptyCampaign()); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Buat Kampanye Pertama
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map(campaign => {
                const pct = campaign.target_amount > 0
                  ? Math.min(100, Math.round((campaign.current_amount / campaign.target_amount) * 100))
                  : 0;
                const catLabel = CATEGORIES.find(c => c.value === campaign.category)?.label || campaign.category;
                return (
                  <Card key={campaign.id} className={`overflow-hidden ${!campaign.is_active ? 'opacity-70' : ''}`}>
                    {campaign.image_url && (
                      <div className="h-32 overflow-hidden">
                        <img src={campaign.image_url} alt={campaign.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm truncate">{campaign.title}</h3>
                            <Badge className={`text-[10px] border-0 ${campaign.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {campaign.is_active ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{catLabel}</p>
                        </div>
                      </div>

                      {campaign.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{campaign.description}</p>
                      )}

                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-emerald-700">{formatPrice(campaign.current_amount)}</span>
                          <span className="text-muted-foreground">dari {formatPrice(campaign.target_amount)}</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
                          <span>{pct}% tercapai</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{campaign.donor_count} donatur</span>
                        </div>
                      </div>

                      {campaign.deadline && (
                        <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Berakhir: {format(new Date(campaign.deadline), 'dd MMMM yyyy', { locale: idLocale })}
                        </p>
                      )}

                      <Separator className="mb-3" />

                      <div className="flex items-center gap-1 justify-between">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => toggleMutation.mutate({ id: campaign.id, is_active: campaign.is_active })}>
                            {campaign.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditingCampaign(campaign); setDialogOpen(true); }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => shareCampaign(campaign)}>
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setDonationFilter(campaign.id); setSelectedCampaign(campaign); setActiveTab('donatur'); }}>
                          <Users className="h-3 w-3 mr-1" /> Lihat Donatur
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== DONATUR ===== */}
        <TabsContent value="donatur">
          <div className="flex items-center gap-3 mb-4">
            <select
              className="border rounded-md px-3 py-1.5 text-sm"
              value={donationFilter || ''}
              onChange={e => setDonationFilter(e.target.value || null)}
            >
              <option value="">Pilih Kampanye...</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            {selectedCampaign && (
              <Badge variant="outline" className="text-xs">
                {selectedCampaign.donor_count} donatur · {formatPrice(selectedCampaign.current_amount)} terkumpul
              </Badge>
            )}
          </div>

          {!donationFilter ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Pilih kampanye untuk melihat daftar donatur</p>
            </div>
          ) : donations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Belum ada donasi untuk kampanye ini</p>
            </div>
          ) : (
            <div className="space-y-2">
              {donations.map(donation => (
                <Card key={donation.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Heart className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{donation.donor_name}</p>
                          {donation.message && (
                            <p className="text-xs text-muted-foreground italic truncate">"{donation.message}"</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(donation.created_at), { addSuffix: true, locale: idLocale })}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-700 shrink-0">{formatPrice(donation.amount)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Buat/Edit Kampanye */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); setEditingCampaign(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editingCampaign as any)?.id ? 'Edit Kampanye' : 'Buat Kampanye Donasi'}</DialogTitle>
          </DialogHeader>

          {editingCampaign && (
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label className="text-sm">Judul Kampanye *</Label>
                <Input
                  placeholder="Misal: Pembangunan Jembatan Desa Sukamaju"
                  value={editingCampaign.title || ''}
                  onChange={e => setEditingCampaign(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Kategori *</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={editingCampaign.category || 'infrastruktur'}
                  onChange={e => setEditingCampaign(p => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Deskripsi Singkat</Label>
                <Textarea
                  placeholder="Jelaskan tujuan kampanye ini secara singkat..."
                  value={editingCampaign.description || ''}
                  onChange={e => setEditingCampaign(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">Cerita Lengkap</Label>
                <Textarea
                  placeholder="Ceritakan latar belakang dan manfaat program ini untuk warga desa..."
                  value={editingCampaign.story || ''}
                  onChange={e => setEditingCampaign(p => ({ ...p, story: e.target.value }))}
                  rows={4} className="resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">URL Foto Kampanye</Label>
                <Input
                  placeholder="https://..."
                  value={editingCampaign.image_url || ''}
                  onChange={e => setEditingCampaign(p => ({ ...p, image_url: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Target Dana (Rp) *</Label>
                  <Input
                    type="number" min={0} placeholder="0"
                    value={editingCampaign.target_amount || ''}
                    onChange={e => setEditingCampaign(p => ({ ...p, target_amount: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Tenggat Waktu (opsional)</Label>
                  <Input
                    type="date"
                    value={editingCampaign.deadline || ''}
                    onChange={e => setEditingCampaign(p => ({ ...p, deadline: e.target.value || null }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingCampaign.is_active ?? true}
                  onCheckedChange={v => setEditingCampaign(p => ({ ...p, is_active: v }))}
                />
                <Label className="text-sm">Kampanye aktif dan menerima donasi</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingCampaign(null); }}>Batal</Button>
            <Button
              onClick={() => saveMutation.mutate(editingCampaign!)}
              disabled={!editingCampaign?.title || !editingCampaign?.target_amount || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Kampanye'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DesaLayout>
  );
}
