import { useState } from 'react';
import { POSLayout } from '@/components/pos/POSLayout';
import { usePOS } from '@/contexts/POSContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Download, FileText, BookOpen, Calendar, TrendingUp,
  CreditCard, Wallet, Package, Info, RefreshCw
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface JournalEntry {
  date: string;
  ref: string;
  description: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

const ACCOUNT_MAP = {
  sales: { code: '4-1000', name: 'Pendapatan Penjualan' },
  cogs: { code: '5-1000', name: 'Harga Pokok Penjualan' },
  inventory: { code: '1-2000', name: 'Persediaan Barang' },
  cash: { code: '1-1100', name: 'Kas' },
  bank: { code: '1-1200', name: 'Bank' },
  qris: { code: '1-1300', name: 'Rekening QRIS' },
  receivable: { code: '1-1500', name: 'Piutang Usaha' },
  payable: { code: '2-1000', name: 'Utang Dagang' },
  return_in: { code: '4-1100', name: 'Retur Penjualan' },
  return_out: { code: '5-1100', name: 'Retur Pembelian' },
};

const EXPORT_FORMATS = [
  { value: 'jurnal_umum', label: 'Jurnal Umum (General Journal)' },
  { value: 'accurate', label: 'Format Accurate Online' },
  { value: 'myob', label: 'Format MYOB AccountRight' },
  { value: 'zahir', label: 'Format Zahir Accounting' },
];

export default function POSAkuntansiPage() {
  const { tenant, activeOutlet, formatCurrency } = usePOS();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportFormat, setExportFormat] = useState('jurnal_umum');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

  const setPreset = (preset: string) => {
    const now = new Date();
    if (preset === 'this_month') {
      setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
      setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else if (preset === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setDateFrom(format(startOfMonth(lm), 'yyyy-MM-dd'));
      setDateTo(format(endOfMonth(lm), 'yyyy-MM-dd'));
    } else if (preset === 'this_year') {
      setDateFrom(format(startOfYear(now), 'yyyy-MM-dd'));
      setDateTo(format(endOfYear(now), 'yyyy-MM-dd'));
    }
  };

  const generateJournal = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const from = new Date(dateFrom + 'T00:00:00').toISOString();
      const to = new Date(dateTo + 'T23:59:59').toISOString();

      const [salesRes, returRes, purchaseRes] = await Promise.all([
        (supabase as any).from('pos_sales')
          .select('id, sale_number, total_amount, payment_method, payment_amount, created_at, pos_sale_items(quantity, unit_price, total_price, cost_price)')
          .eq('tenant_id', tenant.id)
          .eq('status', 'completed')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at'),
        (supabase as any).from('pos_returns')
          .select('id, return_number, total_amount, created_at')
          .eq('tenant_id', tenant.id)
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at'),
        (supabase as any).from('pos_purchases')
          .select('id, po_number, total_amount, created_at, status')
          .eq('tenant_id', tenant.id)
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at'),
      ]);

      const journal: JournalEntry[] = [];

      // Sales entries
      for (const sale of (salesRes.data || []) as any[]) {
        const dateStr = format(parseISO(sale.created_at), 'dd/MM/yyyy');
        const cashAccount = sale.payment_method === 'qris'
          ? ACCOUNT_MAP.qris
          : sale.payment_method === 'transfer'
          ? ACCOUNT_MAP.bank
          : ACCOUNT_MAP.cash;

        // Debit: Kas/Bank/QRIS
        journal.push({
          date: dateStr,
          ref: sale.sale_number,
          description: `Penjualan ${sale.sale_number}`,
          account_code: cashAccount.code,
          account_name: cashAccount.name,
          debit: Number(sale.total_amount),
          credit: 0,
        });
        // Credit: Pendapatan
        journal.push({
          date: dateStr,
          ref: sale.sale_number,
          description: `Penjualan ${sale.sale_number}`,
          account_code: ACCOUNT_MAP.sales.code,
          account_name: ACCOUNT_MAP.sales.name,
          debit: 0,
          credit: Number(sale.total_amount),
        });

        // COGS entries
        const items = (sale.pos_sale_items || []) as any[];
        const totalCogs = items.reduce((s: number, i: any) => s + Number(i.cost_price || 0) * Number(i.quantity), 0);
        if (totalCogs > 0) {
          journal.push({
            date: dateStr,
            ref: sale.sale_number,
            description: `HPP ${sale.sale_number}`,
            account_code: ACCOUNT_MAP.cogs.code,
            account_name: ACCOUNT_MAP.cogs.name,
            debit: totalCogs,
            credit: 0,
          });
          journal.push({
            date: dateStr,
            ref: sale.sale_number,
            description: `HPP ${sale.sale_number}`,
            account_code: ACCOUNT_MAP.inventory.code,
            account_name: ACCOUNT_MAP.inventory.name,
            debit: 0,
            credit: totalCogs,
          });
        }
      }

      // Return entries
      for (const ret of (returRes.data || []) as any[]) {
        const dateStr = format(parseISO(ret.created_at), 'dd/MM/yyyy');
        journal.push({
          date: dateStr,
          ref: ret.return_number,
          description: `Retur Penjualan ${ret.return_number}`,
          account_code: ACCOUNT_MAP.return_in.code,
          account_name: ACCOUNT_MAP.return_in.name,
          debit: Number(ret.total_amount),
          credit: 0,
        });
        journal.push({
          date: dateStr,
          ref: ret.return_number,
          description: `Retur Penjualan ${ret.return_number}`,
          account_code: ACCOUNT_MAP.cash.code,
          account_name: ACCOUNT_MAP.cash.name,
          debit: 0,
          credit: Number(ret.total_amount),
        });
      }

      // Purchase entries
      for (const po of (purchaseRes.data || []) as any[]) {
        if (po.status !== 'received') continue;
        const dateStr = format(parseISO(po.created_at), 'dd/MM/yyyy');
        journal.push({
          date: dateStr,
          ref: po.po_number,
          description: `Pembelian ${po.po_number}`,
          account_code: ACCOUNT_MAP.inventory.code,
          account_name: ACCOUNT_MAP.inventory.name,
          debit: Number(po.total_amount),
          credit: 0,
        });
        journal.push({
          date: dateStr,
          ref: po.po_number,
          description: `Pembelian ${po.po_number}`,
          account_code: ACCOUNT_MAP.payable.code,
          account_name: ACCOUNT_MAP.payable.name,
          debit: 0,
          credit: Number(po.total_amount),
        });
      }

      const sumD = journal.reduce((s, e) => s + e.debit, 0);
      const sumC = journal.reduce((s, e) => s + e.credit, 0);
      setTotalDebit(sumD);
      setTotalCredit(sumC);
      setEntries(journal);

      if (journal.length === 0) {
        toast.info('Tidak ada transaksi pada periode ini');
      } else {
        toast.success(`${journal.length} entri jurnal digenerate`);
      }
    } catch (err) {
      toast.error('Gagal mengambil data transaksi');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (entries.length === 0) { toast.error('Generate jurnal terlebih dahulu'); return; }

    let rows: string[][];
    if (exportFormat === 'accurate') {
      rows = [
        ['Tanggal', 'No. Ref', 'Keterangan', 'Kode Akun', 'Nama Akun', 'Debet', 'Kredit'],
        ...entries.map(e => [e.date, e.ref, e.description, e.account_code, e.account_name, e.debit.toString(), e.credit.toString()]),
      ];
    } else if (exportFormat === 'myob') {
      rows = [
        ['Date', 'Memo', 'Account Number', 'Name', 'Debit Amount', 'Credit Amount'],
        ...entries.map(e => [e.date, `${e.ref} - ${e.description}`, e.account_code, e.account_name, e.debit.toString(), e.credit.toString()]),
      ];
    } else if (exportFormat === 'zahir') {
      rows = [
        ['TGL', 'NO_REF', 'URAIAN', 'KODE_AKU', 'NAMA_AKUN', 'DEBET', 'KREDIT'],
        ...entries.map(e => [e.date, e.ref, e.description, e.account_code, e.account_name, e.debit.toString(), e.credit.toString()]),
      ];
    } else {
      rows = [
        ['Tanggal', 'Referensi', 'Keterangan', 'Kode Akun', 'Nama Akun', 'Debet', 'Kredit'],
        ...entries.map(e => [e.date, e.ref, e.description, e.account_code, e.account_name, e.debit.toString(), e.credit.toString()]),
        [],
        ['', '', '', '', 'TOTAL', totalDebit.toString(), totalCredit.toString()],
      ];
    }

    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jurnal-${exportFormat}-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File jurnal berhasil diunduh');
  };

  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  return (
    <POSLayout
      title="Ekspor Akuntansi"
      subtitle="Generate jurnal umum dan ekspor ke software akuntansi"
      actions={
        entries.length > 0 ? (
          <Button onClick={exportCSV} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Download className="h-4 w-4" /> Unduh CSV
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Info */}
        <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Catatan Pemakaian</p>
            <p>Ekspor jurnal umum berbasis transaksi POS. Pastikan <strong>harga pokok (cost price)</strong> produk sudah diisi agar HPP akurat. File CSV ini dapat diimport langsung ke Accurate Online, MYOB AccountRight, atau Zahir Accounting.</p>
          </div>
        </div>

        {/* Account Map Reference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-600" /> Peta Akun yang Digunakan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.values(ACCOUNT_MAP).map(acc => (
                <div key={acc.code} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <code className="text-xs text-violet-700 font-mono font-medium">{acc.code}</code>
                  <span className="text-xs text-gray-600">{acc.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Periode & Format Ekspor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="text-xs mb-1 block">Dari Tanggal</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Sampai Tanggal</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Format Ekspor</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_FORMATS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-xs text-muted-foreground">Preset:</span>
              {['this_month', 'last_month', 'this_year'].map(p => (
                <Button key={p} variant="outline" size="sm" className="text-xs h-7" onClick={() => setPreset(p)}>
                  {p === 'this_month' ? 'Bulan Ini' : p === 'last_month' ? 'Bulan Lalu' : 'Tahun Ini'}
                </Button>
              ))}
            </div>
            <Button onClick={generateJournal} disabled={loading} className="w-full md:w-auto gap-2">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {loading ? 'Memproses...' : 'Generate Jurnal'}
            </Button>
          </CardContent>
        </Card>

        {/* Journal Table */}
        {entries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" /> Jurnal Umum ({entries.length} entri)
                </CardTitle>
                <div className="flex items-center gap-3">
                  {isBalanced ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ Seimbang</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 text-xs">⚠ Tidak Seimbang</Badge>
                  )}
                  <Button size="sm" onClick={exportCSV} className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Ref</TableHead>
                      <TableHead className="text-xs">Keterangan</TableHead>
                      <TableHead className="text-xs">Kode Akun</TableHead>
                      <TableHead className="text-xs">Nama Akun</TableHead>
                      <TableHead className="text-xs text-right">Debet</TableHead>
                      <TableHead className="text-xs text-right">Kredit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e, i) => (
                      <TableRow key={i} className={i % 4 < 2 ? 'bg-white' : 'bg-gray-50/50'}>
                        <TableCell className="text-xs whitespace-nowrap">{e.date}</TableCell>
                        <TableCell className="text-xs font-mono">{e.ref}</TableCell>
                        <TableCell className="text-xs">{e.description}</TableCell>
                        <TableCell className="text-xs font-mono text-violet-700">{e.account_code}</TableCell>
                        <TableCell className="text-xs">{e.account_name}</TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {e.debit > 0 ? formatCurrency(e.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {e.credit > 0 ? formatCurrency(e.credit) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-gray-300 font-bold bg-gray-100">
                      <TableCell colSpan={5} className="text-xs font-bold text-right">TOTAL</TableCell>
                      <TableCell className="text-xs text-right text-emerald-700">{formatCurrency(totalDebit)}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-700">{formatCurrency(totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </POSLayout>
  );
}
