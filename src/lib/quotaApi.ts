import { supabase } from '@/integrations/supabase/client';

export interface QuotaTier {
  id: string;
  min_price: number;
  max_price: number | null;
  credit_cost: number;
}

export async function fetchQuotaTiers(): Promise<QuotaTier[]> {
  const { data, error } = await supabase
    .from('quota_tiers')
    .select('*')
    .order('min_price', { ascending: true });

  if (error) {
    console.error('Error fetching quota tiers:', error);
    return [];
  }
  return data || [];
}

export function calculateCreditCost(price: number, tiers: QuotaTier[]): number {
  const tier = tiers.find(t => 
    price >= t.min_price && (t.max_price === null || price <= t.max_price)
  );
  return tier ? tier.credit_cost : 1; // Default to 1 if no tier matches
}

export async function calculateOrderCreditCost(items: { price: number; quantity: number }[]): Promise<number> {
  const tiers = await fetchQuotaTiers();
  return items.reduce((total, item) => {
    return total + (calculateCreditCost(item.price, tiers) * item.quantity);
  }, 0);
}

export async function useMerchantQuotaCredits(merchantId: string, credits: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('use_merchant_quota_v2', {
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
