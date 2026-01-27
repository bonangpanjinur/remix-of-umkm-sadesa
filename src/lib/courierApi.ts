import { supabase } from '@/integrations/supabase/client';

interface AssignCourierResult {
  success: boolean;
  courier?: {
    id: string;
    name: string;
    distance_km: number;
    vehicle_type: string;
  };
  error?: string;
  candidates_count?: number;
}

/**
 * Auto-assign the nearest available courier to an order
 */
export async function autoAssignCourier(
  orderId: string,
  merchantLat?: number,
  merchantLng?: number,
  maxDistanceKm: number = 10
): Promise<AssignCourierResult> {
  try {
    const { data, error } = await supabase.functions.invoke('assign-courier', {
      body: {
        order_id: orderId,
        merchant_lat: merchantLat,
        merchant_lng: merchantLng,
        max_distance_km: maxDistanceKm,
      },
    });

    if (error) {
      console.error('Error calling assign-courier:', error);
      return { success: false, error: error.message };
    }

    return data as AssignCourierResult;
  } catch (err) {
    console.error('Error in autoAssignCourier:', err);
    return { success: false, error: 'Failed to assign courier' };
  }
}

/**
 * Manually assign a specific courier to an order
 */
export async function manualAssignCourier(
  orderId: string,
  courierId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if courier is available
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('id, name, is_available, status')
      .eq('id', courierId)
      .single();

    if (courierError || !courier) {
      return { success: false, error: 'Kurir tidak ditemukan' };
    }

    if (courier.status !== 'ACTIVE') {
      return { success: false, error: 'Kurir tidak aktif' };
    }

    // Update order with courier
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        courier_id: courierId,
        status: 'ASSIGNED',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error assigning courier:', updateError);
      return { success: false, error: 'Gagal menugaskan kurir' };
    }

    // Create notification for courier
    const { data: courierData } = await supabase
      .from('couriers')
      .select('user_id')
      .eq('id', courierId)
      .single();

    if (courierData?.user_id) {
      await supabase.from('notifications').insert({
        user_id: courierData.user_id,
        title: 'Pesanan Baru Ditugaskan',
        message: `Anda mendapat pesanan baru. Segera ambil pesanan.`,
        type: 'order',
        link: '/courier',
      });
    }

    return { success: true };
  } catch (err) {
    console.error('Error in manualAssignCourier:', err);
    return { success: false, error: 'Terjadi kesalahan' };
  }
}

/**
 * Get available couriers within a radius
 */
export async function getAvailableCouriers(
  lat?: number,
  lng?: number,
  maxDistanceKm: number = 10
): Promise<Array<{
  id: string;
  name: string;
  vehicle_type: string;
  distance_km?: number;
  active_orders: number;
}>> {
  try {
    // Get all available couriers
    const { data: couriers, error } = await supabase
      .from('couriers')
      .select('id, name, vehicle_type, current_lat, current_lng')
      .eq('status', 'ACTIVE')
      .eq('registration_status', 'APPROVED')
      .eq('is_available', true);

    if (error || !couriers) return [];

    // Get active order counts
    const courierIds = couriers.map((c) => c.id);
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('courier_id')
      .in('courier_id', courierIds)
      .in('status', ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY']);

    const orderCounts: Record<string, number> = {};
    activeOrders?.forEach((o) => {
      orderCounts[o.courier_id] = (orderCounts[o.courier_id] || 0) + 1;
    });

    // Calculate distances and return
    return couriers
      .map((c) => {
        let distance_km: number | undefined;
        if (lat && lng && c.current_lat && c.current_lng) {
          distance_km = calculateDistance(lat, lng, c.current_lat, c.current_lng);
        }
        return {
          id: c.id,
          name: c.name,
          vehicle_type: c.vehicle_type,
          distance_km,
          active_orders: orderCounts[c.id] || 0,
        };
      })
      .filter((c) => !c.distance_km || c.distance_km <= maxDistanceKm)
      .sort((a, b) => {
        if (a.distance_km && b.distance_km) {
          return a.distance_km - b.distance_km;
        }
        return a.active_orders - b.active_orders;
      });
  } catch (err) {
    console.error('Error getting available couriers:', err);
    return [];
  }
}

// Haversine formula
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
