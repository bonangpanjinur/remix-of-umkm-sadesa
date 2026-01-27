import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CourierCandidate {
  id: string
  name: string
  current_lat: number
  current_lng: number
  vehicle_type: string
  active_orders: number
  distance_km: number
}

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { order_id, merchant_lat, merchant_lng, max_distance_km = 10 } = await req.json()

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if order exists and is in correct status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, courier_id, merchant_id')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.courier_id) {
      return new Response(
        JSON.stringify({ error: 'Order already has courier assigned', courier_id: order.courier_id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get merchant location if not provided
    let pickupLat = merchant_lat
    let pickupLng = merchant_lng

    if (!pickupLat || !pickupLng) {
      // Try to get from merchant's village or use default
      const { data: merchant } = await supabase
        .from('merchants')
        .select('address, city, district')
        .eq('id', order.merchant_id)
        .single()
      
      // For now, use a default location if not provided
      // In production, this should geocode the merchant's address
      pickupLat = pickupLat || -6.9175  // Default to Bandung
      pickupLng = pickupLng || 107.6191
    }

    // Find available couriers
    const { data: couriers, error: courierError } = await supabase
      .from('couriers')
      .select('id, name, current_lat, current_lng, vehicle_type')
      .eq('status', 'ACTIVE')
      .eq('registration_status', 'APPROVED')
      .eq('is_available', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)

    if (courierError || !couriers || couriers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No available couriers found',
          couriers_checked: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get active order counts for each courier
    const courierIds = couriers.map(c => c.id)
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('courier_id')
      .in('courier_id', courierIds)
      .in('status', ['ASSIGNED', 'PICKED_UP', 'ON_DELIVERY'])

    const orderCounts: Record<string, number> = {}
    activeOrders?.forEach(o => {
      orderCounts[o.courier_id] = (orderCounts[o.courier_id] || 0) + 1
    })

    // Calculate distances and score couriers
    const candidates: CourierCandidate[] = couriers
      .map(c => ({
        id: c.id,
        name: c.name,
        current_lat: c.current_lat!,
        current_lng: c.current_lng!,
        vehicle_type: c.vehicle_type,
        active_orders: orderCounts[c.id] || 0,
        distance_km: calculateDistance(
          c.current_lat!,
          c.current_lng!,
          pickupLat,
          pickupLng
        )
      }))
      .filter(c => c.distance_km <= max_distance_km)
      .filter(c => c.active_orders < 3) // Max 3 concurrent orders per courier
      .sort((a, b) => {
        // Score based on distance (primary) and active orders (secondary)
        const scoreA = a.distance_km + (a.active_orders * 2)
        const scoreB = b.distance_km + (b.active_orders * 2)
        return scoreA - scoreB
      })

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No suitable couriers within range',
          couriers_checked: couriers.length,
          max_distance_km
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Assign the best candidate
    const bestCourier = candidates[0]

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        courier_id: bestCourier.id,
        status: 'ASSIGNED',
        assigned_at: new Date().toISOString()
      })
      .eq('id', order_id)

    if (updateError) {
      console.error('Error assigning courier:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to assign courier' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create notification for courier
    const { data: courierData } = await supabase
      .from('couriers')
      .select('user_id')
      .eq('id', bestCourier.id)
      .single()

    if (courierData?.user_id) {
      await supabase.from('notifications').insert({
        user_id: courierData.user_id,
        title: 'Pesanan Baru Ditugaskan',
        message: `Anda mendapat pesanan baru #${order_id.slice(0, 8).toUpperCase()}. Segera ambil pesanan.`,
        type: 'order',
        link: '/courier'
      })
    }

    // Record courier earning (pending)
    const { data: orderDetails } = await supabase
      .from('orders')
      .select('shipping_cost')
      .eq('id', order_id)
      .single()

    if (orderDetails?.shipping_cost) {
      const courierFee = Math.floor(orderDetails.shipping_cost * 0.8) // 80% of shipping
      await supabase.from('courier_earnings').insert({
        courier_id: bestCourier.id,
        order_id: order_id,
        amount: courierFee,
        type: 'DELIVERY',
        status: 'PENDING'
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        courier: {
          id: bestCourier.id,
          name: bestCourier.name,
          distance_km: Math.round(bestCourier.distance_km * 10) / 10,
          vehicle_type: bestCourier.vehicle_type
        },
        candidates_count: candidates.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in assign-courier:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
