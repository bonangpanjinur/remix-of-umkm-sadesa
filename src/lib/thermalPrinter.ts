/**
 * Thermal Printer — Universal ESC/POS driver
 * Supports: USB (Web Serial API), WiFi (TCP via server proxy), Bluetooth (Web Bluetooth UART)
 */

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

declare global { interface Navigator { serial: any; bluetooth: any; } }

// ─── Settings ────────────────────────────────────────────────────────────────

export type ConnectionType = "usb" | "wifi" | "bluetooth";
export type PaperWidth = 58 | 80;

export interface PrinterSettings {
  connectionType: ConnectionType;
  wifiIp: string;
  wifiPort: number;
  baudRate: number;
  paperWidth: PaperWidth;
  autoPrint: boolean;
  printCopies: number;
}

const SETTINGS_KEY = "pos_printer_settings";

export const DEFAULT_SETTINGS: PrinterSettings = {
  connectionType: "usb",
  wifiIp: "",
  wifiPort: 9100,
  baudRate: 9600,
  paperWidth: 80,
  autoPrint: false,
  printCopies: 1,
};

export function getPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function savePrinterSettings(s: PrinterSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── ESC/POS Builder ─────────────────────────────────────────────────────────

function enc(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("id-ID", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtCur(n: number): string {
  return n.toLocaleString("id-ID");
}

function buildReceiptBytes(receipt: ReceiptData, paperWidth: PaperWidth): number[] {
  const W = paperWidth === 58 ? 32 : 42;
  const bytes: number[] = [];

  const push = (...b: number[]) => bytes.push(...b);
  const text = (t: string) => bytes.push(...enc(t));
  const line = (t = "") => bytes.push(...enc(t), LF);
  const div  = (c = "-") => line(c.repeat(W));

  const center = (t: string) => {
    const pad = Math.max(0, Math.floor((W - t.length) / 2));
    line(" ".repeat(pad) + t);
  };
  const row = (l: string, r: string) => {
    const gap = Math.max(1, W - l.length - r.length);
    line(l + " ".repeat(gap) + r);
  };

  // ESC @ initialize
  push(ESC, 0x40);

  // Center align
  push(ESC, 0x61, 1);
  // Bold + double height
  push(ESC, 0x45, 1, ESC, 0x21, 0x10);
  line(receipt.storeName || "STRUK PENJUALAN");
  push(ESC, 0x21, 0x00, ESC, 0x45, 0);

  if (receipt.storeAddress) center(receipt.storeAddress);
  if (receipt.storePhone)   center(receipt.storePhone);
  if (receipt.receiptHeader) center(receipt.receiptHeader);
  push(LF);

  // Left align
  push(ESC, 0x61, 0);
  div();

  line(`No  : ${receipt.invoiceNo}`);
  line(`Tgl : ${fmtDate(receipt.date)}`);
  if (receipt.cashierName)  line(`Kas : ${receipt.cashierName}`);
  if (receipt.customerName) line(`Plg : ${receipt.customerName}`);
  div();

  for (const item of receipt.items) {
    const name = item.name.length > W - 2 ? item.name.substring(0, W - 2) : item.name;
    line(name);
    row(`  ${item.qty}x ${fmtCur(item.price)}`, fmtCur(item.qty * item.price));
    if (item.discount > 0) line(`  Diskon: -${fmtCur(item.discount)}`);
  }
  div();

  if (receipt.subtotal !== receipt.total) row("Subtotal", fmtCur(receipt.subtotal));
  if (receipt.discountAmount > 0) row("Diskon", `-${fmtCur(receipt.discountAmount)}`);
  if (receipt.taxAmount > 0) row("Pajak", fmtCur(receipt.taxAmount));

  push(ESC, 0x45, 1);
  row("TOTAL", fmtCur(receipt.total));
  push(ESC, 0x45, 0);

  row("Bayar", fmtCur(receipt.paidAmount));
  row("Kembalian", fmtCur(receipt.changeAmount));
  line(`Metode: ${receipt.paymentMethod}`);
  div();

  // Footer center
  push(ESC, 0x61, 1);
  line(receipt.receiptFooter || "Terima kasih sudah berbelanja!");

  // QR code
  if (receipt.qrData) {
    push(LF);
    const qBytes = enc(receipt.qrData);
    const len = qBytes.length + 3;
    push(
      GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 6,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30,
      GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...qBytes,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30,
    );
    line("Scan untuk struk digital");
  }

  push(LF, LF, LF, LF);
  // Partial cut
  push(GS, 0x56, 0x41, 0x00);

  return bytes;
}

// ─── USB Printer (Web Serial) ─────────────────────────────────────────────────

export class USBPrinter {
  private port: any = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  connected = false;

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async connect(baudRate = 9600): Promise<boolean> {
    if (!USBPrinter.isSupported()) {
      throw new Error("Web Serial API tidak didukung. Gunakan Chrome/Edge terbaru.");
    }
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate });
      this.writer = this.port.writable!.getWriter();
      this.connected = true;
      return true;
    } catch (err: any) {
      if (err.name === "NotFoundError") return false;
      throw err;
    }
  }

  async disconnect() {
    try { this.writer?.releaseLock(); await this.port?.close(); } catch {}
    this.port = null;
    this.writer = null;
    this.connected = false;
  }

  async send(data: number[]): Promise<void> {
    if (!this.writer) throw new Error("Printer USB tidak terhubung. Hubungkan dulu.");
    await this.writer.write(new Uint8Array(data));
  }
}

// ─── WiFi Printer (via server TCP proxy) ─────────────────────────────────────

export class WiFiPrinter {
  constructor(public ip: string, public port = 9100) {}

  async testConnection(): Promise<void> {
    const res = await fetch("/api/printer/wifi-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: this.ip, port: this.port }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || "Koneksi printer WiFi gagal");
    }
  }

  async send(data: number[]): Promise<void> {
    const res = await fetch("/api/printer/wifi-print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: this.ip, port: this.port, data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || "Gagal kirim ke printer WiFi");
    }
  }
}

// ─── Bluetooth Printer (Web Bluetooth UART) ───────────────────────────────────

// Nordic UART Service UUID (paling umum untuk printer BT thermal)
const NORDIC_UART_SERVICE  = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NORDIC_UART_TX_CHAR  = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Write
const GENERIC_PRINTER_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const GENERIC_PRINTER_CHAR    = "00002af1-0000-1000-8000-00805f9b34fb";

export class BluetoothPrinter {
  private device: any = null;
  private txChar: any = null;
  connected = false;
  deviceName = "";

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  async connect(): Promise<boolean> {
    if (!BluetoothPrinter.isSupported()) {
      throw new Error("Web Bluetooth tidak didukung. Gunakan Chrome/Edge terbaru di HTTPS.");
    }
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [NORDIC_UART_SERVICE] },
          { services: [GENERIC_PRINTER_SERVICE] },
          { namePrefix: "Printer" },
          { namePrefix: "MTP" },
          { namePrefix: "RPP" },
          { namePrefix: "PTP" },
          { namePrefix: "Bluetherm" },
        ],
        optionalServices: [NORDIC_UART_SERVICE, GENERIC_PRINTER_SERVICE],
      });

      const server = await this.device.gatt.connect();
      this.deviceName = this.device.name || "Printer Bluetooth";

      // Coba Nordic UART dulu, fallback ke Generic Printer
      try {
        const service = await server.getPrimaryService(NORDIC_UART_SERVICE);
        this.txChar = await service.getCharacteristic(NORDIC_UART_TX_CHAR);
      } catch {
        const service = await server.getPrimaryService(GENERIC_PRINTER_SERVICE);
        this.txChar = await service.getCharacteristic(GENERIC_PRINTER_CHAR);
      }

      this.connected = true;
      return true;
    } catch (err: any) {
      if (err.name === "NotFoundError" || err.name === "NotAllowedError") return false;
      throw err;
    }
  }

  async disconnect() {
    try { this.device?.gatt?.disconnect(); } catch {}
    this.device = null;
    this.txChar = null;
    this.connected = false;
    this.deviceName = "";
  }

  async send(data: number[]): Promise<void> {
    if (!this.txChar) throw new Error("Printer Bluetooth tidak terhubung.");
    const CHUNK = 512;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = new Uint8Array(data.slice(i, i + CHUNK));
      await this.txChar.writeValueWithoutResponse(chunk);
      await new Promise(r => setTimeout(r, 20));
    }
  }
}

// ─── Universal Printer (smart router) ────────────────────────────────────────

export class UniversalPrinter {
  usb = new USBPrinter();
  bluetooth = new BluetoothPrinter();

  get connected(): boolean {
    const s = getPrinterSettings();
    if (s.connectionType === "usb") return this.usb.connected;
    if (s.connectionType === "bluetooth") return this.bluetooth.connected;
    return !!s.wifiIp;
  }

  get connectionLabel(): string {
    const s = getPrinterSettings();
    if (s.connectionType === "usb") return this.usb.connected ? `USB Terhubung` : "USB Belum Terhubung";
    if (s.connectionType === "bluetooth") return this.bluetooth.connected ? `BT: ${this.bluetooth.deviceName}` : "Bluetooth Belum Terhubung";
    return s.wifiIp ? `WiFi: ${s.wifiIp}:${s.wifiPort}` : "WiFi Belum Dikonfigurasi";
  }

  async printReceipt(receipt: ReceiptData): Promise<void> {
    const s = getPrinterSettings();
    const copies = Math.max(1, s.printCopies || 1);
    const bytes = buildReceiptBytes(receipt, s.paperWidth);

    for (let i = 0; i < copies; i++) {
      await this._send(bytes, s);
    }
  }

  async testPrint(): Promise<void> {
    const s = getPrinterSettings();
    const W = s.paperWidth === 58 ? 32 : 42;
    const bytes: number[] = [];
    bytes.push(ESC, 0x40); // init
    bytes.push(ESC, 0x61, 1); // center
    bytes.push(ESC, 0x45, 1);
    bytes.push(...enc("=== TEST PRINT ===\n"));
    bytes.push(ESC, 0x45, 0);
    bytes.push(...enc(`DesaMart POS\n`));
    bytes.push(...enc(`Lebar kertas: ${s.paperWidth}mm\n`));
    bytes.push(...enc(`Koneksi: ${s.connectionType.toUpperCase()}\n`));
    if (s.connectionType === "wifi") bytes.push(...enc(`IP: ${s.wifiIp}:${s.wifiPort}\n`));
    bytes.push(...enc("-".repeat(W) + "\n"));
    bytes.push(...enc("Printer siap digunakan!\n"));
    bytes.push(LF, LF, LF, LF);
    bytes.push(GS, 0x56, 0x41, 0x00);

    await this._send(bytes, s);
  }

  private async _send(bytes: number[], s: PrinterSettings): Promise<void> {
    if (s.connectionType === "usb") {
      if (!this.usb.connected) throw new Error("USB belum terhubung. Klik tombol hubungkan USB.");
      await this.usb.send(bytes);
    } else if (s.connectionType === "bluetooth") {
      if (!this.bluetooth.connected) throw new Error("Bluetooth belum terhubung. Klik tombol hubungkan Bluetooth.");
      await this.bluetooth.send(bytes);
    } else {
      if (!s.wifiIp) throw new Error("IP printer WiFi belum diatur. Buka Pengaturan → Printer.");
      const wifi = new WiFiPrinter(s.wifiIp, s.wifiPort);
      await wifi.send(bytes);
    }
  }
}

// Singleton
let _universal: UniversalPrinter | null = null;
export function getUniversalPrinter(): UniversalPrinter {
  if (!_universal) _universal = new UniversalPrinter();
  return _universal;
}

// ─── Legacy compat aliases ────────────────────────────────────────────────────

export class ThermalPrinter extends USBPrinter {
  static isSupported = USBPrinter.isSupported;

  async connect(baudRate = 9600): Promise<boolean> {
    return super.connect(baudRate);
  }

  async printReceipt(receipt: ReceiptData): Promise<void> {
    const s = getPrinterSettings();
    const bytes = buildReceiptBytes(receipt, s.paperWidth);
    await this.send(bytes);
  }
}

export function getPrinter(): ThermalPrinter {
  return getUniversalPrinter().usb as ThermalPrinter;
}

// ─── Browser fallback (popup window print) ───────────────────────────────────

export async function printReceiptBrowser(receipt: ReceiptData): Promise<void> {
  const W = 42;
  const c = (t: string) => t.padStart(Math.floor((W + t.length) / 2)).padEnd(W);
  const r = (l: string, rv: string) => l + " ".repeat(Math.max(1, W - l.length - rv.length)) + rv;
  const div = "-".repeat(W);

  const lines: string[] = [
    c(receipt.storeName || "STRUK PENJUALAN"),
    ...(receipt.storeAddress ? [c(receipt.storeAddress)] : []),
    ...(receipt.storePhone ? [c(receipt.storePhone)] : []),
    ...(receipt.receiptHeader ? [c(receipt.receiptHeader)] : []),
    div,
    `No  : ${receipt.invoiceNo}`,
    `Tgl : ${fmtDate(receipt.date)}`,
    ...(receipt.cashierName ? [`Kas : ${receipt.cashierName}`] : []),
    ...(receipt.customerName ? [`Plg : ${receipt.customerName}`] : []),
    div,
  ];

  for (const item of receipt.items) {
    lines.push(item.name);
    lines.push(r(`  ${item.qty}x ${fmtCur(item.price)}`, fmtCur(item.qty * item.price)));
    if (item.discount > 0) lines.push(`  Diskon: -${fmtCur(item.discount)}`);
  }

  lines.push(div);
  if (receipt.subtotal !== receipt.total) lines.push(r("Subtotal", fmtCur(receipt.subtotal)));
  if (receipt.discountAmount > 0) lines.push(r("Diskon", `-${fmtCur(receipt.discountAmount)}`));
  if (receipt.taxAmount > 0) lines.push(r("Pajak", fmtCur(receipt.taxAmount)));
  lines.push(r("TOTAL", fmtCur(receipt.total)));
  lines.push(r("Bayar", fmtCur(receipt.paidAmount)));
  lines.push(r("Kembalian", fmtCur(receipt.changeAmount)));
  lines.push(`Metode: ${receipt.paymentMethod}`);
  lines.push(div);
  lines.push(c(receipt.receiptFooter || "Terima kasih sudah berbelanja!"));

  const content = lines.join("\n");
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) { alert("Aktifkan popup untuk mencetak struk."); return; }
  win.document.write(`<html><head><title>Struk</title>
    <style>body{font-family:'Courier New',monospace;font-size:12px;margin:0;padding:8px}
    pre{white-space:pre-wrap;word-wrap:break-word}
    @media print{@page{margin:2mm;size:80mm auto}}</style></head>
    <body><pre>${content}</pre>
    <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
  win.document.close();
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
