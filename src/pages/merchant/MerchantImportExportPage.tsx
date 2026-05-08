import { useState, useRef } from 'react';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  Package, RefreshCw, Eye, Trash2, Plus, Info
} from 'lucide-react';
import { MerchantLayout } from '@/components/merchant/MerchantLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantGuard } from '@/hooks/useMerchantGuard';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string;
  is_active: boolean;
  is_promo: boolean;
  view_count: number | null;
  order_count: number | null;
  created_at: string;
}

interface ImportRow {
  rowNum: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  is_active: boolean;
  is_promo: boolean;
  errors: string[];
  valid: boolean;
}

const VALID_CATEGORIES = ['kuliner', 'fashion', 'kriya', 'wisata', 'kerajinan', 'pertanian', 'minuman', 'jasa', 'lainnya'];

const CSV_TEMPLATE_HEADER = 'nama_produk,deskripsi,harga,stok,kategori,aktif,promo';
const CSV_TEMPLATE_ROWS = [
  'Contoh Produk A,Deskripsi produk A yang menarik,25000,50,kuliner,ya,tidak',
  'Contoh Produk B,Produk kerajinan tangan,75000,10,kerajinan,ya,ya',
  'Contoh Produk C,,15000,100,minuman,ya,tidak',
];

function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function validateImportRow(raw: string[], rowNum: number): ImportRow {
  const [name = '', description = '', priceStr = '', stockStr = '', category = '', activeStr = '', promoStr = ''] = raw;
  const errors: string[] = [];

  if (!name.trim()) errors.push('Nama produk wajib diisi');
  const price = parseInt(priceStr.replace(/\D/g, ''));
  if (isNaN(price) || price <= 0) errors.push('Harga harus angka lebih dari 0');
  const stock = parseInt(stockStr);
  if (isNaN(stock) || stock < 0) errors.push('Stok harus angka >= 0');
  const cat = category.trim().toLowerCase();
  if (!VALID_CATEGORIES.includes(cat)) errors.push(`Kategori tidak valid (gunakan: ${VALID_CATEGORIES.join(', ')})`);
  const is_active = !['tidak', 'no', 'false', '0'].includes(activeStr.trim().toLowerCase());
  const is_promo = ['ya', 'yes', 'true', '1'].includes(promoStr.trim().toLowerCase());

  return {
    rowNum,
    name: name.trim(),
    description: description.trim(),
    price: isNaN(price) ? 0 : price,
    stock: isNaN(stock) ? 0 : stock,
    category: cat,
    is_active,
    is_promo,
    errors,
    valid: errors.length === 0,
  };
}

export default function MerchantImportExportPage() {
  const { merchantId, loading: guardLoading } = useMerchantGuard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState<{ success: number; failed: number } | null>(null);
  const [fileLoaded, setFileLoaded] = useState(false);

  const { data: products = [], isLoading: productsLoading, refetch } = useQuery<ProductRow[]>({
    queryKey: ['merchant-products-export', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price, stock, category, is_active, is_promo, view_count, order_count, created_at')
        .eq('merchant_id', merchantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId && !guardLoading,
    staleTime: 30_000,
  });

  const downloadTemplate = () => {
    const content = [CSV_TEMPLATE_HEADER, ...CSV_TEMPLATE_ROWS].join('\n');
    downloadCSV('template_produk_desamart.csv', content);
    toast.success('Template CSV berhasil diunduh');
  };

  const exportProducts = () => {
    if (products.length === 0) {
      toast.error('Tidak ada produk untuk diekspor');
      return;
    }
    const header = 'nama_produk,deskripsi,harga,stok,kategori,aktif,promo,dilihat,terjual,dibuat';
    const rows = products.map(p =>
      [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""')}"`,
        p.price,
        p.stock,
        p.category,
        p.is_active ? 'ya' : 'tidak',
        p.is_promo ? 'ya' : 'tidak',
        p.view_count || 0,
        p.order_count || 0,
        format(new Date(p.created_at), 'dd/MM/yyyy', { locale: idLocale }),
      ].join(',')
    );
    const content = [header, ...rows].join('\n');
    downloadCSV(`produk_${format(new Date(), 'yyyyMMdd')}.csv`, content);
    toast.success(`${products.length} produk berhasil diekspor`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Hanya file CSV yang didukung');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('File CSV kosong atau tidak ada data');
        return;
      }
      const dataLines = lines.slice(1); // skip header
      const parsed = dataLines.map((line, i) => validateImportRow(parseCSVLine(line), i + 2));
      setImportRows(parsed);
      setFileLoaded(true);
      setImportDone(null);
      if (e.target) e.target.value = '';
      toast.success(`${parsed.length} baris berhasil dibaca`);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const startImport = async () => {
    if (!merchantId) return;
    const validRows = importRows.filter(r => r.valid);
    if (validRows.length === 0) {
      toast.error('Tidak ada baris yang valid untuk diimpor');
      return;
    }
    setImporting(true);
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const { error } = await supabase.from('products').insert({
          merchant_id: merchantId,
          name: row.name,
          description: row.description || null,
          price: row.price,
          stock: row.stock,
          category: row.category,
          is_active: row.is_active,
          is_promo: row.is_promo,
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImporting(false);
    setImportDone({ success, failed });
    setImportRows([]);
    setFileLoaded(false);
    refetch();
    toast.success(`Import selesai: ${success} berhasil, ${failed} gagal`);
  };

  const clearImport = () => {
    setImportRows([]);
    setFileLoaded(false);
    setImportDone(null);
  };

  const validCount = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;

  if (guardLoading) {
    return (
      <MerchantLayout title="Import & Export Produk" subtitle="Kelola produk secara massal">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout title="Import & Export Produk" subtitle="Upload/download produk via CSV secara massal">
      <div className="space-y-6">
        <Tabs defaultValue="import">
          <TabsList>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-1.5" />Import Produk
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-1.5" />Export Produk
            </TabsTrigger>
          </TabsList>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    Langkah 1 — Download Template
                  </CardTitle>
                  <CardDescription>Download dulu template CSV agar format benar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Kolom wajib:</strong> nama_produk, harga, stok, kategori<br />
                      <strong>Kategori valid:</strong> {VALID_CATEGORIES.join(', ')}<br />
                      <strong>aktif/promo:</strong> isi <code className="bg-muted px-1 rounded">ya</code> atau <code className="bg-muted px-1 rounded">tidak</code>
                    </AlertDescription>
                  </Alert>
                  <Button className="w-full" variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template CSV
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-4 w-4 text-blue-600" />
                    Langkah 2 — Upload File CSV
                  </CardTitle>
                  <CardDescription>Upload file CSV yang sudah diisi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Klik untuk pilih file CSV</p>
                    <p className="text-xs text-muted-foreground mt-1">Hanya file .csv</p>
                  </div>
                  <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Pilih File CSV
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Import Result */}
            {importDone && (
              <Alert className={importDone.failed === 0 ? 'border-green-500' : 'border-orange-500'}>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Import selesai!</strong> {importDone.success} produk berhasil ditambahkan
                  {importDone.failed > 0 && `, ${importDone.failed} gagal`}.
                </AlertDescription>
              </Alert>
            )}

            {/* Importing Progress */}
            {importing && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm font-medium mb-3 text-center">Mengimpor produk... {importProgress}%</p>
                  <Progress value={importProgress} />
                </CardContent>
              </Card>
            )}

            {/* Preview Table */}
            {fileLoaded && importRows.length > 0 && !importing && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Preview Data ({importRows.length} baris)</CardTitle>
                      <CardDescription>
                        <span className="text-green-600">{validCount} valid</span>
                        {invalidCount > 0 && <span className="text-red-600 ml-2">{invalidCount} ada error</span>}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={clearImport}>
                        <Trash2 className="h-4 w-4 mr-1" />Batal
                      </Button>
                      <Button
                        size="sm"
                        onClick={startImport}
                        disabled={validCount === 0}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Import {validCount} Produk
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Harga</TableHead>
                          <TableHead>Stok</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Aktif</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRows.map(row => (
                          <TableRow key={row.rowNum} className={row.valid ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                            <TableCell className="text-xs text-muted-foreground">{row.rowNum}</TableCell>
                            <TableCell className="font-medium text-sm max-w-[180px] truncate">{row.name || <span className="text-muted-foreground italic">kosong</span>}</TableCell>
                            <TableCell className="text-sm">{row.price > 0 ? formatPrice(row.price) : <span className="text-red-500">-</span>}</TableCell>
                            <TableCell className="text-sm">{row.stock}</TableCell>
                            <TableCell className="text-sm">{row.category || <span className="text-red-500">-</span>}</TableCell>
                            <TableCell>
                              <Badge variant={row.is_active ? 'default' : 'secondary'} className="text-xs">
                                {row.is_active ? 'Ya' : 'Tidak'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.valid ? (
                                <span className="flex items-center gap-1 text-green-600 text-xs">
                                  <CheckCircle2 className="h-3 w-3" />Valid
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-600 text-xs" title={row.errors.join(', ')}>
                                  <XCircle className="h-3 w-3" />{row.errors[0]}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-600" />
                  Export Semua Produk
                </CardTitle>
                <CardDescription>
                  Download semua {products.length} produk Anda dalam format CSV. Bisa dibuka di Excel/Google Sheets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Total Produk</p>
                    <p className="font-bold text-lg">{products.length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Aktif</p>
                    <p className="font-bold text-lg text-green-600">{products.filter(p => p.is_active).length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Non-aktif</p>
                    <p className="font-bold text-lg text-muted-foreground">{products.filter(p => !p.is_active).length}</p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={exportProducts}
                  disabled={productsLoading || products.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export {products.length} Produk ke CSV
                </Button>
              </CardContent>
            </Card>

            {/* Product Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Daftar Produk</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Belum ada produk</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama Produk</TableHead>
                          <TableHead>Harga</TableHead>
                          <TableHead>Stok</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Dilihat</TableHead>
                          <TableHead>Terjual</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.slice(0, 50).map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.name}</TableCell>
                            <TableCell className="text-sm">{formatPrice(p.price)}</TableCell>
                            <TableCell className="text-sm">
                              <span className={p.stock <= 5 ? 'text-red-600 font-medium' : ''}>{p.stock}</span>
                            </TableCell>
                            <TableCell className="text-sm capitalize">{p.category}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.view_count || 0}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.order_count || 0}</TableCell>
                            <TableCell>
                              <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">
                                {p.is_active ? 'Aktif' : 'Non-aktif'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {products.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">Menampilkan 50 dari {products.length} produk. Export CSV untuk semua data.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MerchantLayout>
  );
}
