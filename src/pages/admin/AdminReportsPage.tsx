import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Calendar, TrendingUp, ShoppingBag, DollarSign, Store } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { SalesAreaChart, OrdersBarChart } from '@/components/admin/SalesChart';

interface OrderReport {
  id: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  status: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  merchantId: string | null;
  merchantName: string;
  createdAt: string;
}

interface MerchantSummary {
  merchantId: string;
  merchantName: string;
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
}

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');
  const [reportType, setReportType] = useState('transactions');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

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
          start: customStart ? startOfDay(customStart) : startOfDay(subDays(now, 7)), 
          end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
        };
      default:
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      const { data, error } = await supabase
        .from('orders')
        .select('*, merchants(name)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: OrderReport[] = (data || []).map(o => ({
        id: o.id,
        total: o.total,
        subtotal: o.subtotal,
        shippingCost: o.shipping_cost,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        merchantId: o.merchant_id,
        merchantName: (o.merchants as { name: string } | null)?.name || 'Unknown',
        createdAt: o.created_at,
      }));

      setOrders(mapped);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [dateRange, customStart, customEnd]);

  // Summary calculations
  const summary = useMemo(() => {
    const completedOrders = orders.filter(o => o.status === 'DONE');
    const pendingOrders = orders.filter(o => o.status === 'NEW');
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');

    return {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      totalRevenue: completedOrders.reduce((sum, o) => sum + o.total, 0),
      totalShipping: completedOrders.reduce((sum, o) => sum + o.shippingCost, 0),
      avgOrderValue: completedOrders.length > 0 
        ? Math.round(completedOrders.reduce((sum, o) => sum + o.total, 0) / completedOrders.length)
        : 0,
      paidOrdersCount: paidOrders.length,
      unpaidOrdersCount: orders.filter(o => o.paymentStatus !== 'PAID').length,
    };
  }, [orders]);

  // Chart data
  const chartData = useMemo(() => {
    const dateMap = new Map<string, { revenue: number; orders: number }>();
    
    orders.forEach((order) => {
      const date = order.createdAt.split('T')[0];
      const existing = dateMap.get(date) || { revenue: 0, orders: 0 };
      dateMap.set(date, {
        revenue: existing.revenue + (order.status === 'DONE' ? order.total : 0),
        orders: existing.orders + 1,
      });
    });

    return Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));
  }, [orders]);

  // Merchant summary
  const merchantSummary = useMemo<MerchantSummary[]>(() => {
    const map = new Map<string, MerchantSummary>();
    
    orders.forEach(o => {
      if (!o.merchantId) return;
      const existing = map.get(o.merchantId) || {
        merchantId: o.merchantId,
        merchantName: o.merchantName,
        totalOrders: 0,
        totalRevenue: 0,
        completedOrders: 0,
      };
      
      existing.totalOrders++;
      if (o.status === 'DONE') {
        existing.completedOrders++;
        existing.totalRevenue += o.total;
      }
      
      map.set(o.merchantId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders]);

  const exportToCSV = (type: 'transactions' | 'merchants') => {
    let csvContent = '';
    
    if (type === 'transactions') {
      const headers = ['ID', 'Merchant', 'Total', 'Ongkir', 'Status', 'Pembayaran', 'Tanggal'];
      const rows = orders.map(o => [
        o.id.slice(0, 8),
        o.merchantName,
        o.total,
        o.shippingCost,
        o.status,
        o.paymentStatus || '-',
        format(new Date(o.createdAt), 'dd/MM/yyyy HH:mm'),
      ]);
      csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    } else {
      const headers = ['Merchant', 'Total Pesanan', 'Pesanan Selesai', 'Total Pendapatan'];
      const rows = merchantSummary.map(m => [
        m.merchantName,
        m.totalOrders,
        m.completedOrders,
        m.totalRevenue,
      ]);
      csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${type}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      NEW: 'bg-info/10 text-info',
      CONFIRMED: 'bg-warning/10 text-warning',
      PROCESSING: 'bg-warning/10 text-warning',
      READY: 'bg-pending/10 text-pending',
      DELIVERING: 'bg-info/10 text-info',
      DONE: 'bg-primary/10 text-primary',
      CANCELLED: 'bg-destructive/10 text-destructive',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <AdminLayout title="Laporan Transaksi" subtitle="Analisis dan ekspor data transaksi">
      {/* Date Range Filter */}
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Total Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalOrders}</p>
            <p className="text-xs text-muted-foreground">
              {summary.completedOrders} selesai, {summary.pendingOrders} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Pendapatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              Dari {summary.completedOrders} pesanan selesai
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rata-rata Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.avgOrderValue)}</p>
            <p className="text-xs text-muted-foreground">Per transaksi selesai</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              Total Ongkir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPrice(summary.totalShipping)}</p>
            <p className="text-xs text-muted-foreground">Biaya pengiriman</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <SalesAreaChart data={chartData} title="Trend Pendapatan" />
          <OrdersBarChart data={chartData} title="Jumlah Pesanan" />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="transactions">Transaksi</TabsTrigger>
            <TabsTrigger value="merchants">Per Merchant</TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={() => exportToCSV(reportType as 'transactions' | 'merchants')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <TabsContent value="transactions">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pembayaran</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Tidak ada transaksi dalam periode ini
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">{order.id.slice(0, 8)}</TableCell>
                        <TableCell>{order.merchantName}</TableCell>
                        <TableCell className="font-medium">{formatPrice(order.total)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.paymentStatus === 'PAID' 
                              ? 'bg-primary/10 text-primary' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {order.paymentStatus || 'COD'}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(order.createdAt), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="merchants">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right">Total Pesanan</TableHead>
                  <TableHead className="text-right">Selesai</TableHead>
                  <TableHead className="text-right">Pendapatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchantSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Tidak ada data merchant
                    </TableCell>
                  </TableRow>
                ) : (
                  merchantSummary.map((m) => (
                    <TableRow key={m.merchantId}>
                      <TableCell className="font-medium">{m.merchantName}</TableCell>
                      <TableCell className="text-right">{m.totalOrders}</TableCell>
                      <TableCell className="text-right">{m.completedOrders}</TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(m.totalRevenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
