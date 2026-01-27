import { supabase } from '@/integrations/supabase/client';

interface CODEligibilityResult {
  eligible: boolean;
  reason: string | null;
}

interface CODSettings {
  maxAmount: number;
  maxDistanceKm: number;
  serviceFee: number;
  confirmationTimeoutMinutes: number;
}

const DEFAULT_COD_SETTINGS: CODSettings = {
  maxAmount: 75000,
  maxDistanceKm: 3,
  serviceFee: 1000,
  confirmationTimeoutMinutes: 15,
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if COD is available for a given order
 */
export async function checkCODEligibility(
  buyerId: string,
  merchantId: string,
  totalAmount: number,
  distanceKm?: number
): Promise<CODEligibilityResult> {
  try {
    // Use database function for validation
    const { data, error } = await supabase.rpc('check_cod_eligibility', {
      p_buyer_id: buyerId,
      p_merchant_id: merchantId,
      p_total_amount: totalAmount,
      p_distance_km: distanceKm || null,
    });

    if (error) {
      console.error('COD eligibility check error:', error);
      return { eligible: false, reason: 'Gagal memeriksa kelayakan COD' };
    }

    const result = data as unknown as CODEligibilityResult;
    return result;
  } catch (error) {
    console.error('COD eligibility error:', error);
    return { eligible: false, reason: 'Terjadi kesalahan sistem' };
  }
}

/**
 * Client-side COD eligibility check (for quick validation before server check)
 */
export function quickCODCheck(
  totalAmount: number,
  distanceKm?: number,
  settings: Partial<CODSettings> = {}
): CODEligibilityResult {
  const config = { ...DEFAULT_COD_SETTINGS, ...settings };

  if (totalAmount > config.maxAmount) {
    return {
      eligible: false,
      reason: `Nominal terlalu besar untuk COD. Maks: Rp ${config.maxAmount.toLocaleString('id-ID')}`,
    };
  }

  if (distanceKm && distanceKm > config.maxDistanceKm) {
    return {
      eligible: false,
      reason: `Jarak terlalu jauh untuk COD. Maks: ${config.maxDistanceKm} KM`,
    };
  }

  return { eligible: true, reason: null };
}

/**
 * Generate WhatsApp confirmation message template
 */
export function generateCODConfirmationMessage(
  orderId: string,
  buyerName: string,
  totalAmount: number
): string {
  const formattedAmount = totalAmount.toLocaleString('id-ID');
  return `Halo, saya ${buyerName} konfirmasi pesanan COD #${orderId.slice(0, 8).toUpperCase()} sebesar Rp ${formattedAmount}. Mohon diproses.`;
}

/**
 * Get WhatsApp link for COD confirmation
 */
export function getCODWhatsAppLink(
  merchantPhone: string,
  orderId: string,
  buyerName: string,
  totalAmount: number
): string {
  const message = generateCODConfirmationMessage(orderId, buyerName, totalAmount);
  const encodedMessage = encodeURIComponent(message);
  const formattedPhone = merchantPhone.startsWith('0') 
    ? '62' + merchantPhone.slice(1) 
    : merchantPhone;
  
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

/**
 * Calculate confirmation deadline for pending COD orders
 */
export function getConfirmationDeadline(
  createdAt: Date,
  timeoutMinutes: number = DEFAULT_COD_SETTINGS.confirmationTimeoutMinutes
): Date {
  return new Date(createdAt.getTime() + timeoutMinutes * 60 * 1000);
}

/**
 * Check if order confirmation has timed out
 */
export function isConfirmationExpired(deadline: Date): boolean {
  return new Date() > deadline;
}

/**
 * Update buyer trust score after COD result
 */
export async function updateBuyerTrustScore(
  buyerId: string,
  success: boolean
): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('trust_score, cod_fail_count')
      .eq('user_id', buyerId)
      .single();

    if (!profile) return;

    const updates: Record<string, any> = {};

    if (success) {
      // Successful COD: +1 point (max 100)
      updates.trust_score = Math.min(100, (profile.trust_score || 100) + 1);
    } else {
      // Failed COD: -50 points
      const newScore = Math.max(0, (profile.trust_score || 100) - 50);
      updates.trust_score = newScore;
      updates.cod_fail_count = (profile.cod_fail_count || 0) + 1;
      
      // Disable COD if score drops below 50
      if (newScore < 50) {
        updates.cod_enabled = false;
      }
    }

    await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', buyerId);
  } catch (error) {
    console.error('Error updating trust score:', error);
  }
}

/**
 * Get buyer's COD status summary
 */
export async function getBuyerCODStatus(buyerId: string): Promise<{
  enabled: boolean;
  trustScore: number;
  failCount: number;
  isVerified: boolean;
}> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('cod_enabled, trust_score, cod_fail_count, is_verified_buyer')
      .eq('user_id', buyerId)
      .single();

    return {
      enabled: profile?.cod_enabled ?? true,
      trustScore: profile?.trust_score ?? 100,
      failCount: profile?.cod_fail_count ?? 0,
      isVerified: profile?.is_verified_buyer ?? false,
    };
  } catch (error) {
    console.error('Error fetching COD status:', error);
    return {
      enabled: true,
      trustScore: 100,
      failCount: 0,
      isVerified: false,
    };
  }
}

/**
 * Create a flash sale for rejected COD order
 */
export async function createFlashSale(
  orderId: string,
  discountPercent: number = 50
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        is_flash_sale: true,
        flash_sale_discount: discountPercent,
      })
      .eq('id', orderId);

    return !error;
  } catch (error) {
    console.error('Error creating flash sale:', error);
    return false;
  }
}

export { DEFAULT_COD_SETTINGS };
export type { CODEligibilityResult, CODSettings };
