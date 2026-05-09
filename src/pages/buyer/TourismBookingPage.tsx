import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users, DollarSign, Clock, CheckCircle2, Loader2, MapPin, Phone } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { formatPrice, safeGoBack } from '@/lib/utils';
import { format, addDays } from 'date-fns';

interface TourismPackage {
  id: string;
  village_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  duration_days: number;
  min_persons: number;
  max_persons: number;
  includes: string[];
  is_active: boolean;
  guide_id: string | null;
}

interface Guide {
  id: string;
  name: string;
  specialization: string | null;
  daily_rate: number;
  phone: string | null;
  is_available: boolean;
}

export default function TourismBookingPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [visitDate, setVisitDate] = useState('');
  const [persons, setPersons] = useState('2');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedGuideId, setSelectedGuideId] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const { data: pkg, isLoading: pkgLoading } = useQuery<TourismPackage | null>({
    queryKey: ['tourism-package-detail', packageId],
    queryFn: async () => {
      const { data } = await supabase.from('tourism_packages').select('*').eq('id', packageId!).maybeSingle();
      return data as TourismPackage | null;
    },
    enabled: !!packageId,
  });

  const { data: guides = [] } = useQuery<Guide[]>({
    queryKey: ['tourism-guides-booking', pkg?.village_id],
    queryFn: async () => {
      const { data } = await supabase.from('tourism_guides').select('id, name, specialization, daily_rate, phone, is_available').eq('village_id', pkg!.village_id).eq('is_available', true);
      return (data || []) as Guide[];
    },
    enabled: !!pkg?.village_id,
  });

  const personCount = parseInt(persons) || 1;
  const guideRate = guides.find(g => g.id === selectedGuideId)?.daily_rate || 0;
  const packageTotal = (pkg?.price || 0) * personCount;
  const guideTotal = guideRate * (pkg?.duration_days || 1);
  const grandTotal = packageTotal + guideTotal;
  const minDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!user || !pkg) throw new Error('Data tidak lengkap');
      const { error } = await supabase.from('tourism_bookings').insert({
        package_id: pkg.id,
        village_id: pkg.village_id,
        buyer_id: user.id,
        guide_id: selectedGuideId || null,
        visit_date: visitDate,
        persons: personCount,
        total_price: grandTotal,
        status: 'PENDING',
        notes: notes || null,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        payment_status: 'UNPAID',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: any) => {
      toast({ title: 'Gagal melakukan booking', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate) { toast({ title: 'Pilih tanggal kunjungan', variant: 'destructive' }); return; }
    if (!contactName.trim()) { toast({ title: 'Isi nama kontak', variant: 'destructive' }); return; }
    if (!contactPhone.trim()) { toast({ title: 'Isi nomor HP', variant: 'destructive' }); return; }
    if (pkg && personCount < pkg.min_persons) {
      toast({ title: `Minimal ${pkg.min_persons} peserta`, variant: 'destructive' }); return;
    }
    bookMutation.mutate();
  };

  if (pkgLoading) {
    return (
      <div className="mobile-shell bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="mobile-shell bg-background">
        <Header />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Paket wisata tidak ditemukan</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Kembali</Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mobile-shell bg-background flex flex-col items-center justify-center min-h-screen px-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold">Booking Berhasil!</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Permintaan booking untuk <strong>{pkg.name}</strong> telah dikirim ke admin desa. Anda akan dihubungi dalam 1x24 jam.
          </p>
          <div className="bg-muted rounded-xl p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tanggal kunjungan</span>
              <span className="font-medium">{visitDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jumlah peserta</span>
              <span className="font-medium">{personCount} orang</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(grandTotal)}</span>
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/tourism')}>
              Wisata Lain
            </Button>
            <Button className="flex-1" onClick={() => navigate('/')}>
              Beranda
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell bg-muted/30 flex flex-col min-h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => safeGoBack(navigate)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Booking Paket Wisata</h1>
              <p className="text-sm text-muted-foreground">{pkg.name}</p>
            </div>
          </div>

          {/* Package info */}
          <Card>
            {pkg.image_url && (
              <div className="h-40 rounded-t-xl overflow-hidden">
                <img src={pkg.image_url} alt={pkg.name} className="w-full h-full object-cover" />
              </div>
            )}
            <CardContent className="p-4 space-y-3">
              <h2 className="font-bold text-base">{pkg.name}</h2>
              {pkg.description && <p className="text-sm text-muted-foreground">{pkg.description}</p>}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pkg.duration_days} hari</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{pkg.min_persons}–{pkg.max_persons} orang</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatPrice(pkg.price)}/orang</span>
              </div>
              {pkg.includes?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Sudah termasuk:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.includes.map((inc, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{inc}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Detail Kunjungan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tanggal Kunjungan *</Label>
                  <Input type="date" min={minDate} value={visitDate} onChange={e => setVisitDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Jumlah Peserta *</Label>
                  <Input
                    type="number"
                    min={pkg.min_persons}
                    max={pkg.max_persons}
                    value={persons}
                    onChange={e => setPersons(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Min. {pkg.min_persons} — Maks. {pkg.max_persons} peserta</p>
                </div>

                {guides.length > 0 && (
                  <div className="space-y-2">
                    <Label>Pemandu Wisata (opsional)</Label>
                    <Select value={selectedGuideId} onValueChange={setSelectedGuideId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih pemandu (opsional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Tanpa pemandu</SelectItem>
                        {guides.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} — {formatPrice(g.daily_rate)}/hari
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedGuideId && guides.find(g => g.id === selectedGuideId)?.specialization && (
                      <p className="text-xs text-muted-foreground">
                        Spesialisasi: {guides.find(g => g.id === selectedGuideId)?.specialization}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Catatan Khusus</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergi, kebutuhan khusus, permintaan tambahan..." rows={2} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Kontak Pemesan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Lengkap *</Label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nama pemesan" />
                </div>
                <div className="space-y-2">
                  <Label>No. HP / WhatsApp *</Label>
                  <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
                </div>
              </CardContent>
            </Card>

            {/* Price breakdown */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{formatPrice(pkg.price)} × {personCount} orang</span>
                  <span>{formatPrice(packageTotal)}</span>
                </div>
                {guideTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pemandu × {pkg.duration_days} hari</span>
                    <span>{formatPrice(guideTotal)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total Estimasi</span>
                  <span className="text-primary text-lg">{formatPrice(grandTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">*Pembayaran dikonfirmasi bersama admin desa</p>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" size="lg" disabled={bookMutation.isPending}>
              {bookMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</>
              ) : 'Kirim Permintaan Booking'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">Admin desa akan menghubungi Anda dalam 1×24 jam untuk konfirmasi</p>
          </form>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
