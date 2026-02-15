import { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, Truck, Store, PieChart, Download, Calendar,
  ArrowUpRight, ArrowDownRight, FileText
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { SalesAreaChart } from '@/components/admin/SalesChart';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FinancialData {
  totalRevenue: number;
  platformFees: number;
  courierFees: number;
  merchantRevenue: number;
  shippingCollected: number;
  completedOrders: number;
}

interface OrderFinance {
  id: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  created_at: string;
  merchant_name: string;
}

export default function AdminFinancePage() {
  const [orders, setOrders] = useState<OrderFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');
  const [platformFeePercent, setPlatformFeePercent] = useState(5);
  const [courierFeePercent, setCourierFeePercent] = useState(80);
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

  // Load fee settings from app_settings
  useEffect(() => {
    const loadFeeSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['platform_fee', 'courier_commission']);
        
        data?.forEach(setting => {
          const val = setting.value as Record<string, any>;
          if (setting.key === 'platform_fee' && val?.percent != null) {
            setPlatformFeePercent(val.percent);
          }
          if (setting.key === 'courier_commission' && val?.percent != null) {
            setCourierFeePercent(val.percent);
          }
        });
      } catch (e) {
        console.error('Error loading fee settings:', e);
      }
    };
    loadFeeSettings();
  }, []);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case '7days':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subDays(startOfMonth(now), 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'custom':
        return { 
          start: customStart ? startOfDay(customStart) : startOfDay(subDays(now, 30)), 
          end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
        };
      default:
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const { data, error } = await supabase
        .from('orders')
        .select('id, total, subtotal, shipping_cost, status, payment_status, payment_method, created_at, merchants(name)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(o => ({
        id: o.id,
        total: o.total,
        subtotal: o.subtotal,
        shipping_cost: o.shipping_cost,
        status: o.status,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        created_at: o.created_at,
        merchant_name: (o.merchants as { name: string } | null)?.name || '-',
      }));

      setOrders(mapped);
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange, customStart, customEnd]);

  const financials = useMemo<FinancialData>(() => {
    const completed = orders.filter(o => o.status === 'DONE' || o.status === 'DELIVERED');
    
    const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);
    const totalSubtotal = completed.reduce((sum, o) => sum + o.subtotal, 0);
    const shippingCollected = completed.reduce((sum, o) => sum + o.shipping_cost, 0);
    
    const platformFees = Math.round(totalSubtotal * (platformFeePercent / 100));
    const courierFees = Math.round(shippingCollected * (courierFeePercent / 100));
    const merchantRevenue = totalSubtotal - platformFees;

    return {
      totalRevenue,
      platformFees,
      courierFees,
      merchantRevenue,
      shippingCollected,
      completedOrders: completed.length,
    };
  }, [orders, platformFeePercent, courierFeePercent]);

  const chartData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; orders: number }>();
    
    orders.forEach(order => {
      if (order.status === 'DONE' || order.status === 'DELIVERED') {
        const date = order.created_at.split('T')[0];
        const existing = dateMap.get(date) || { revenue: 0, orders: 0 };
        dateMap.set(date, {
          revenue: existing.revenue + order.total,
          orders: existing.orders + 1,
        });
      }
    });

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));
  }, [orders]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const { start, end } = getDateRange();
    
    doc.setFontSize(18);
    doc.text('Laporan Keuangan Platform', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Periode: ${format(start, 'dd MMM yyyy', { locale: idLocale })} - ${format(end, 'dd MMM yyyy', { locale: idLocale })}`, 14, 30);
    doc.text(`Dicetak: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: idLocale })}`, 14, 36);

    // Summary
    doc.setFontSize(12);
    doc.text('Ringkasan Keuangan', 14, 48);
    
    autoTable(doc, {
      startY: 52,
      head: [['Kategori', 'Jumlah']],
      body: [
        ['Total Pendapatan Bruto', formatPrice(financials.totalRevenue)],
        [`Fee Platform (${platformFeePercent}%)`, formatPrice(financials.platformFees)],
        [`Pendapatan Kurir (${courierFeePercent}% ongkir)`, formatPrice(financials.courierFees)],
        ['Pendapatan Merchant Bersih', formatPrice(financials.merchantRevenue)],
        ['Total Ongkir Terkumpul', formatPrice(financials.shippingCollected)],
        ['Jumlah Pesanan Selesai', financials.completedOrders.toString()],
      ],
    });

    // Transactions
    const tableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.text('Detail Transaksi', 14, tableY);
    
    autoTable(doc, {
      startY: tableY + 4,
      head: [['ID', 'Merchant', 'Total', 'Ongkir', 'Fee', 'Tanggal']],
      body: orders.filter(o => o.status === 'DONE' || o.status === 'DELIVERED').map(o => [
        o.id.slice(0, 8),
        o.merchant_name,
        formatPrice(o.total),
        formatPrice(o.shipping_cost),
        formatPrice(Math.round(o.subtotal * (platformFeePercent / 100))),
        format(new Date(o.created_at), 'dd/MM/yy'),
      ]),
    });

    doc.save(`laporan-keuangan-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Merchant', 'Total', 'Subtotal', 'Ongkir', 'Fee Platform', 'Status', 'Tanggal'];
    const rows = orders.map(o => [
      o.id,
      o.merchant_name,
      o.total,
      o.subtotal,
      o.shipping_cost,
      Math.round(o.subtotal * (platformFeePercent / 100)),
      o.status,
      format(new Date(o.created_at), 'dd/MM/yyyy HH:mm'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `keuangan-${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <AdminLayout title="Laporan Keuangan" subtitle="Analisis pendapatan dan fee platform">
      {/* Date Range & Export */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">7 Hari Terakhir</SelectItem>
              <SelectItem value="30days">30 Hari Terakhir</SelectItem>
              <SelectItem value="thisMonth">Bulan Ini</SelectItem>
              <SelectItem value="lastMonth">Bulan Lalu</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateRange === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-36 justify-start text-left text-xs", !customStart && "text-muted-foreground")}>
                    {customStart ? format(customStart, 'dd MMM yyyy') : 'Dari'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-36 justify-start text-left text-xs", !customEnd && "text-muted-foreground")}>
                    {customEnd ? format(customEnd, 'dd MMM yyyy') : 'Sampai'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button onClick={exportToPDF}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Pendapatan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(financials.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  {financials.completedOrders} pesanan selesai
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Fee Platform
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatPrice(financials.platformFees)}</p>
                <p className="text-xs text-muted-foreground mt-1">{platformFeePercent}% dari subtotal</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Pendapatan Kurir
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(financials.courierFees)}</p>
                <p className="text-xs text-muted-foreground mt-1">{courierFeePercent}% dari ongkir</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Pendapatan Merchant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatPrice(financials.merchantRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Setelah potongan fee</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="mb-6">
              <SalesAreaChart data={chartData} title="Trend Pendapatan" />
            </div>
          )}

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detail Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Ongkir</TableHead>
                      <TableHead className="text-right">Fee Platform</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          Tidak ada transaksi
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.id.slice(0, 8)}</TableCell>
                          <TableCell>{order.merchant_name}</TableCell>
                          <TableCell className="text-right">{formatPrice(order.subtotal)}</TableCell>
                          <TableCell className="text-right">{formatPrice(order.shipping_cost)}</TableCell>
                          <TableCell className="text-right text-primary">{formatPrice(Math.round(order.subtotal * (platformFeePercent / 100)))}</TableCell>
                          <TableCell className="text-right font-medium">{formatPrice(order.total)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              order.status === 'DONE' || order.status === 'DELIVERED'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {order.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(order.created_at), 'dd MMM, HH:mm', { locale: idLocale })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
