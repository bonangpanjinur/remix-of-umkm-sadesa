/**
 * Minimal i18n utility — no extra dependencies.
 *
 * Detects user language from localStorage("desamart.lang") or navigator.language.
 * Falls back to Indonesian ("id"), then to the key itself.
 *
 * Components subscribe via useTranslation() / useFormatters(); setLocale()
 * notifies them via useSyncExternalStore so the UI re-renders instantly.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  KEY NAMING CONVENTION
 * ────────────────────────────────────────────────────────────────────────
 *  Format: <namespace>.<feature>[.<modifier>]
 *
 *  Approved namespaces (extend here, NOT ad-hoc in components):
 *   - common.*    → app-wide reusable copy (yes/no, save, cancel, loading…)
 *   - pod.*       → Proof-of-Delivery image component
 *   - order.*     → Order/shipping flow (status labels, ETA copy…)
 *   - settings.*  → Settings page
 *   - admin.*     → Admin dashboards
 *   - merchant.*  → Merchant-facing screens
 *   - courier.*   → Courier-facing screens
 *
 *  Rules:
 *   1. ALWAYS add the key to BOTH `id` and `en` dictionaries.
 *   2. Use lowercase dot.case. No camelCase segments after the first.
 *      ✅ order.status.delivered     ❌ order.statusDelivered
 *   3. Status enum keys map 1-to-1 to backend values, lowercased.
 *      e.g. backend "PICKED_UP" → key "order.status.picked_up".
 *   4. Never inline literal Indonesian/English strings in components for
 *      user-facing copy. If a string is missing a key, ADD the key.
 *   5. Reuse via `common.*` before introducing a feature-scoped duplicate.
 *
 *  When TypeScript complains about an unknown key, that's the convention
 *  enforcing itself — add the key to both dictionaries.
 * ────────────────────────────────────────────────────────────────────────
 */
import { useSyncExternalStore } from 'react';

export type Locale = 'id' | 'en';

const STORAGE_KEY = 'desamart.lang';

const dictionaries = {
  id: {
    // common.*
    'common.loading': 'Memuat',
    'common.retry': 'Coba lagi',
    'common.cancel': 'Batal',
    'common.save': 'Simpan',

    // pod.* (Proof of Delivery image)
    'pod.unavailable': 'Gambar tidak tersedia',
    'pod.loadFailed': 'Gagal memuat, coba lagi',
    'pod.retry': 'Muat ulang',
    'pod.loading': 'Memuat gambar',
    'pod.alt': 'Bukti Pengiriman',

    // order.status.*  (keys mirror backend enum values, lowercased)
    'order.status.new': 'Menunggu Kurir',
    'order.status.processing': 'Menunggu Kurir',
    'order.status.processed': 'Sedang Diproses',
    'order.status.assigned': 'Kurir Dalam Perjalanan ke Toko',
    'order.status.picked_up': 'Kurir Mengambil Pesanan',
    'order.status.sent': 'Kurir Sedang Mengantar',
    'order.status.on_delivery': 'Kurir Sedang Mengantar',
    'order.status.delivering': 'Penjual Sedang Mengantar',
    'order.status.delivered': 'Pesanan Terkirim',
    'order.status.done': 'Pesanan Terkirim',

    // order.step.*  (progress timeline labels)
    'order.step.created': 'Pesanan Dibuat',
    'order.step.processed': 'Sedang Diproses',
    'order.step.assigned': 'Kurir Ditugaskan',
    'order.step.picked_up': 'Pesanan Diambil',
    'order.step.delivered': 'Sampai Tujuan',
    'order.step.inProgress': 'Sedang berlangsung',

    // order.eta.*
    'order.eta.label': 'Estimasi tiba',

    // shipping.* (ongkir & ringkasan biaya)
    'shipping.subtotal': 'Subtotal',
    'shipping.fee': 'Ongkir',
    'shipping.feeLong': 'Ongkos kirim',
    'shipping.calculatedAtCheckout': 'Dihitung saat checkout',
    'shipping.free': 'Gratis ongkir!',
    'shipping.freeMinOrder': 'Gratis ongkir! (min. belanja {min})',
    'shipping.voucherDiscount': 'Diskon Voucher',
    'shipping.codServiceFee': 'Biaya Layanan COD',
    'shipping.total': 'Total',
    'shipping.payVia': 'Bayar via',
    'shipping.distanceLabel': 'Jarak pengiriman',
    'shipping.estimatedFee': 'Estimasi ongkir',
    'shipping.etaLabel': 'Estimasi tiba',
    'shipping.etaMinutes': '{min}-{max} menit',
    'shipping.etaHours': '{min}-{max} jam',
    'shipping.method': 'Metode Pengiriman',
    'shipping.pickup': 'Ambil Sendiri',
    'shipping.pickupDesc': 'Ambil langsung di toko',
    'shipping.delivery': 'Kurir Desa',
    'shipping.deliveryDesc': 'Dikirim ke alamat Anda',
    'shipping.freeLabel': 'Gratis',

    // settings.language.*
    'settings.language.title': 'Bahasa',
    'settings.language.description': 'Pilih bahasa tampilan aplikasi',
    'settings.language.active': 'Bahasa Aktif',
    'settings.language.id': 'Bahasa Indonesia',
    'settings.language.en': 'English',

    // common.language.* (for header switcher menu)
    'common.language.switch': 'Ubah bahasa',
  },
  en: {
    'common.loading': 'Loading',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.save': 'Save',

    'pod.unavailable': 'Image not available',
    'pod.loadFailed': 'Failed to load, please try again',
    'pod.retry': 'Reload',
    'pod.loading': 'Loading image',
    'pod.alt': 'Proof of delivery',

    'order.status.new': 'Waiting for courier',
    'order.status.processing': 'Waiting for courier',
    'order.status.processed': 'Being processed',
    'order.status.assigned': 'Courier on the way to store',
    'order.status.picked_up': 'Courier picked up order',
    'order.status.sent': 'Courier on delivery',
    'order.status.on_delivery': 'Courier on delivery',
    'order.status.delivering': 'Seller is delivering',
    'order.status.delivered': 'Order delivered',
    'order.status.done': 'Order delivered',

    'order.step.created': 'Order placed',
    'order.step.processed': 'Being processed',
    'order.step.assigned': 'Courier assigned',
    'order.step.picked_up': 'Order picked up',
    'order.step.delivered': 'Arrived',
    'order.step.inProgress': 'In progress',

    'order.eta.label': 'ETA',

    'shipping.subtotal': 'Subtotal',
    'shipping.fee': 'Shipping',
    'shipping.feeLong': 'Shipping fee',
    'shipping.calculatedAtCheckout': 'Calculated at checkout',
    'shipping.free': 'Free shipping!',
    'shipping.freeMinOrder': 'Free shipping! (min. order {min})',
    'shipping.voucherDiscount': 'Voucher discount',
    'shipping.codServiceFee': 'COD service fee',
    'shipping.total': 'Total',
    'shipping.payVia': 'Pay via',
    'shipping.distanceLabel': 'Delivery distance',
    'shipping.estimatedFee': 'Estimated shipping',
    'shipping.etaLabel': 'ETA',
    'shipping.etaMinutes': '{min}-{max} min',
    'shipping.etaHours': '{min}-{max} hr',
    'shipping.method': 'Delivery Method',
    'shipping.pickup': 'Self Pickup',
    'shipping.pickupDesc': 'Pick up at the store',
    'shipping.delivery': 'Village Courier',
    'shipping.deliveryDesc': 'Delivered to your address',
    'shipping.freeLabel': 'Free',

    'settings.language.title': 'Language',
    'settings.language.description': 'Choose the app display language',
    'settings.language.active': 'Active language',
    'settings.language.id': 'Bahasa Indonesia',
    'settings.language.en': 'English',

    'common.language.switch': 'Change language',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof (typeof dictionaries)['id'];

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'id';
  const stored = window.localStorage?.getItem(STORAGE_KEY);
  if (stored === 'id' || stored === 'en') return stored;
  const nav = window.navigator?.language?.toLowerCase() ?? '';
  if (nav.startsWith('en')) return 'en';
  return 'id';
}

let currentLocale: Locale = detectLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  try {
    window.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function translate(
  key: TranslationKey,
  locale: Locale = currentLocale,
  vars?: Record<string, string | number>,
): string {
  const raw = dictionaries[locale]?.[key] ?? dictionaries.id[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/**
 * Map a backend order status (e.g. "PICKED_UP") to a localized label.
 * Unknown statuses fall through to the raw value so they remain debuggable.
 */
export function translateOrderStatus(status: string, locale: Locale = currentLocale): string {
  const key = `order.status.${status.toLowerCase()}` as TranslationKey;
  if ((dictionaries[locale] as Record<string, string>)[key]) return translate(key, locale);
  return status;
}

export function useTranslation() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => 'id' as Locale);
  return {
    locale,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(key, locale, vars),
    tStatus: (status: string) => translateOrderStatus(status, locale),
    setLocale,
  };
}

// ──────────────────────────────────────────────────────────────────────
//  Locale-aware formatters (currency, dates, numbers)
// ──────────────────────────────────────────────────────────────────────

const LOCALE_TAG: Record<Locale, string> = { id: 'id-ID', en: 'en-US' };

/** IDR is project-wide currency; only the locale formatting differs. */
export function formatCurrency(amount: number, locale: Locale = currentLocale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, locale: Locale = currentLocale): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(value);
}

export function formatDate(
  input: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale: Locale = currentLocale,
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], options).format(date);
}

export function formatTime(
  input: string | number | Date,
  locale: Locale = currentLocale,
): string {
  return formatDate(input, { hour: '2-digit', minute: '2-digit' }, locale);
}

export function formatDateTime(
  input: string | number | Date,
  locale: Locale = currentLocale,
): string {
  return formatDate(input, { dateStyle: 'medium', timeStyle: 'short' }, locale);
}

/** Reactive formatters hook — re-renders on setLocale. */
export function useFormatters() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => 'id' as Locale);
  return {
    locale,
    formatCurrency: (n: number) => formatCurrency(n, locale),
    formatNumber: (n: number) => formatNumber(n, locale),
    formatDate: (d: string | number | Date, o?: Intl.DateTimeFormatOptions) =>
      formatDate(d, o, locale),
    formatTime: (d: string | number | Date) => formatTime(d, locale),
    formatDateTime: (d: string | number | Date) => formatDateTime(d, locale),
  };
}
