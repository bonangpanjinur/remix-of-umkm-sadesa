import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileDown, Calendar, Wallet, Package,
  TrendingUp, Bike, Star, ChevronDown, ChevronUp
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, subWeeks, subMonths, eachDayOfInterval
} from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EarningRecord {
  id: string;
  amount: number;
  type: string;
  status: string;
  order_id: string | null;
  created_at: string;
  paid_at: string | null;
}

type PeriodType = 'week' | 'month';

function getWeekOptions() {
  const opts = [];
  for (let i = 0; i < 8; i++) {
    const date = subWeeks(new Date(), i);
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    opts.push({
      value: `week-${i}`,
      label: i === 0 ? 'Minggu Ini' : `${format(start, 'd MMM', { locale: idLocale })} – ${format(end, 'd MMM yyyy', { locale: idLocale })}`,
      start,
      end,
    });
  }
  return opts;
}

function getMonthOptions() {
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    opts.push({
      value: `month-${i}`,
      label: format(date, 'MMMM yyyy', { locale: idLocale }),
      start,
      end,
    });
  }
  return opts;
}

function buildDailySummary(earnings: EarningRecord[], start: Date, end: Date) {
  const days = eachDayOfInterval({ start, end });
  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayEarnings = earnings.filter(e =>
      format(new Date(e.created_at), 'yyyy-MM-dd') === dayStr
    );
    return {
      label: format(day, 'EEEE, d MMM', { locale: idLocale }),
      date: dayStr,
      delivery: dayEarnings.filter(e => e.type === 'DELIVERY').reduce((s, e) => s + e.amount, 0),
      ride: dayEarnings.filter(e => e.type === 'RIDE').reduce((s, e) => s + e.amount, 0),
      count: dayEarnings.length,
      total: dayEarnings.reduce((s, e) => s + e.amount, 0),
    };
  }).filter(d => d.count > 0);
}

export default function CourierSlipPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [selectedPeriod, setSelectedPeriod] = useState('week-0');
  const [expanded, setExpanded] = useState<string[]>([]);

  const weekOptions = getWeekOptions();
  const monthOptions = getMonthOptions();
  const periodOptions = periodType === 'week' ? weekOptions : monthOptions;

  const currentOption = periodOptions.find(o => o.value === selectedPeriod) ?? periodOptions[0];

  const { data, isLoading } = useQuery({
    queryKey: ['courier-slip', user?.id, selectedPeriod],
    queryFn: async () => {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id, name, phone, vehicle_type, registration_status')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!courier || courier.registration_status !== 'APPROVED') {
        navigate('/courier');
        return null;
      }

      const { data: earnings } = await supabase
        .from('courier_earnings')
        .select('*')
        .eq('courier_id', courier.id)
        .gte('created_at', currentOption.start.toISOString())
        .lte('created_at', currentOption.end.toISOString())
        .order('created_at', { ascending: true });

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user!.id)
        .maybeSingle();

      const all: EarningRecord[] = earnings || [];
      const totalAmount = all.reduce((s, e) => s + e.amount, 0);
      const paidAmount = all.filter(e => e.status === 'PAID').reduce((s, e) => s + e.amount, 0);
      const pendingAmount = all.filter(e => e.status === 'PENDING').reduce((s, e) => s + e.amount, 0);
      const deliveryTotal = all.filter(e => e.type === 'DELIVERY').reduce((s, e) => s + e.amount, 0);
      const rideTotal = all.filter(e => e.type === 'RIDE').reduce((s, e) => s + e.amount, 0);
      const deliveryCount = all.filter(e => e.type === 'DELIVERY').length;
      const rideCount = all.filter(e => e.type === 'RIDE').length;

      const dailySummary = buildDailySummary(all, currentOption.start, currentOption.end);

      return {
        courier,
        profile,
        earnings: all,
        stats: { totalAmount, paidAmount, pendingAmount, deliveryTotal, rideTotal, deliveryCount, rideCount },
        dailySummary,
      };
    },
    enabled: !!user && !authLoading,
    staleTime: 60_000,
  });

  const handlePeriodTypeChange = (val: PeriodType) => {
    setPeriodType(val);
    setSelectedPeriod(val === 'week' ? 'week-0' : 'month-0');
  };

  const handleDownloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { courier, profile, stats, dailySummary } = data;
    const courierName = profile?.full_name || courier.name || 'Kurir';
    const periodLabel = currentOption.label;
    const now = format(new Date(), 'dd MMMM yyyy HH:mm', { locale: idLocale });

    // Header
    doc.setFillColor(34, 139, 34);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SLIP PENGHASILAN KURIR', 105, 14, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('DesaMart – Platform Desa Wisata & UMKM', 105, 21, { align: 'center' });
    doc.text(`Periode: ${periodLabel}`, 105, 28, { align: 'center' });

    // Reset color
    doc.setTextColor(0, 0, 0);

    // Info kurir
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMASI KURIR', 14, 44);
    doc.setDrawColor(34, 139, 34);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const leftInfo = [
      ['Nama Kurir', courierName],
      ['No. HP', courier.phone || '-'],
      ['Jenis Kendaraan', courier.vehicle_type === 'motorcycle' ? 'Sepeda Motor' : courier.vehicle_type || '-'],
    ];
    const rightInfo = [
      ['Email', user?.email || '-'],
      ['Dicetak pada', now],
      ['Periode', periodType === 'week' ? 'Mingguan' : 'Bulanan'],
    ];
    leftInfo.forEach(([label, val], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 14, 54 + i * 6);
      doc.setFont('helvetica', 'normal');
      doc.text(val, 55, 54 + i * 6);
    });
    rightInfo.forEach(([label, val], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 110, 54 + i * 6);
      doc.setFont('helvetica', 'normal');
      doc.text(val, 150, 54 + i * 6);
    });

    // Ringkasan penghasilan
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RINGKASAN PENGHASILAN', 14, 78);
    doc.line(14, 80, 196, 80);

    autoTable(doc, {
      startY: 83,
      head: [['Keterangan', 'Jumlah', 'Total (Rp)']],
      body: [
        ['Pengiriman Reguler', `${stats.deliveryCount} transaksi`, stats.deliveryTotal.toLocaleString('id-ID')],
        ['Layanan Ojek Desa', `${stats.rideCount} perjalanan`, stats.rideTotal.toLocaleString('id-ID')],
        ['Sudah Dibayar', '-', stats.paidAmount.toLocaleString('id-ID')],
        ['Menunggu Pembayaran', '-', stats.pendingAmount.toLocaleString('id-ID')],
      ],
      foot: [['TOTAL PENGHASILAN', `${stats.deliveryCount + stats.rideCount} transaksi`, stats.totalAmount.toLocaleString('id-ID')]],
      headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [240, 255, 240], textColor: [0, 100, 0], fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right' } },
    });

    // Rincian harian
    const afterSummary = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RINCIAN HARIAN', 14, afterSummary);
    doc.line(14, afterSummary + 2, 196, afterSummary + 2);

    if (dailySummary.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Tidak ada transaksi pada periode ini.', 14, afterSummary + 10);
    } else {
      autoTable(doc, {
        startY: afterSummary + 5,
        head: [['Tanggal', 'Pengiriman (Rp)', 'Ojek (Rp)', 'Jml Transaksi', 'Total (Rp)']],
        body: dailySummary.map(d => [
          d.label,
          d.delivery > 0 ? d.delivery.toLocaleString('id-ID') : '-',
          d.ride > 0 ? d.ride.toLocaleString('id-ID') : '-',
          String(d.count),
          d.total.toLocaleString('id-ID'),
        ]),
        headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right', fontStyle: 'bold' } },
      });
    }

    // Footer
    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Dokumen ini dibuat otomatis oleh sistem DesaMart. Harap simpan sebagai arsip.', 105, pageH - 12, { align: 'center' });
    doc.text(`DesaMart © ${new Date().getFullYear()} – Desa Wisata & UMKM Indonesia`, 105, pageH - 7, { align: 'center' });

    const filename = `slip-penghasilan-${courierName.replace(/\s+/g, '-').toLowerCase()}-${format(currentOption.start, 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
  };

  const toggleExpanded = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const stats = data?.stats ?? { totalAmount: 0, paidAmount: 0, pendingAmount: 0, deliveryTotal: 0, rideTotal: 0, deliveryCount: 0, rideCount: 0 };
  const dailySummary = data?.dailySummary ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/courier/earnings')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-xl font-bold">Slip Penghasilan</h1>
            <p className="text-xs text-muted-foreground">Download PDF rekap pendapatan kurir</p>
          </div>
        </div>

        {/* Filter periode */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipe Periode</label>
                <Select value={periodType} onValueChange={(v) => handlePeriodTypeChange(v as PeriodType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Mingguan</SelectItem>
                    <SelectItem value="month">Bulanan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pilih Periode</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 inline mr-1" />
              {format(currentOption.start, 'd MMMM', { locale: idLocale })} – {format(currentOption.end, 'd MMMM yyyy', { locale: idLocale })}
            </p>
          </CardContent>
        </Card>

        {/* Kartu ringkasan */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white col-span-2">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Total Penghasilan Periode Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatPrice(stats.totalAmount)}</p>
              <div className="flex gap-3 mt-2 text-xs text-green-100">
                <span>✓ Dibayar: {formatPrice(stats.paidAmount)}</span>
                <span>⏳ Pending: {formatPrice(stats.pendingAmount)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                <Package className="h-3.5 w-3.5" /> Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-primary">{formatPrice(stats.deliveryTotal)}</p>
              <p className="text-xs text-muted-foreground">{stats.deliveryCount} order</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                <Bike className="h-3.5 w-3.5" /> Ojek Desa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-blue-600">{formatPrice(stats.rideTotal)}</p>
              <p className="text-xs text-muted-foreground">{stats.rideCount} perjalanan</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rincian harian */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Rincian Harian
                <Badge variant="secondary" className="ml-auto">{dailySummary.length} hari aktif</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dailySummary.length === 0 ? (
                <div className="text-center py-8">
                  <Star className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Belum ada transaksi di periode ini</p>
                </div>
              ) : dailySummary.map((day) => {
                const isOpen = expanded.includes(day.date);
                return (
                  <div key={day.date} className="border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpanded(day.date)}
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium">{day.label}</p>
                        <p className="text-xs text-muted-foreground">{day.count} transaksi</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary text-sm">{formatPrice(day.total)}</span>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/20 space-y-1">
                        {day.delivery > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Pengiriman</span>
                            <span className="font-medium">{formatPrice(day.delivery)}</span>
                          </div>
                        )}
                        {day.ride > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1"><Bike className="h-3 w-3" /> Ojek Desa</span>
                            <span className="font-medium">{formatPrice(day.ride)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tombol download */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleDownloadPDF}
            disabled={!data || stats.totalAmount === 0}
          >
            <FileDown className="h-5 w-5 mr-2" />
            Download Slip PDF
          </Button>
          {stats.totalAmount === 0 && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Tidak ada data untuk didownload pada periode ini
            </p>
          )}
        </motion.div>

        <Separator />
        <p className="text-xs text-center text-muted-foreground">
          Slip ini merupakan rekap otomatis dari sistem DesaMart.
          Simpan sebagai arsip penghasilan Anda.
        </p>
      </div>
    </div>
  );
}
