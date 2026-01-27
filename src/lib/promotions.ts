import { supabase } from '@/integrations/supabase/client';

export interface Promotion {
  id: string;
  type: 'banner' | 'wisata_populer' | 'produk_populer' | 'promo_spesial';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkType?: string;
  linkId?: string;
  advertiserType?: string;
  advertiserId?: string;
  startDate: string;
  endDate?: string;
  sortOrder: number;
  viewCount: number;
  clickCount: number;
}

// Fetch active promotions by type
export async function fetchPromotions(type?: Promotion['type']): Promise<Promotion[]> {
  let query = supabase
    .from('promotions')
    .select('*')
    .order('sort_order', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }

  return (data || []).map(p => ({
    id: p.id,
    type: p.type as Promotion['type'],
    title: p.title,
    subtitle: p.subtitle || undefined,
    imageUrl: p.image_url || undefined,
    linkUrl: p.link_url || undefined,
    linkType: p.link_type || undefined,
    linkId: p.link_id || undefined,
    advertiserType: p.advertiser_type || undefined,
    advertiserId: p.advertiser_id || undefined,
    startDate: p.start_date,
    endDate: p.end_date || undefined,
    sortOrder: p.sort_order,
    viewCount: p.view_count,
    clickCount: p.click_count,
  }));
}

// Fetch banner promotions specifically
export async function fetchBannerPromotions(): Promise<Promotion[]> {
  return fetchPromotions('banner');
}

// Increment view count (simplified - just log for now, can add RPC later)
export async function incrementPromotionView(id: string): Promise<void> {
  // For now, we'll just log - admin dashboard can implement proper tracking
  console.log('View tracked for promotion:', id);
}

// Increment click count  
export async function incrementPromotionClick(id: string): Promise<void> {
  // For now, we'll just log - admin dashboard can implement proper tracking
  console.log('Click tracked for promotion:', id);
}
