import { supabase } from '@/integrations/supabase/client';
import type { Courier, AppSetting, AdminStats } from '@/types/admin';
import type { Village, Merchant } from '@/types';

// Fetch admin stats
export async function fetchAdminStats(): Promise<AdminStats> {
  const [merchants, villages, couriers, products, orders, promotions, refunds, profiles] = await Promise.all([
    supabase.from('merchants').select('id, registration_status', { count: 'exact' }),
    supabase.from('villages').select('id, registration_status', { count: 'exact' }),
    supabase.from('couriers').select('id, registration_status', { count: 'exact' }),
    supabase.from('products').select('id', { count: 'exact' }),
    supabase.from('orders').select('id', { count: 'exact' }),
    supabase.from('promotions').select('id', { count: 'exact' }),
    supabase.from('refund_requests').select('id, status', { count: 'exact' }),
    supabase.from('profiles').select('id, is_blocked', { count: 'exact' }),
  ]);

  const pendingMerchants = merchants.data?.filter(m => m.registration_status === 'PENDING').length || 0;
  const pendingVillages = villages.data?.filter(v => v.registration_status === 'PENDING').length || 0;
  const pendingCouriers = couriers.data?.filter(c => c.registration_status === 'PENDING').length || 0;
  const pendingRefunds = refunds.data?.filter(r => r.status === 'PENDING').length || 0;
  const blockedUsers = profiles.data?.filter(p => p.is_blocked).length || 0;

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
    pendingRefunds,
    totalUsers: profiles.count || 0,
    blockedUsers,
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
  // 1. Get the merchant data to find the user_id
  const { data: merchant, error: fetchError } = await supabase
    .from('merchants')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !merchant) {
    console.error('Error fetching merchant for approval:', fetchError);
    return false;
  }

  // 2. Update merchant status
  const { error: updateError } = await supabase
    .from('merchants')
    .update({
      registration_status: 'APPROVED',
      status: 'ACTIVE',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Error approving merchant:', updateError);
    return false;
  }

  // 3. Assign 'merchant' role to the user if they have a user_id
  if (merchant.user_id) {
    // Check if user already has the merchant role
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', merchant.user_id)
      .eq('role', 'merchant')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: merchant.user_id,
          role: 'merchant'
        });
      
      if (roleError) {
        console.error('Error assigning merchant role:', roleError);
        // We don't return false here because the merchant status was already updated successfully
      }
    }
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
  // 1. Get the village data to find the user_id
  const { data: village, error: fetchError } = await supabase
    .from('villages')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !village) {
    console.error('Error fetching village for approval:', fetchError);
    return false;
  }

  // 2. Update village status
  const { error: updateError } = await supabase
    .from('villages')
    .update({
      registration_status: 'APPROVED',
      is_active: true,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Error approving village:', updateError);
    return false;
  }

  // 3. Assign 'admin_desa' role to the user if they have a user_id
  if (village.user_id) {
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', village.user_id)
      .eq('role', 'admin_desa')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: village.user_id,
          role: 'admin_desa'
        });
      
      if (roleError) {
        console.error('Error assigning admin_desa role:', roleError);
      }
    }
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
  // 1. Get the courier data to find the user_id
  const { data: courier, error: fetchError } = await supabase
    .from('couriers')
    .select('user_id')
    .eq('id', id)
    .single();

  if (fetchError || !courier) {
    console.error('Error fetching courier for approval:', fetchError);
    return false;
  }

  // 2. Update courier status
  const { error: updateError } = await supabase
    .from('couriers')
    .update({
      registration_status: 'APPROVED',
      status: 'ACTIVE',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Error approving courier:', updateError);
    return false;
  }

  // 3. Assign 'courier' role to the user if they have a user_id
  if (courier.user_id) {
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', courier.user_id)
      .eq('role', 'courier')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: courier.user_id,
          role: 'courier'
        });
      
      if (roleError) {
        console.error('Error assigning courier role:', roleError);
      }
    }
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

export async function deleteMerchant(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('merchants')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting merchant:', error);
    return false;
  }
  return true;
}

export async function deleteVillage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('villages')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting village:', error);
    return false;
  }
  return true;
}

export interface MerchantUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
}

/**
 * Fetches users with 'merchant' role who are not yet linked to any merchant.
 * If currentUserId is provided, it will be included in the results even if already linked.
 */
export async function getAvailableMerchantUsers(currentUserId?: string | null): Promise<MerchantUser[]> {
  try {
    // 1. Get all users with 'merchant' role
    const { data: allMerchants, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone_number')
      .eq('role', 'merchant');

    if (usersError) throw usersError;
    if (!allMerchants) return [];

    // 2. Get all user_ids already used in merchants table
    const { data: usedMerchants, error: merchantsError } = await supabase
      .from('merchants')
      .select('user_id')
      .not('user_id', 'is', null);

    if (merchantsError) throw merchantsError;

    const usedUserIds = new Set(usedMerchants?.map(m => m.user_id) || []);

    // 3. Filter: Available = AllMerchantUsers - UsedUserIds (+ currentUserId)
    return allMerchants.filter(user => {
      if (currentUserId && user.id === currentUserId) return true;
      return !usedUserIds.has(user.id);
    });
  } catch (error) {
    console.error('Error fetching available merchant users:', error);
    return [];
  }
}

export async function getVillages(): Promise<Village[]> {
  const { data, error } = await supabase
    .from('villages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching villages:', error);
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
    latitude: v.location_lat,
    longitude: v.location_lng,
  }));
}

export async function createVillage(village: Partial<Village>): Promise<boolean> {
  const { error } = await supabase
    .from('villages')
    .insert({
      name: village.name,
      description: village.description,
      image_url: village.image,
      district: village.district,
      regency: village.regency,
      subdistrict: village.subdistrict,
      location_lat: village.latitude,
      location_lng: village.longitude,
      contact_name: village.contactName,
      contact_phone: village.contactPhone,
      contact_email: village.contactEmail,
      is_active: village.isActive ?? true,
      registration_status: 'APPROVED',
      registered_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error creating village:', error);
    return false;
  }
  return true;
}

export async function updateVillage(id: string, village: Partial<Village>): Promise<boolean> {
  const { error } = await supabase
    .from('villages')
    .update({
      name: village.name,
      description: village.description,
      image_url: village.image,
      district: village.district,
      regency: village.regency,
      subdistrict: village.subdistrict,
      location_lat: village.latitude,
      location_lng: village.longitude,
      contact_name: village.contactName,
      contact_phone: village.contactPhone,
      contact_email: village.contactEmail,
      is_active: village.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating village:', error);
    return false;
  }
  return true;
}
