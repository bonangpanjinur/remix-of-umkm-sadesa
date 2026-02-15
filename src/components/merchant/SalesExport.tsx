import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesExportProps {
  merchantId: string;
  merchantName?: string;
}

export function SalesExport({ merchantId, merchantName }: SalesExportProps) {
  const [period, setPeriod] = useState('this_month');
  const [exporting, setExporting] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'this_week': {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: start.toISOString(), end: now.toISOString() };
      }
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { start: start.toISOString(), end: end.toISOString() };
      }
      default:
        return { start: new Date(now.getFullYear(), 0, 1).toISOString(), end: now.toISOString() };
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { start, end } = getDateRange();

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, status, total, subtotal, shipping_cost, created_at, payment_method,
          order_items(product_name, quantity, subtotal)
        `)
        .eq('merchant_id', merchantId)
        .gte('created_at', start)
        .lte('created_at', end)
        .in('status', ['DONE', 'DELIVERED'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!orders || orders.length === 0) {
        toast.info('Tidak ada data penjualan untuk periode ini');
        return;
      }

      const doc = new jsPDF();

      // Header
      doc.setFontSize(16);
      doc.text(`Laporan Penjualan - ${merchantName || 'Toko'}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Periode: ${new Date(start).toLocaleDateString('id-ID')} - ${new Date(end).toLocaleDateString('id-ID')}`, 14, 28);
      doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 34);

      // Summary
      const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
      const totalShipping = orders.reduce((s, o) => s + o.shipping_cost, 0);
      doc.setFontSize(12);
      doc.text(`Total Pesanan: ${orders.length}`, 14, 44);
      doc.text(`Total Pendapatan: ${formatPrice(totalRevenue)}`, 14, 50);
      doc.text(`Total Ongkir: ${formatPrice(totalShipping)}`, 14, 56);

      // Table
      const tableData = orders.map(o => [
        new Date(o.created_at).toLocaleDateString('id-ID'),
        `#${o.id.slice(0, 8)}`,
        o.order_items?.map((i: any) => `${i.product_name} (${i.quantity}x)`).join(', ') || '-',
        o.payment_method || '-',
        formatPrice(o.subtotal),
        formatPrice(o.shipping_cost),
        formatPrice(o.total),
      ]);

      autoTable(doc, {
        startY: 64,
        head: [['Tanggal', 'ID', 'Produk', 'Bayar', 'Subtotal', 'Ongkir', 'Total']],
        body: tableData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`laporan-penjualan-${period}.pdf`);
      toast.success('Laporan berhasil diunduh');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Gagal mengekspor laporan');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const { start, end } = getDateRange();

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, status, total, subtotal, shipping_cost, created_at, payment_method,
          order_items(product_name, quantity, subtotal)
        `)
        .eq('merchant_id', merchantId)
        .gte('created_at', start)
        .lte('created_at', end)
        .in('status', ['DONE', 'DELIVERED'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!orders || orders.length === 0) {
        toast.info('Tidak ada data');
        return;
      }

      const headers = 'Tanggal,ID Pesanan,Produk,Metode Bayar,Subtotal,Ongkir,Total\n';
      const rows = orders.map(o =>
        `${new Date(o.created_at).toLocaleDateString('id-ID')},${o.id.slice(0, 8)},"${o.order_items?.map((i: any) => `${i.product_name}(${i.quantity}x)`).join('; ') || '-'}",${o.payment_method || '-'},${o.subtotal},${o.shipping_cost},${o.total}`
      ).join('\n');

      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-penjualan-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV berhasil diunduh');
    } catch (error) {
      toast.error('Gagal mengekspor CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this_week">Minggu Ini</SelectItem>
          <SelectItem value="this_month">Bulan Ini</SelectItem>
          <SelectItem value="last_month">Bulan Lalu</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
        <FileText className="h-4 w-4 mr-1" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
        <Download className="h-4 w-4 mr-1" />
        CSV
      </Button>
    </div>
  );
}
