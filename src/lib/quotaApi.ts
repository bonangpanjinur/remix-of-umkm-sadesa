import { supabase } from '@/integrations/supabase/client';

export interface QuotaTier {
  id: string;
  min_price: number;
  max_price: number | null;
  credit_cost: number;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function fetchQuotaTiers(): Promise<QuotaTier[]> {
  try {
    const { data, error } = await supabase
      .from('quota_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_price', { ascending: true });

    if (error) {
      console.error('Error fetching quota tiers:', error);
      // Return default tiers as fallback
      return getDefaultTiers();
    }

    return data && data.length > 0 ? data : getDefaultTiers();
  } catch (error) {
    console.error('Error fetching quota tiers:', error);
    return getDefaultTiers();
  }
}

function getDefaultTiers(): QuotaTier[] {
  return [
    { id: '1', min_price: 0, max_price: 50000, credit_cost: 1, description: 'Tier 1' },
    { id: '2', min_price: 50001, max_price: 200000, credit_cost: 2, description: 'Tier 2' },
    { id: '3', min_price: 200001, max_price: null, credit_cost: 5, description: 'Tier 3' },
  ];
}

export function calculateCreditCost(price: number, tiers: QuotaTier[]): number {
  // Find the tier that matches the price
  // We sort by min_price DESC to find the most specific (highest) matching tier first
  const sortedTiers = [...tiers].sort((a, b) => b.min_price - a.min_price);
  
  for (const tier of sortedTiers) {
    if (price >= tier.min_price && (tier.max_price === null || price <= tier.max_price)) {
      return tier.credit_cost;
    }
  }
  
  // Default to 1 if no tier matches
  return 1;
}

export async function calculateOrderCreditCost(items: { price: number; quantity: number }[]): Promise<number> {
  const tiers = await fetchQuotaTiers();
  // Quota deduction is usually per order or per item. 
  // According to requirement: "misal rentang harga produk minimal berapa ke maksimal berapa menggunakan atau pemakaian kuota yang habis 2 kuota"
  // This implies we calculate cost based on the product price.
  // If it's per unique product in the order:
  return items.reduce((total, item) => {
    return total + calculateCreditCost(item.price, tiers);
  }, 0);
}

export async function useMerchantQuotaCredits(merchantId: string, credits: number): Promise<boolean> {
  try {
    // Use the existing use_merchant_quota function
    const { data, error } = await supabase.rpc('use_merchant_quota', {
      p_merchant_id: merchantId,
      p_credits: credits
    });

    if (error) {
      console.error('Error using merchant quota credits:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error using merchant quota credits:', error);
    return false;
  }
}
