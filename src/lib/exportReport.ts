/**
 * S6-04: Export laporan ke PDF dan Excel
 * Utility untuk semua halaman laporan POS dan marketplace.
 */

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'currency' | 'date' | 'percent' | 'number' | 'text';
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
  summary?: Record<string, { label: string; value: string | number }>;
  storeName?: string;
  period?: string;
}

function formatCell(value: any, format?: string): string {
  if (value === null || value === undefined) return '-';
  switch (format) {
    case 'currency':
      return `Rp ${Number(value).toLocaleString('id-ID')}`;
    case 'date':
      return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return Number(value).toLocaleString('id-ID');
    default:
      return String(value);
  }
}

/** Export to CSV (compatible with Excel) */
export function exportToCSV(options: ExportOptions): void {
  const { title, columns, rows, filename, period, storeName } = options;
  const lines: string[] = [];

  // Header info
  if (storeName) lines.push(`"${storeName}"`);
  lines.push(`"${title}"`);
  if (period) lines.push(`"Periode: ${period}"`);
  lines.push('');

  // Column headers
  lines.push(columns.map((c) => `"${c.header}"`).join(','));

  // Data rows
  for (const row of rows) {
    lines.push(
      columns.map((c) => {
        const val = formatCell(row[c.key], c.format);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
  }

  // Summary
  if (options.summary) {
    lines.push('');
    for (const [, v] of Object.entries(options.summary)) {
      lines.push(`"${v.label}","${typeof v.value === 'number' ? formatCell(v.value, 'currency') : v.value}"`);
    }
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/** Export to PDF via browser print */
export async function exportToPDF(options: ExportOptions): Promise<void> {
  const { title, columns, rows, filename, period, storeName, subtitle, summary } = options;

  const tableRows = rows.map((row) =>
    `<tr>${columns.map((c) => `<td>${formatCell(row[c.key], c.format)}</td>`).join('')}</tr>`
  ).join('');

  const summaryRows = summary
    ? Object.entries(summary).map(([, v]) =>
        `<tr class="summary-row"><td colspan="${Math.max(1, columns.length - 1)}">${v.label}</td><td><strong>${typeof v.value === 'number' ? formatCell(v.value, 'currency') : v.value}</strong></td></tr>`
      ).join('')
    : '';

  const html = `<!DOCTYPE html><html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #10b981; padding-bottom: 12px; }
    .header h1 { font-size: 16px; color: #10b981; }
    .header h2 { font-size: 13px; margin: 4px 0; }
    .header p { font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #10b981; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
    tr:nth-child(even) td { background: #f9fafb; }
    .summary-row td { background: #f0fdf4 !important; font-weight: 600; border-top: 2px solid #10b981; }
    .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
    @media print {
      @page { margin: 15mm; size: A4; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${storeName ? `<h2>${storeName}</h2>` : ''}
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
    ${period ? `<p>Periode: ${period}</p>` : ''}
    <p>Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  <table>
    <thead><tr>${columns.map((c) => `<th>${c.header}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}${summaryRows}</tbody>
  </table>
  <div class="footer">Laporan dibuat oleh DesaMart UMKM Platform</div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Aktifkan popup untuk mencetak PDF.'); return; }
  win.document.write(html);
  win.document.close();
}

/** Export POS transactions to Excel-compatible CSV */
export function exportPOSSales(sales: any[], period: string, storeName?: string) {
  exportToCSV({
    title: 'Laporan Penjualan POS',
    storeName,
    period,
    filename: `laporan-penjualan-${Date.now()}`,
    columns: [
      { header: 'No. Invoice', key: 'invoice_no' },
      { header: 'Tanggal', key: 'created_at', format: 'date' },
      { header: 'Kasir', key: 'cashier_name' },
      { header: 'Pelanggan', key: 'customer_name' },
      { header: 'Subtotal', key: 'subtotal', format: 'currency' },
      { header: 'Diskon', key: 'discount_amount', format: 'currency' },
      { header: 'Pajak', key: 'tax_amount', format: 'currency' },
      { header: 'Total', key: 'total', format: 'currency' },
      { header: 'Metode Bayar', key: 'payment_method' },
      { header: 'Status', key: 'status' },
    ],
    rows: sales,
    summary: {
      total: { label: 'Total Omzet', value: sales.reduce((s, r) => s + Number(r.total || 0), 0) },
      count: { label: 'Jumlah Transaksi', value: sales.length },
    },
  });
}

/** Export POS products report */
export function exportPOSProducts(products: any[], storeName?: string) {
  exportToCSV({
    title: 'Laporan Produk POS',
    storeName,
    filename: `laporan-produk-${Date.now()}`,
    columns: [
      { header: 'Nama Produk', key: 'name' },
      { header: 'SKU', key: 'sku' },
      { header: 'Kategori', key: 'category_name' },
      { header: 'Harga Jual', key: 'price', format: 'currency' },
      { header: 'Harga Modal', key: 'cost_price', format: 'currency' },
      { header: 'Stok', key: 'stock', format: 'number' },
      { header: 'Total Terjual', key: 'total_sold', format: 'number' },
      { header: 'Omzet', key: 'revenue', format: 'currency' },
      { header: 'Status', key: 'status' },
    ],
    rows: products,
  });
}

/** Export marketplace orders */
export function exportMarketplaceOrders(orders: any[], period: string) {
  exportToCSV({
    title: 'Laporan Pesanan Marketplace',
    period,
    filename: `laporan-pesanan-${Date.now()}`,
    columns: [
      { header: 'No. Pesanan', key: 'order_number' },
      { header: 'Tanggal', key: 'created_at', format: 'date' },
      { header: 'Pembeli', key: 'buyer_name' },
      { header: 'Merchant', key: 'merchant_name' },
      { header: 'Subtotal', key: 'subtotal', format: 'currency' },
      { header: 'Ongkir', key: 'shipping_cost', format: 'currency' },
      { header: 'Total', key: 'total', format: 'currency' },
      { header: 'Status', key: 'status' },
      { header: 'Metode Bayar', key: 'payment_method' },
    ],
    rows: orders,
    summary: {
      total: { label: 'Total GMV', value: orders.reduce((s, r) => s + Number(r.total || 0), 0) },
      count: { label: 'Jumlah Pesanan', value: orders.length },
    },
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
