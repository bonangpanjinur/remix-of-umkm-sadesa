// Wilayah.id API for Indonesian regions
// Source: https://wilayah.id/
// Uses parallel race strategy: all fetch methods run simultaneously, fastest wins

export interface Region {
  code: string;
  name: string;
}

interface WilayahResponse {
  data: Region[];
  meta?: {
    administrative_area_level: number;
    updated_at: string;
  };
}

// Persistent cache using localStorage
const CACHE_PREFIX = 'address_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(type: string, code?: string): string {
  return code ? `${type}-${code}` : type;
}

function getFromCache(key: string): Region[] | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
      localStorage.removeItem(CACHE_PREFIX + key);
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

function setCache(key: string, data: Region[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

// Static fallback data for provinces
const STATIC_PROVINCES: Region[] = [
  { code: "11", name: "Aceh" },
  { code: "12", name: "Sumatera Utara" },
  { code: "13", name: "Sumatera Barat" },
  { code: "14", name: "Riau" },
  { code: "15", name: "Jambi" },
  { code: "16", name: "Sumatera Selatan" },
  { code: "17", name: "Bengkulu" },
  { code: "18", name: "Lampung" },
  { code: "19", name: "Kepulauan Bangka Belitung" },
  { code: "21", name: "Kepulauan Riau" },
  { code: "31", name: "DKI Jakarta" },
  { code: "32", name: "Jawa Barat" },
  { code: "33", name: "Jawa Tengah" },
  { code: "34", name: "DI Yogyakarta" },
  { code: "35", name: "Jawa Timur" },
  { code: "36", name: "Banten" },
  { code: "51", name: "Bali" },
  { code: "52", name: "Nusa Tenggara Barat" },
  { code: "53", name: "Nusa Tenggara Timur" },
  { code: "61", name: "Kalimantan Barat" },
  { code: "62", name: "Kalimantan Tengah" },
  { code: "63", name: "Kalimantan Selatan" },
  { code: "64", name: "Kalimantan Timur" },
  { code: "65", name: "Kalimantan Utara" },
  { code: "71", name: "Sulawesi Utara" },
  { code: "72", name: "Sulawesi Tengah" },
  { code: "73", name: "Sulawesi Selatan" },
  { code: "74", name: "Sulawesi Tenggara" },
  { code: "75", name: "Gorontalo" },
  { code: "76", name: "Sulawesi Barat" },
  { code: "81", name: "Maluku" },
  { code: "82", name: "Maluku Utara" },
  { code: "91", name: "Papua" },
  { code: "92", name: "Papua Barat" },
  { code: "93", name: "Papua Selatan" },
  { code: "94", name: "Papua Tengah" },
  { code: "95", name: "Papua Pegunungan" },
  { code: "96", name: "Papua Barat Daya" },
];

const EMSIFA_BASE_URL = 'https://www.emsifa.com/api-wilayah-indonesia/api';

let BASE_URL = 'https://wilayah.id/api';

// Try to load custom API URL from localStorage (cached from system settings)
try {
  const customApiUrl = localStorage.getItem('custom_address_api_url');
  if (customApiUrl) {
    BASE_URL = customApiUrl;
  }
} catch (e) {
  // Ignore localStorage errors
}

function toTitleCase(str: string): string {
  if (!str) return str;
  // If string is all uppercase, convert to title case
  if (str === str.toUpperCase()) {
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
  return str;
}

export function setBaseUrl(url: string) {
  BASE_URL = url;
  try {
    localStorage.setItem('custom_address_api_url', url);
  } catch (e) {}
}

async function fetchDirect(url: string, signal?: AbortSignal): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal,
    });
    if (response.ok) return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.warn('Direct fetch failed:', error);
  }
  return null;
}

async function fetchViaEdgeFunction(type: string, code: string | undefined, signal?: AbortSignal): Promise<Response | null> {
  try {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectUrl || !anonKey) return null;

    const params = new URLSearchParams({ type });
    if (code) params.append('code', code);

    const response = await fetch(`${projectUrl}/functions/v1/wilayah-proxy?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      signal,
    });
    if (response.ok) return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.warn('Edge function fetch failed:', error);
  }
  return null;
}

async function fetchViaCorsProxy(url: string, signal?: AbortSignal): Promise<Response | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, { signal });
    if (response.ok) return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.warn('CORS proxy fetch failed:', error);
  }
  return null;
}

async function fetchViaCorsProxy2(url: string, signal?: AbortSignal): Promise<Response | null> {
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, { signal });
    if (response.ok) return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.warn('CORS proxy 2 fetch failed:', error);
  }
  return null;
}

async function fetchViaEmsifa(type: string, code: string | undefined, signal?: AbortSignal): Promise<Region[]> {
  let url: string;
  switch (type) {
    case 'provinces': url = `${EMSIFA_BASE_URL}/provinces.json`; break;
    case 'regencies': url = `${EMSIFA_BASE_URL}/regencies/${code}.json`; break;
    case 'districts': url = `${EMSIFA_BASE_URL}/districts/${code}.json`; break;
    case 'villages': url = `${EMSIFA_BASE_URL}/villages/${code}.json`; break;
    default: return [];
  }

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal,
  });

  if (!response.ok) throw new Error(`Emsifa returned ${response.status}`);

  const data: Array<{ id: string; name: string }> = await response.json();
  return data.map(item => ({ code: item.id, name: toTitleCase(item.name) }));
}

// Wrap a fetch function so it rejects (instead of resolving null) on failure
async function mustSucceed(fn: () => Promise<Response | null>): Promise<Response> {
  const result = await fn();
  if (!result) throw new Error('fetch returned null');
  return result;
}

async function fetchWithFallbacks(type: string, code?: string): Promise<Region[]> {
  let url: string;
  switch (type) {
    case 'provinces': url = `${BASE_URL}/provinces.json`; break;
    case 'regencies': url = `${BASE_URL}/regencies/${code}.json`; break;
    case 'districts': url = `${BASE_URL}/districts/${code}.json`; break;
    case 'villages': url = `${BASE_URL}/villages/${code}.json`; break;
    default: return [];
  }

  const controller = new AbortController();
  const { signal } = controller;

  // Auto-abort after 10s max
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    // 5-way parallel race — Emsifa is primary (no CORS issues), others are fallbacks
    // Emsifa returns Region[] directly, others return Response that needs parsing
    const emsifaPromise = fetchViaEmsifa(type, code, signal);

    const wilayahPromises = [
      mustSucceed(() => fetchDirect(url, signal)),
      mustSucceed(() => fetchViaEdgeFunction(type, code, signal)),
      mustSucceed(() => fetchViaCorsProxy(url, signal)),
      mustSucceed(() => fetchViaCorsProxy2(url, signal)),
    ];

    // Parse wilayah.id responses into Region[]
    const wilayahParsed = wilayahPromises.map(p =>
      p.then(async (res) => {
        const result: WilayahResponse = await res.json();
        return result.data || [];
      })
    );

    // Race all 5 strategies — first to return Region[] wins
    const allPromises = [emsifaPromise, ...wilayahParsed];

    const result = await new Promise<Region[]>((resolve, reject) => {
      let rejections = 0;
      for (const p of allPromises) {
        p.then((data) => {
          if (data && data.length > 0) resolve(data);
          else throw new Error('Empty result');
        }).catch(() => {
          rejections++;
          if (rejections === allPromises.length) reject(new Error('All failed'));
        });
      }
    });

    clearTimeout(timeout);
    controller.abort();
    return result;
  } catch {
    clearTimeout(timeout);
    if (type === 'provinces') return STATIC_PROVINCES;
    console.warn(`All fetch strategies failed for ${type}/${code}`);
    return [];
  }
}

export async function fetchProvinces(): Promise<Region[]> {
  const cacheKey = getCacheKey('provinces');
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchWithFallbacks('provinces');
    if (data.length > 0) setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching provinces:', error);
    return STATIC_PROVINCES;
  }
}

export async function fetchRegencies(provinceCode: string): Promise<Region[]> {
  if (!provinceCode) return [];
  const cacheKey = getCacheKey('regencies', provinceCode);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchWithFallbacks('regencies', provinceCode);
    if (data.length > 0) setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching regencies:', error);
    return [];
  }
}

export async function fetchDistricts(regencyCode: string): Promise<Region[]> {
  if (!regencyCode) return [];
  const cacheKey = getCacheKey('districts', regencyCode);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchWithFallbacks('districts', regencyCode);
    if (data.length > 0) setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching districts:', error);
    return [];
  }
}

export async function fetchVillages(districtCode: string): Promise<Region[]> {
  if (!districtCode) return [];
  const cacheKey = getCacheKey('villages', districtCode);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchWithFallbacks('villages', districtCode);
    if (data.length > 0) setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching villages:', error);
    return [];
  }
}

export async function preloadAddressChain(
  provinceCode: string,
  cityCode: string,
  districtCode: string
): Promise<{
  provinces: Region[];
  cities: Region[];
  districts: Region[];
  villages: Region[];
}> {
  const [provinces, cities, districts, villages] = await Promise.all([
    fetchProvinces(),
    provinceCode ? fetchRegencies(provinceCode) : Promise.resolve([]),
    cityCode ? fetchDistricts(cityCode) : Promise.resolve([]),
    districtCode ? fetchVillages(districtCode) : Promise.resolve([]),
  ]);

  return { provinces, cities, districts, villages };
}

export function clearAddressCache(): void {
  Object.keys(localStorage)
    .filter(key => key.startsWith(CACHE_PREFIX))
    .forEach(key => localStorage.removeItem(key));
}
