/**
 * Minimal i18n utility — no extra dependencies.
 *
 * - Detects user language from localStorage("lang") or navigator.language.
 * - Falls back to Indonesian ("id"), then to the key itself.
 * - Components subscribe via useTranslation(); `setLanguage()` notifies them.
 *
 * Add new keys to the dictionaries below; types are inferred automatically.
 */
import { useSyncExternalStore } from 'react';

export type Locale = 'id' | 'en';

const STORAGE_KEY = 'desamart.lang';

const dictionaries = {
  id: {
    'pod.unavailable': 'Gambar tidak tersedia',
    'pod.loadFailed': 'Gagal memuat, coba lagi',
    'pod.retry': 'Muat ulang',
    'pod.loading': 'Memuat gambar',
  },
  en: {
    'pod.unavailable': 'Image not available',
    'pod.loadFailed': 'Failed to load, please try again',
    'pod.retry': 'Reload',
    'pod.loading': 'Loading image',
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

export function translate(key: TranslationKey, locale: Locale = currentLocale): string {
  return dictionaries[locale]?.[key] ?? dictionaries.id[key] ?? key;
}

export function useTranslation() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => 'id' as Locale);
  return {
    locale,
    t: (key: TranslationKey) => translate(key, locale),
    setLocale,
  };
}
