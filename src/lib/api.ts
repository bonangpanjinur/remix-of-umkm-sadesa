import { supabase } from '@/integrations/supabase/client';
import type { Product, Village, Tourism, Merchant } from '@/types';

// Import local images as fallbacks
import heroVillage from '@/assets/hero-village.jpg';
import villageBojong from '@/assets/village-bojong.jpg';
import villageSukamaju from '@/assets/village-sukamaju.jpg';
import productKeripik from '@/assets/product-keripik.jpg';
import productKopi from '@/assets/product-kopi.jpg';
import productAnyaman from '@/assets/product-anyaman.jpg';
import productSambal from '@/assets/product-sambal.jpg';

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

// Helper to get merchant IDs with active quota
async function getMerchantsWithActiveQuota(): Promise<Set<string>> {
  const { data } = await supabase
    .from('merchant_subscriptions')
    .select('merchant_id, transaction_quota, used_quota')
    .eq('status', 'ACTIVE')
    .gte('expired_at', new Date().toISOString());

  if (!data) return new Set();

  // Filter to only merchants with remaining quota
  const merchantIds: string[] = [];
  for (const sub of data) {
    if (sub.transaction_quota > sub.used_quota) {
      merchantIds.push(sub.merchant_id);
    }
  }

  return new Set(merchantIds);
}

// Check if a specific merchant has active quota
export async function checkMerchantHasActiveQuota(merchantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('merchant_subscriptions')
    .select('transaction_quota, used_quota')
    .eq('merchant_id', merchantId)
    .eq('status', 'ACTIVE')
    .gte('expired_at', new Date().toISOString())
    .order('expired_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  return data.transaction_quota > data.used_quota;
}

// Fetch products from database (only from merchants with active quota)
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
        villages (
          name
        )
      )
    `)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  // Filter out products from merchants without active quota
  const filteredData = (data || []).filter(p => 
    merchantsWithQuota.has(p.merchant_id)
  );

  return filteredData.map(p => ({
    id: p.id,
    merchantId: p.merchant_id,
    merchantName: p.merchants?.name || '',
    merchantVillage: p.merchants?.villages?.name || '',
    name: p.name,
    description: p.description || '',
    price: p.price,
    stock: p.stock,
    image: productImages[p.id] || p.image_url || productKeripik,
    category: p.category as Product['category'],
    isActive: p.is_active,
    isPromo: p.is_promo,
  }));
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

  return {
    id: data.id,
    merchantId: data.merchant_id,
    merchantName: data.merchants?.name || '',
    merchantVillage: data.merchants?.villages?.name || '',
    name: data.name,
    description: data.description || '',
    price: data.price,
    stock: data.stock,
    image: productImages[data.id] || data.image_url || productKeripik,
    category: data.category as Product['category'],
    isActive: data.is_active,
    isPromo: data.is_promo,
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
    .select('*')
    .eq('is_active', true);

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
    `)
    .eq('is_active', true);

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

// Categories (static)
export const categories = [
  { id: 'kuliner', name: 'Kuliner', icon: 'utensils', colorClass: 'category-kuliner' },
  { id: 'fashion', name: 'Fashion', icon: 'shirt', colorClass: 'category-fashion' },
  { id: 'kriya', name: 'Kriya', icon: 'shapes', colorClass: 'category-kriya' },
  { id: 'wisata', name: 'Wisata', icon: 'map-location-dot', colorClass: 'category-wisata' },
] as const;
