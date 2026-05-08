/**
 * S2-01: Thermal Printer via Web Serial API (ESC/POS)
 * Supports USB/Bluetooth thermal printers that use ESC/POS protocol.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CR = 0x0d;

export class ThermalPrinter {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  async connect(): Promise<boolean> {
    if (!ThermalPrinter.isSupported()) {
      throw new Error('Web Serial API tidak didukung browser ini. Gunakan Chrome/Edge terbaru.');
    }
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.writer = this.port.writable!.getWriter();
      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError') return false;
      throw err;
    }
  }

  async disconnect() {
    try {
      this.writer?.releaseLock();
      await this.port?.close();
    } catch {}
    this.port = null;
    this.writer = null;
  }

  private async write(data: number[]) {
    if (!this.writer) throw new Error('Printer tidak terhubung');
    await this.writer.write(new Uint8Array(data));
  }

  private encodeText(text: string): number[] {
    return Array.from(new TextEncoder().encode(text));
  }

  async initialize() {
    await this.write([ESC, 0x40]); // ESC @ - Initialize
  }

  async setAlign(align: 'left' | 'center' | 'right') {
    const n = align === 'left' ? 0 : align === 'center' ? 1 : 2;
    await this.write([ESC, 0x61, n]);
  }

  async setBold(on: boolean) {
    await this.write([ESC, 0x45, on ? 1 : 0]);
  }

  async setDoubleHeight(on: boolean) {
    await this.write([ESC, 0x21, on ? 0x10 : 0x00]);
  }

  async printText(text: string) {
    await this.write(this.encodeText(text));
  }

  async printLine(text: string = '') {
    await this.write([...this.encodeText(text), LF]);
  }

  async printDivider(char = '-', width = 32) {
    await this.printLine(char.repeat(width));
  }

  async printQR(data: string, size = 6) {
    const dataBytes = this.encodeText(data);
    const len = dataBytes.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    await this.write([
      GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00, // model
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, size,         // size
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30,         // error correction
      GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30,         // print QR
    ]);
  }

  async feedAndCut(lines = 4) {
    await this.write([ESC, 0x64, lines]); // Feed n lines
    await this.write([GS, 0x56, 0x41, 0x00]); // Partial cut
  }

  async printReceipt(receipt: ReceiptData) {
    await this.initialize();

    // Header
    await this.setAlign('center');
    await this.setBold(true);
    await this.setDoubleHeight(true);
    await this.printLine(receipt.storeName || 'STRUK PENJUALAN');
    await this.setDoubleHeight(false);
    await this.setBold(false);
    if (receipt.storeAddress) await this.printLine(receipt.storeAddress);
    if (receipt.storePhone) await this.printLine(receipt.storePhone);
    if (receipt.receiptHeader) await this.printLine(receipt.receiptHeader);
    await this.printLine();

    await this.setAlign('left');
    await this.printDivider();

    // Invoice info
    await this.printLine(`No : ${receipt.invoiceNo}`);
    await this.printLine(`Tgl: ${formatDate(receipt.date)}`);
    if (receipt.cashierName) await this.printLine(`Kas: ${receipt.cashierName}`);
    if (receipt.customerName) await this.printLine(`Plg: ${receipt.customerName}`);
    await this.printDivider();

    // Items
    for (const item of receipt.items) {
      const name = item.name.length > 20 ? item.name.substring(0, 20) : item.name;
      await this.printLine(name);
      const qty = `${item.qty} x ${formatCurrency(item.price)}`;
      const subtotal = formatCurrency(item.qty * item.price);
      await this.printLine(`  ${qty.padEnd(20)}${subtotal.padStart(10)}`);
      if (item.discount > 0) {
        await this.printLine(`  Diskon: -${formatCurrency(item.discount)}`);
      }
    }
    await this.printDivider();

    // Totals
    if (receipt.subtotal !== receipt.total) {
      await this.printLine(`${'Subtotal'.padEnd(20)}${formatCurrency(receipt.subtotal).padStart(12)}`);
    }
    if (receipt.discountAmount > 0) {
      await this.printLine(`${'Diskon'.padEnd(20)}${('-' + formatCurrency(receipt.discountAmount)).padStart(12)}`);
    }
    if (receipt.taxAmount > 0) {
      await this.printLine(`${'Pajak'.padEnd(20)}${formatCurrency(receipt.taxAmount).padStart(12)}`);
    }

    await this.setBold(true);
    await this.printLine(`${'TOTAL'.padEnd(20)}${formatCurrency(receipt.total).padStart(12)}`);
    await this.setBold(false);
    await this.printLine(`${'Bayar'.padEnd(20)}${formatCurrency(receipt.paidAmount).padStart(12)}`);
    await this.printLine(`${'Kembalian'.padEnd(20)}${formatCurrency(receipt.changeAmount).padStart(12)}`);
    await this.printLine(`Metode: ${receipt.paymentMethod}`);
    await this.printDivider();

    // Footer
    await this.setAlign('center');
    if (receipt.receiptFooter) await this.printLine(receipt.receiptFooter);
    else await this.printLine('Terima kasih sudah berbelanja!');

    // QR code for digital receipt
    if (receipt.qrData) {
      await this.printLine();
      await this.printQR(receipt.qrData);
      await this.printLine('Scan untuk struk digital');
    }

    await this.printLine();
    await this.feedAndCut(4);
  }

  async printProductLabel(label: LabelData) {
    await this.initialize();
    await this.setAlign('center');
    await this.setBold(true);
    await this.printLine(label.storeName || '');
    await this.setBold(false);
    await this.printDivider('=', 32);
    await this.setDoubleHeight(true);
    await this.setBold(true);
    const name = label.name.length > 16 ? label.name.substring(0, 16) : label.name;
    await this.printLine(name);
    await this.setDoubleHeight(false);
    await this.setBold(false);
    if (label.variantName) await this.printLine(label.variantName);
    await this.printLine();
    await this.setDoubleHeight(true);
    await this.setBold(true);
    await this.printLine(`Rp ${label.price.toLocaleString('id-ID')}`);
    await this.setDoubleHeight(false);
    await this.setBold(false);
    if (label.sku) await this.printLine(`SKU: ${label.sku}`);
    if (label.barcode) await this.printQR(label.barcode, 3);
    await this.printDivider('=', 32);
    await this.feedAndCut(2);
  }
}

export interface ReceiptData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  invoiceNo: string;
  date: Date;
  cashierName?: string;
  customerName?: string;
  items: Array<{ name: string; qty: number; price: number; discount: number }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  qrData?: string;
}

export interface LabelData {
  storeName?: string;
  name: string;
  variantName?: string;
  price: number;
  sku?: string;
  barcode?: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(n: number): string {
  return n.toLocaleString('id-ID');
}

// Singleton instance
let printerInstance: ThermalPrinter | null = null;

export function getPrinter(): ThermalPrinter {
  if (!printerInstance) printerInstance = new ThermalPrinter();
  return printerInstance;
}

export async function printReceiptBrowser(receipt: ReceiptData): Promise<void> {
  const lines: string[] = [];
  const W = 42;
  const c = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W);
  const r = (l: string, r: string) => (l + ' '.repeat(Math.max(1, W - l.length - r.length)) + r);
  const div = '-'.repeat(W);

  lines.push(c(receipt.storeName || 'STRUK PENJUALAN'));
  if (receipt.storeAddress) lines.push(c(receipt.storeAddress));
  if (receipt.storePhone) lines.push(c(receipt.storePhone));
  if (receipt.receiptHeader) lines.push(c(receipt.receiptHeader));
  lines.push(div);
  lines.push(`No  : ${receipt.invoiceNo}`);
  lines.push(`Tgl : ${formatDate(receipt.date)}`);
  if (receipt.cashierName) lines.push(`Kas : ${receipt.cashierName}`);
  if (receipt.customerName) lines.push(`Plg : ${receipt.customerName}`);
  lines.push(div);
  for (const item of receipt.items) {
    lines.push(item.name);
    lines.push(r(`  ${item.qty}x ${formatCurrency(item.price)}`, formatCurrency(item.qty * item.price)));
    if (item.discount > 0) lines.push(`  Diskon: -${formatCurrency(item.discount)}`);
  }
  lines.push(div);
  if (receipt.subtotal !== receipt.total) lines.push(r('Subtotal', formatCurrency(receipt.subtotal)));
  if (receipt.discountAmount > 0) lines.push(r('Diskon', `-${formatCurrency(receipt.discountAmount)}`));
  if (receipt.taxAmount > 0) lines.push(r('Pajak', formatCurrency(receipt.taxAmount)));
  lines.push(r('TOTAL', formatCurrency(receipt.total)));
  lines.push(r('Bayar', formatCurrency(receipt.paidAmount)));
  lines.push(r('Kembalian', formatCurrency(receipt.changeAmount)));
  lines.push(`Metode: ${receipt.paymentMethod}`);
  lines.push(div);
  lines.push(c(receipt.receiptFooter || 'Terima kasih sudah berbelanja!'));

  const content = lines.join('\n');
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) { alert('Aktifkan popup untuk mencetak struk.'); return; }
  win.document.write(`
    <html><head><title>Struk</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 8px; }
      pre { white-space: pre-wrap; word-wrap: break-word; }
      @media print { @page { margin: 2mm; size: 80mm auto; } }
    </style></head>
    <body><pre>${content}</pre>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>
  `);
  win.document.close();
}
