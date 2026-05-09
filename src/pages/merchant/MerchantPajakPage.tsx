import { useState, useMemo } from 'react';
import {
  FileText, Download, Calculator, TrendingUp, DollarSign,
  Calendar, AlertCircle, CheckCircle2, Info, BarChart2, Printer
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tarif pajak Indonesia / Indonesian tax rates
const PPN_RATE = 0.11;         // PPN 11%
const PPH_FINAL_RATE = 0.005;  // PPh Final UMKM 0.5%
const PTKP_MONTHLY = 4_500_000; // PTKP per bulan (PTKP tahunan 54jt / 12)

interface MonthlyTaxData {
  month: string;
  monthLabel: string;
  revenue: number;
  ppn_collected: number;     // PPN dipungut dari pembeli
  pph_final: number;         // PPh Final 0.5%
  net_revenue: number;
  order_count: number;
}

interface OrderRow {
  id: string;
  total: number;
  subtotal: number;
  status: string;
  created_at: string;
}

function generateMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: idLocale }),
    };
  });
}

export default function MerchantPajakPage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState('rekap');

  const years = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2)];
  const months = generateMonths(12);

  // Ambil semua pesanan selesai tahun ini / Fetch all completed orders this year
  const { data: orders = [], isLoading } = useQuery<OrderRow[]>({
    queryKey: ['merchant-tax-orders', merchantId, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, subtotal, status, created_at')
        .eq('merchant_id', merchantId!)
        .in('status', ['DONE', 'DELIVERED'])
        .gte('created_at', `${selectedYear}-01-01T00:00:00.000Z`)
        .lte('created_at', `${selectedYear}-12-31T23:59:59.999Z`)
        .order('created_at');
      if (error) throw error;
      return (data || []) as OrderRow[];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 60_000,
  });

  // Hitung pajak per bulan / Calculate tax per month
  const monthlyData: MonthlyTaxData[] = useMemo(() => {
    const map: Record<number, OrderRow[]> = {};
    orders.forEach(o => {
      const m = getMonth(new Date(o.created_at));
      if (!map[m]) map[m] = [];
      map[m].push(o);
    });

    return Array.from({ length: 12 }, (_, i) => {
      const monthOrders = map[i] || [];
      const revenue = monthOrders.reduce((s, o) => s + (o.subtotal || o.total), 0);
      const ppn = Math.round(revenue * PPN_RATE);
      const pph = Math.round(revenue * PPH_FINAL_RATE);
      const d = new Date(Number(selectedYear), i, 1);
      return {
        month: format(d, 'yyyy-MM'),
        monthLabel: format(d, 'MMMM', { locale: idLocale }),
        revenue,
        ppn_collected: ppn,
        pph_final: pph,
        net_revenue: revenue - pph,
        order_count: monthOrders.length,
      };
    });
  }, [orders, selectedYear]);

  // Ringkasan tahunan / Annual summary
  const annualSummary = useMemo(() => ({
    totalRevenue: monthlyData.reduce((s, m) => s + m.revenue, 0),
    totalPPN: monthlyData.reduce((s, m) => s + m.ppn_collected, 0),
    totalPPH: monthlyData.reduce((s, m) => s + m.pph_final, 0),
    totalOrders: monthlyData.reduce((s, m) => s + m.order_count, 0),
  }), [monthlyData]);

  // Data bulan yang dipilih / Selected month data
  const selectedMonthData = monthlyData.find(m => m.month === selectedMonth);

  // Pesanan bulan terpilih / Orders for selected month
  const monthOrders = useMemo(() => {
    const [y, mStr] = selectedMonth.split('-');
    const m = parseInt(mStr) - 1;
    return orders.filter(o => {
      const d = new Date(o.created_at);
      return getMonth(d) === m && getYear(d) === parseInt(y);
    });
  }, [orders, selectedMonth]);

  // Export PDF SPT / Export PDF tax report
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('LAPORAN PAJAK UMKM', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Tahun Pajak: ${selectedYear}`, 105, 22, { align: 'center' });
    doc.text(`Dibuat: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: idLocale })}`, 105, 28, { align: 'center' });

    doc.setFontSize(11);
    doc.text('RINGKASAN TAHUNAN', 14, 38);
    autoTable(doc, {
      startY: 41,
      head: [['Keterangan', 'Nilai']],
      body: [
        ['Total Omzet (Bruto)', formatPrice(annualSummary.totalRevenue)],
        ['PPN Dipungut (11%)', formatPrice(annualSummary.totalPPN)],
        ['PPh Final UMKM (0.5%)', formatPrice(annualSummary.totalPPH)],
        ['Total Pesanan Selesai', String(annualSummary.totalOrders)],
      ],
      theme: 'striped',
    });

    const y2 = (doc as any).lastAutoTable.finalY + 10;
    doc.text('REKAP PER BULAN', 14, y2);
    autoTable(doc, {
      startY: y2 + 3,
      head: [['Bulan', 'Omzet', 'PPN (11%)', 'PPh Final (0.5%)', 'Pesanan']],
      body: monthlyData.map(m => [
        m.monthLabel,
        formatPrice(m.revenue),
        formatPrice(m.ppn_collected),
        formatPrice(m.pph_final),
        String(m.order_count),
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
    });

    doc.save(`laporan-pajak-${selectedYear}.pdf`);
  };

  if (guardLoading) {
    return (
      <MerchantLayout title="Laporan Pajak" subtitle="Rekap pajak PPN dan PPh UMKM">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Laporan Pajak" subtitle="Rekap pajak PPN 11% dan PPh Final UMKM 0.5% untuk pelaporan SPT">
      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Laporan ini bersifat estimasi berdasarkan data penjualan di platform. Untuk pelaporan pajak resmi, konsultasikan dengan konsultan pajak terdaftar. Tarif: PPN 11%, PPh Final UMKM 0,5% dari omzet bruto.
        </p>
      </div>

      {/* Pilih Tahun & Export */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>Tahun {y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={exportPDF}>
          <Download className="h-4 w-4 mr-1.5" /> Export PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1.5" /> Cetak
        </Button>
      </div>

      {/* Ringkasan Tahunan / Annual Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Omzet', value: formatPrice(annualSummary.totalRevenue), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'PPN Dipungut (11%)', value: formatPrice(annualSummary.totalPPN), color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'PPh Final (0,5%)', value: formatPrice(annualSummary.totalPPH), color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Pesanan', value: annualSummary.totalOrders, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.bg} border-0`}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="rekap">Rekap Tahunan</TabsTrigger>
          <TabsTrigger value="bulanan">Detail Bulanan</TabsTrigger>
          <TabsTrigger value="panduan">Panduan SPT</TabsTrigger>
        </TabsList>

        {/* ===== REKAP TAHUNAN ===== */}
        <TabsContent value="rekap">
          {isLoading ? (
            <div className="h-48 rounded-xl bg-muted animate-pulse" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bulan</TableHead>
                      <TableHead className="text-right">Omzet</TableHead>
                      <TableHead className="text-right">PPN (11%)</TableHead>
                      <TableHead className="text-right">PPh Final (0.5%)</TableHead>
                      <TableHead className="text-right">Pesanan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map(m => (
                      <TableRow key={m.month} className={m.revenue === 0 ? 'opacity-40' : ''}>
                        <TableCell className="font-medium text-sm">{m.monthLabel}</TableCell>
                        <TableCell className="text-right text-sm">{formatPrice(m.revenue)}</TableCell>
                        <TableCell className="text-right text-sm text-orange-600">{formatPrice(m.ppn_collected)}</TableCell>
                        <TableCell className="text-right text-sm text-red-600">{formatPrice(m.pph_final)}</TableCell>
                        <TableCell className="text-right text-sm">{m.order_count}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right text-blue-700">{formatPrice(annualSummary.totalRevenue)}</TableCell>
                      <TableCell className="text-right text-orange-700">{formatPrice(annualSummary.totalPPN)}</TableCell>
                      <TableCell className="text-right text-red-700">{formatPrice(annualSummary.totalPPH)}</TableCell>
                      <TableCell className="text-right">{annualSummary.totalOrders}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== DETAIL BULANAN ===== */}
        <TabsContent value="bulanan">
          <div className="flex items-center gap-2 mb-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-44 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedMonthData && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Omzet Bulan Ini', value: formatPrice(selectedMonthData.revenue), color: 'text-blue-600' },
                  { label: 'PPN Dipungut', value: formatPrice(selectedMonthData.ppn_collected), color: 'text-orange-600' },
                  { label: 'PPh Final', value: formatPrice(selectedMonthData.pph_final), color: 'text-red-600' },
                  { label: 'Pesanan', value: selectedMonthData.order_count, color: 'text-emerald-600' },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pesanan Bulan Ini ({monthOrders.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {monthOrders.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">Tidak ada pesanan bulan ini</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Pesanan</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead className="text-right">Omzet</TableHead>
                          <TableHead className="text-right">PPh (0.5%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthOrders.slice(0, 50).map(o => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</TableCell>
                            <TableCell className="text-xs">{format(new Date(o.created_at), 'dd MMM HH:mm', { locale: idLocale })}</TableCell>
                            <TableCell className="text-right text-xs">{formatPrice(o.subtotal || o.total)}</TableCell>
                            <TableCell className="text-right text-xs text-red-600">{formatPrice(Math.round((o.subtotal || o.total) * PPH_FINAL_RATE))}</TableCell>
                          </TableRow>
                        ))}
                        {monthOrders.length > 50 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-2">
                              +{monthOrders.length - 50} pesanan lainnya (lihat di export PDF)
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== PANDUAN SPT ===== */}
        <TabsContent value="panduan">
          <div className="space-y-4">
            {[
              {
                title: 'PPh Final UMKM (PP 55/2022)',
                color: 'border-l-red-500',
                items: [
                  'Tarif: 0,5% dari omzet/peredaran bruto per bulan',
                  'Wajib setor setiap bulan paling lambat tanggal 15 bulan berikutnya',
                  'Kode akun pajak: 411128 (PPh Final Pasal 4 ayat 2)',
                  'Batas omzet: Berlaku untuk omzet s.d. Rp 4,8 miliar/tahun',
                  'Setor via: DJP Online, ATM, atau bank persepsi',
                ],
              },
              {
                title: 'PPN (Jika Sudah PKP)',
                color: 'border-l-orange-500',
                items: [
                  'Tarif: 11% dari DPP (Dasar Pengenaan Pajak)',
                  'Wajib daftar PKP jika omzet > Rp 4,8 miliar/tahun',
                  'Setor setiap bulan, lapor SPT Masa PPN paling lambat akhir bulan berikutnya',
                  'Dapat dikreditkan dengan Pajak Masukan atas pembelian',
                ],
              },
              {
                title: 'Cara Lapor via DJP Online',
                color: 'border-l-blue-500',
                items: [
                  '1. Login ke djponline.pajak.go.id dengan NPWP dan EFIN',
                  '2. Pilih menu "Lapor" → "e-Filing"',
                  '3. Untuk PPh Final: Pilih form 1770 (pribadi) atau 1771 (badan)',
                  '4. Gunakan data dari laporan ini sebagai referensi pengisian',
                  '5. Simpan BPS (Bukti Penerimaan Surat) setelah berhasil melapor',
                ],
              },
            ].map(section => (
              <Card key={section.title} className={`border-l-4 ${section.color}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </MerchantLayout>
  );
}
