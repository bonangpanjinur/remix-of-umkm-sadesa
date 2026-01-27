import { supabase } from '@/integrations/supabase/client';
import type { Courier, AppSetting, AdminStats } from '@/types/admin';
import type { Village, Merchant } from '@/types';

// Fetch admin stats
export async function fetchAdminStats(): Promise<AdminStats> {
  const [merchants, villages, couriers, products, orders, promotions] = await Promise.all([
    supabase.from('merchants').select('id, registration_status', { count: 'exact' }),
    supabase.from('villages').select('id, registration_status', { count: 'exact' }),
    supabase.from('couriers').select('id, registration_status', { count: 'exact' }),
    supabase.from('products').select('id', { count: 'exact' }),
    supabase.from('orders').select('id', { count: 'exact' }),
    supabase.from('promotions').select('id', { count: 'exact' }),
  ]);

  const pendingMerchants = merchants.data?.filter(m => m.registration_status === 'PENDING').length || 0;
  const pendingVillages = villages.data?.filter(v => v.registration_status === 'PENDING').length || 0;
  const pendingCouriers = couriers.data?.filter(c => c.registration_status === 'PENDING').length || 0;

  return {
    totalMerchants: merchants.count || 0,
    pendingMerchants,
    totalVillages: villages.count || 0,
    pendingVillages,
    totalCouriers: couriers.count || 0,
    pendingCouriers,
    totalProducts: products.count || 0,
    totalOrders: orders.count || 0,
    totalPromotions: promotions.count || 0,
  };
}

// Fetch pending approvals
export async function fetchPendingMerchants(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from('merchants')
    .select('*, villages(name)')
    .eq('registration_status', 'PENDING')
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending merchants:', error);
    return [];
  }

  return (data || []).map(m => ({
    id: m.id,
    userId: m.user_id || '',
    name: m.name,
    address: m.address || '',
    villageId: m.village_id || '',
    villageName: m.villages?.name || '',
    openTime: m.open_time || '08:00',
    closeTime: m.close_time || '17:00',
    classificationPrice: m.classification_price as Merchant['classificationPrice'],
    status: m.status as Merchant['status'],
    orderMode: m.order_mode as Merchant['orderMode'],
    ratingAvg: Number(m.rating_avg) || 0,
    ratingCount: m.rating_count || 0,
    badge: m.badge as Merchant['badge'],
    phone: m.phone || '',
    isOpen: m.is_open,
    registrationStatus: m.registration_status,
    registeredAt: m.registered_at,
    province: m.province,
    city: m.city,
    district: m.district,
    subdistrict: m.subdistrict,
    businessCategory: m.business_category,
    businessDescription: m.business_description,
    tradeGroup: m.trade_group,
    verifikatorCode: m.verifikator_code,
  }));
}

export async function fetchPendingVillages(): Promise<Village[]> {
  const { data, error } = await supabase
    .from('villages')
    .select('*')
    .eq('registration_status', 'PENDING')
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending villages:', error);
    return [];
  }

  return (data || []).map(v => ({
    id: v.id,
    name: v.name,
    district: v.district,
    regency: v.regency,
    subdistrict: v.subdistrict || '',
    description: v.description || '',
    image: v.image_url || '',
    isActive: v.is_active,
    registrationStatus: v.registration_status,
    registeredAt: v.registered_at,
    contactName: v.contact_name,
    contactPhone: v.contact_phone,
    contactEmail: v.contact_email,
  }));
}

export async function fetchPendingCouriers(): Promise<Courier[]> {
  const { data, error } = await supabase
    .from('couriers')
    .select('*, villages(name)')
    .eq('registration_status', 'PENDING')
    .order('registered_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending couriers:', error);
    return [];
  }

  return (data || []).map(c => ({
    id: c.id,
    userId: c.user_id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    province: c.province,
    city: c.city,
    district: c.district,
    subdistrict: c.subdistrict,
    address: c.address,
    ktpNumber: c.ktp_number,
    ktpImageUrl: c.ktp_image_url,
    photoUrl: c.photo_url,
    vehicleType: c.vehicle_type,
    vehiclePlate: c.vehicle_plate,
    vehicleImageUrl: c.vehicle_image_url,
    registrationStatus: c.registration_status as Courier['registrationStatus'],
    status: c.status as Courier['status'],
    isAvailable: c.is_available,
    currentLat: c.current_lat ? Number(c.current_lat) : undefined,
    currentLng: c.current_lng ? Number(c.current_lng) : undefined,
    lastLocationUpdate: c.last_location_update,
    villageId: c.village_id,
    villageName: (c.villages as { name: string } | null)?.name,
    approvedBy: c.approved_by,
    approvedAt: c.approved_at,
    rejectionReason: c.rejection_reason,
    registeredAt: c.registered_at,
    createdAt: c.created_at,
  }));
}

// Approval actions
export async function approveMerchant(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('merchants')
    .update({
      registration_status: 'APPROVED',
      status: 'ACTIVE',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error approving merchant:', error);
    return false;
  }
  return true;
}

export async function rejectMerchant(id: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('merchants')
    .update({
      registration_status: 'REJECTED',
      rejection_reason: reason,
    })
    .eq('id', id);

  if (error) {
    console.error('Error rejecting merchant:', error);
    return false;
  }
  return true;
}

export async function approveVillage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('villages')
    .update({
      registration_status: 'APPROVED',
      is_active: true,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error approving village:', error);
    return false;
  }
  return true;
}

export async function rejectVillage(id: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('villages')
    .update({
      registration_status: 'REJECTED',
      rejection_reason: reason,
    })
    .eq('id', id);

  if (error) {
    console.error('Error rejecting village:', error);
    return false;
  }
  return true;
}

export async function approveCourier(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('couriers')
    .update({
      registration_status: 'APPROVED',
      status: 'ACTIVE',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error approving courier:', error);
    return false;
  }
  return true;
}

export async function rejectCourier(id: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('couriers')
    .update({
      registration_status: 'REJECTED',
      rejection_reason: reason,
    })
    .eq('id', id);

  if (error) {
    console.error('Error rejecting courier:', error);
    return false;
  }
  return true;
}

// App settings
export async function fetchAppSettings(): Promise<AppSetting[]> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    console.error('Error fetching app settings:', error);
    return [];
  }

  return (data || []).map(s => ({
    id: s.id,
    key: s.key,
    value: s.value as Record<string, unknown>,
    description: s.description,
    category: s.category,
    updatedBy: s.updated_by,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));
}

export async function updateAppSetting(key: string, value: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase
    .from('app_settings')
    .update({ value: value as unknown as import('@/integrations/supabase/types').Json })
    .eq('key', key);

  if (error) {
    console.error('Error updating app setting:', error);
    return false;
  }
  return true;
}

export async function getSettingByKey(key: string): Promise<AppSetting | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching setting:', error);
    return null;
  }

  return {
    id: data.id,
    key: data.key,
    value: data.value as Record<string, unknown>,
    description: data.description,
    category: data.category,
    updatedBy: data.updated_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
