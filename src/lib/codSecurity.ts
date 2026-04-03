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
  minTrustScore: number;
  penaltyPoints: number;
  successBonusPoints: number;
  enabled: boolean;
}

const DEFAULT_COD_SETTINGS: CODSettings = {
  maxAmount: 75000,
  maxDistanceKm: 3,
  serviceFee: 1000,
  confirmationTimeoutMinutes: 15,
  minTrustScore: 50,
  penaltyPoints: 50,
  successBonusPoints: 1,
  enabled: true,
};

// Cache for COD settings
let cachedSettings: CODSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch COD settings from database with caching
 */
export async function fetchCODSettings(): Promise<CODSettings> {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cod_settings')
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_COD_SETTINGS;
    }

    const dbSettings = data.value as Record<string, unknown>;
    cachedSettings = {
      maxAmount: (dbSettings.max_amount as number) || DEFAULT_COD_SETTINGS.maxAmount,
      maxDistanceKm: (dbSettings.max_distance_km as number) || DEFAULT_COD_SETTINGS.maxDistanceKm,
      serviceFee: (dbSettings.service_fee as number) || DEFAULT_COD_SETTINGS.serviceFee,
      confirmationTimeoutMinutes: (dbSettings.confirmation_timeout_minutes as number) || DEFAULT_COD_SETTINGS.confirmationTimeoutMinutes,
      minTrustScore: (dbSettings.min_trust_score as number) || DEFAULT_COD_SETTINGS.minTrustScore,
      penaltyPoints: (dbSettings.penalty_points as number) || DEFAULT_COD_SETTINGS.penaltyPoints,
      successBonusPoints: (dbSettings.success_bonus_points as number) || DEFAULT_COD_SETTINGS.successBonusPoints,
      enabled: (dbSettings.enabled as boolean) ?? DEFAULT_COD_SETTINGS.enabled,
    };
    cacheTimestamp = now;

    return cachedSettings;
  } catch (error) {
    console.error('Error fetching COD settings:', error);
    return DEFAULT_COD_SETTINGS;
  }
}

/**
 * Clear COD settings cache (call when settings are updated)
 */
export function clearCODSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

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
    // Fetch settings for penalty/bonus points
    const settings = await fetchCODSettings();
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('trust_score, cod_fail_count')
      .eq('user_id', buyerId)
      .maybeSingle();

    if (!profile) return;

    const updates: Record<string, unknown> = {};

    if (success) {
      // Successful COD: +bonus points (max 100)
      updates.trust_score = Math.min(100, (profile.trust_score || 100) + settings.successBonusPoints);
    } else {
      // Failed COD: -penalty points
      const newScore = Math.max(0, (profile.trust_score || 100) - settings.penaltyPoints);
      updates.trust_score = newScore;
      updates.cod_fail_count = (profile.cod_fail_count || 0) + 1;
      
      // Disable COD if score drops below minimum
      if (newScore < settings.minTrustScore) {
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
