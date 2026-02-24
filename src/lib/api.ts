import { supabase } from '../integrations/supabase/client';
import type { Product, Village, Tourism, Merchant } from '../types';

// Import local images as fallbacks
import heroVillage from '../assets/hero-village.jpg';
import villageBojong from '../assets/village-bojong.jpg';
import villageSukamaju from '../assets/village-sukamaju.jpg';
import productKeripik from '../assets/product-keripik.jpg';
import productKopi from '../assets/product-kopi.jpg';
import productAnyaman from '../assets/product-anyaman.jpg';
import productSambal from '../assets/product-sambal.jpg';

export const heroImage = heroVillage;

// Image mapping for products
const productImages: Record<string, string> = {
  'bbbb1111-1111-1111-1111-111111111111': productKeripik,
  'bbbb2222-2222-2222-2222-222222222222': productKopi,
  'bbbb3333-3333-3333-3333-333333333333': productAnyaman,
  'bbbb4444-4444-4444-4444-444444444444': productSambal,
};

// Image mapping for villages
const villageImages: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': villageBojong,
  '22222222-2222-2222-2222-222222222222': villageSukamaju,
};

let cachedFreeTierLimit: number | null = null;
let cacheTs = 0;

async function getFreeTierLimit(): Promise<number> {
  if (cachedFreeTierLimit !== null && Date.now() - cacheTs < 300000) return cachedFreeTierLimit;
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'free_tier_quota').maybeSingle();
  cachedFreeTierLimit = (data?.value as { limit?: number })?.limit ?? 100;
  cacheTs = Date.now();
  return cachedFreeTierLimit;
}

// Helper to get merchant IDs with active quota (subscriptions OR free tier)
async function getMerchantsWithActiveQuota(): Promise<Set<string>> {
  const FREE_TIER_LIMIT = await getFreeTierLimit();
  // Get all active merchants
  const { data: allMerchants } = await supabase
    .from('merchants')
    .select('id')
    .eq('status', 'ACTIVE')
    .eq('registration_status', 'APPROVED');

  if (!allMerchants) return new Set();

  // Get all active subscriptions
  const { data: activeSubs } = await supabase
    .from('merchant_subscriptions')
    .select('merchant_id, transaction_quota, used_quota')
    .eq('status', 'ACTIVE')
    .gte('expired_at', new Date().toISOString());

  // Build a map of merchant -> aggregate remaining quota from subscriptions
  const subQuotaMap = new Map<string, number>();
  if (activeSubs) {
    for (const sub of activeSubs) {
      const remaining = sub.transaction_quota - sub.used_quota;
      const current = subQuotaMap.get(sub.merchant_id) || 0;
      subQuotaMap.set(sub.merchant_id, current + remaining);
    }
  }

  // Separate merchants with and without subscriptions
  const merchantIds = new Set<string>();
  const freeTierMerchantIds: string[] = [];
  
  for (const m of allMerchants) {
    if (subQuotaMap.has(m.id)) {
      if ((subQuotaMap.get(m.id) || 0) > 0) {
        merchantIds.add(m.id);
      }
    } else {
      freeTierMerchantIds.push(m.id);
    }
  }

  // Batch query: get order counts for all free tier merchants in a single query
  if (freeTierMerchantIds.length > 0) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Query orders grouped by merchant_id for free tier merchants
    const { data: orderCounts } = await supabase
      .from('orders')
      .select('merchant_id')
      .in('merchant_id', freeTierMerchantIds)
      .gte('created_at', startOfMonth.toISOString());

    // Count orders per merchant
    const countMap = new Map<string, number>();
    if (orderCounts) {
      for (const row of orderCounts) {
        if (row.merchant_id) {
          countMap.set(row.merchant_id, (countMap.get(row.merchant_id) || 0) + 1);
        }
      }
    }

    // Add merchants under free tier limit
    for (const mid of freeTierMerchantIds) {
      if ((countMap.get(mid) || 0) < FREE_TIER_LIMIT) {
        merchantIds.add(mid);
      }
    }
  }

  return merchantIds;
}

// Check if a specific merchant has active quota
export async function checkMerchantHasActiveQuota(merchantId: string): Promise<boolean> {
  try {
    // First check subscriptions
    const { data, error: subError } = await supabase
      .from('merchant_subscriptions')
      .select('transaction_quota, used_quota')
      .eq('merchant_id', merchantId)
      .eq('status', 'ACTIVE')
      .gte('expired_at', new Date().toISOString());

    if (subError) {
      console.warn('Error checking merchant subscriptions, defaulting to true:', subError);
      return true;
    }

    if (data && data.length > 0) {
      const totalRemaining = data.reduce((sum, sub) => sum + (sub.transaction_quota - sub.used_quota), 0);
      return totalRemaining > 0;
    }

    // Fallback: free tier - check monthly order count
    const FREE_TIER_LIMIT = await getFreeTierLimit();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .gte('created_at', startOfMonth.toISOString());

    if (countError) {
      console.warn('Error checking free tier quota, defaulting to true:', countError);
      return true;
    }

    return (count || 0) < FREE_TIER_LIMIT;
  } catch (error) {
    console.warn('Unexpected error in checkMerchantHasActiveQuota, defaulting to true:', error);
    return true;
  }
}

// Fetch products from database (include all, with availability status and location)
export async function fetchProducts(): Promise<Product[]> {
  // First get merchants with active quota
  const merchantsWithQuota = await getMerchantsWithActiveQuota();

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      merchants (
        id,
        name,
        is_open,
        open_time,
        close_time,
        location_lat,
        location_lng,
        villages (
          name,
          location_lat,
          location_lng
        )
      )
    `);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  const mappedProducts = (data || []).map(p => {
    const hasQuota = merchantsWithQuota.has(p.merchant_id);
    const merchant = p.merchants;
    
    // Check if merchant is currently open based on operating hours
    const isManuallyOpen = merchant?.is_open ?? true;
    const openTime = merchant?.open_time || '08:00';
    const closeTime = merchant?.close_time || '17:00';
    
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    const [openHours, openMinutes] = openTime.split(':').map(Number);
    const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
    const openTimeMinutes = openHours * 60 + openMinutes;
    const closeTimeMinutes = closeHours * 60 + closeMinutes;
    
    let isWithinHours = false;
    if (closeTimeMinutes < openTimeMinutes) {
      isWithinHours = currentTimeMinutes >= openTimeMinutes || currentTimeMinutes <= closeTimeMinutes;
    } else {
      isWithinHours = currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
    }
    
    const isMerchantOpen = isManuallyOpen && isWithinHours;
    
    const isAvailable = hasQuota && isMerchantOpen && p.is_active;

    // Get location - prefer merchant location, fallback to village location
    const locationLat = merchant?.location_lat 
      ? Number(merchant.location_lat) 
      : (merchant?.villages?.location_lat ? Number(merchant.villages.location_lat) : null);
    const locationLng = merchant?.location_lng 
      ? Number(merchant.location_lng) 
      : (merchant?.villages?.location_lng ? Number(merchant.villages.location_lng) : null);
    
    // Calculate discounted price
    const hasDiscount = p.is_promo && p.discount_percent > 0;
    const discountedPrice = hasDiscount 
      ? Math.round(p.price - (p.price * p.discount_percent / 100))
      : p.price;

    return {
      id: p.id,
      merchantId: p.merchant_id,
      merchantName: merchant?.name || '',
      merchantVillage: merchant?.villages?.name || '',
      name: p.name,
      description: p.description || '',
      price: discountedPrice,
      originalPrice: hasDiscount ? p.price : undefined,
      discountPercent: hasDiscount ? p.discount_percent : undefined,
      stock: p.stock,
      image: productImages[p.id] || p.image_url || productKeripik,
      category: p.category as Product['category'],
      isActive: p.is_active,
      isPromo: p.is_promo,
      isAvailable,
      isMerchantOpen,
      hasQuota,
      locationLat,
      locationLng,
      sold_count: p.sold_count || 0,
    };
  });

  return mappedProducts;
}

// Fetch single product
export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      merchants (
        id,
        name,
        phone,
        address,
        rating_avg,
        rating_count,
        badge,
        is_open,
        open_time,
        close_time,
        villages (
          name
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching product:', error);
    return null;
  }

  // Check merchant quota
  const hasQuota = await checkMerchantHasActiveQuota(data.merchant_id);
  
  // Check if merchant is currently open
  const isManuallyOpen = data.merchants?.is_open ?? true;
  const openTime = data.merchants?.open_time || '08:00';
  const closeTime = data.merchants?.close_time || '17:00';
  
  const now = new Date();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
  const [openHours, openMinutes] = openTime.split(':').map(Number);
  const [closeHours, closeMinutes] = closeTime.split(':').map(Number);
  const openTimeMinutes = openHours * 60 + openMinutes;
  const closeTimeMinutes = closeHours * 60 + closeMinutes;
  
  let isWithinHours = false;
  if (closeTimeMinutes < openTimeMinutes) {
    isWithinHours = currentTimeMinutes >= openTimeMinutes || currentTimeMinutes <= closeTimeMinutes;
  } else {
    isWithinHours = currentTimeMinutes >= openTimeMinutes && currentTimeMinutes <= closeTimeMinutes;
  }
  
  const isMerchantOpen = isManuallyOpen && isWithinHours;
  const isAvailable = hasQuota && isMerchantOpen && data.is_active;

  // Calculate discounted price
  const hasDiscount = data.is_promo && data.discount_percent > 0;
  const discountedPrice = hasDiscount 
    ? Math.round(data.price - (data.price * data.discount_percent / 100))
    : data.price;

  return {
    id: data.id,
    merchantId: data.merchant_id,
    merchantName: data.merchants?.name || '',
    merchantVillage: data.merchants?.villages?.name || '',
    name: data.name,
    description: data.description || '',
    price: discountedPrice,
    originalPrice: hasDiscount ? data.price : undefined,
    discountPercent: hasDiscount ? data.discount_percent : undefined,
    stock: data.stock,
    image: productImages[data.id] || data.image_url || productKeripik,
    category: data.category as Product['category'],
    isActive: data.is_active,
    isPromo: data.is_promo,
    isAvailable,
    isMerchantOpen,
    hasQuota,
  };
}

// Fetch merchants
export async function fetchMerchant(id: string): Promise<Merchant | null> {
  const { data, error } = await supabase
    .from('merchants')
    .select(`
      *,
      villages (
        name
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching merchant:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id || '',
    name: data.name,
    address: data.address || '',
    villageId: data.village_id || '',
    villageName: data.villages?.name || '',
    openTime: data.open_time || '08:00',
    closeTime: data.close_time || '17:00',
    classificationPrice: data.classification_price as Merchant['classificationPrice'],
    status: data.status as Merchant['status'],
    orderMode: data.order_mode as Merchant['orderMode'],
    ratingAvg: Number(data.rating_avg) || 0,
    ratingCount: data.rating_count || 0,
    badge: data.badge as Merchant['badge'],
    phone: data.phone || '',
    isOpen: data.is_open,
  };
}

// Fetch villages
export async function fetchVillages(): Promise<Village[]> {
  const { data, error } = await supabase
    .from('villages')
    .select('*');

  if (error) {
    console.error('Error fetching villages:', error);
    return [];
  }

  return (data || []).map(v => ({
    id: v.id,
    name: v.name,
    district: v.district,
    regency: v.regency,
    description: v.description || '',
    image: villageImages[v.id] || v.image_url || villageBojong,
    isActive: v.is_active,
    locationLat: v.location_lat ? Number(v.location_lat) : null,
    locationLng: v.location_lng ? Number(v.location_lng) : null,
  }));
}

// Fetch tourism spots
export async function fetchTourism(): Promise<Tourism[]> {
  const { data, error } = await supabase
    .from('tourism')
    .select(`
      *,
      villages (
        name
      )
    `);

  if (error) {
    console.error('Error fetching tourism:', error);
    return [];
  }

  return (data || []).map(t => ({
    id: t.id,
    villageId: t.village_id,
    villageName: t.villages?.name || '',
    name: t.name,
    description: t.description || '',
    image: villageImages[t.village_id] || t.image_url || villageBojong,
    locationLat: Number(t.location_lat) || 0,
    locationLng: Number(t.location_lng) || 0,
    waLink: t.wa_link || '',
    sosmedLink: t.sosmed_link || '',
    facilities: t.facilities || [],
    isActive: t.is_active,
    viewCount: t.view_count,
  }));
}

// Fetch single tourism
export async function fetchTourismById(id: string): Promise<Tourism | null> {
  const { data, error } = await supabase
    .from('tourism')
    .select(`
      *,
      villages (
        name
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching tourism:', error);
    return null;
  }

  return {
    id: data.id,
    villageId: data.village_id,
    villageName: data.villages?.name || '',
    name: data.name,
    description: data.description || '',
    image: villageImages[data.village_id] || data.image_url || villageBojong,
    locationLat: Number(data.location_lat) || 0,
    locationLng: Number(data.location_lng) || 0,
    waLink: data.wa_link || '',
    sosmedLink: data.sosmed_link || '',
    facilities: data.facilities || [],
    isActive: data.is_active,
    viewCount: data.view_count,
  };
}

// Categories - now dynamic from database, see useCategories hook
// Keeping static fallback for backward compatibility
export const categories = [
  { id: 'kuliner', name: 'Kuliner', icon: 'utensils', colorClass: 'category-kuliner' },
  { id: 'fashion', name: 'Fashion', icon: 'shirt', colorClass: 'category-fashion' },
  { id: 'kriya', name: 'Kriya', icon: 'shapes', colorClass: 'category-kriya' },
  { id: 'wisata', name: 'Wisata', icon: 'map-location-dot', colorClass: 'category-wisata' },
] as const;
