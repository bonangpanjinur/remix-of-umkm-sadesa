/**
 * Distance and ETA Calculation Utilities
 * Uses Haversine formula for distance calculation
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

// Average speeds for different vehicle types (km/h)
export const VEHICLE_SPEEDS = {
  motor: 25, // Motorcycle in city traffic
  mobil: 20, // Car in city traffic
  sepeda: 15, // Bicycle
  jalan_kaki: 5, // Walking
} as const;

export type VehicleType = keyof typeof VEHICLE_SPEEDS;

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates the distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates ETA in minutes based on distance and vehicle type
 */
export function calculateETA(
  from: Coordinates, 
  to: Coordinates, 
  vehicleType: VehicleType = 'motor'
): number {
  const distance = calculateDistance(from, to);
  const speedKmh = VEHICLE_SPEEDS[vehicleType];
  
  // Convert to minutes
  const etaHours = distance / speedKmh;
  const etaMinutes = Math.ceil(etaHours * 60);
  
  // Add buffer for traffic, stops, etc. (20%)
  return Math.ceil(etaMinutes * 1.2);
}

/**
 * Formats ETA into human-readable string
 */
export function formatETA(minutes: number): string {
  if (minutes < 1) {
    return 'Tiba sebentar lagi';
  }
  
  if (minutes < 60) {
    return `${minutes} menit`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} jam`;
  }
  
  return `${hours} jam ${remainingMinutes} menit`;
}

/**
 * Formats distance into human-readable string
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  
  return `${km.toFixed(1)} km`;
}

/**
 * Calculates and formats both distance and ETA
 */
export function getDeliveryEstimate(
  courierLocation: Coordinates,
  deliveryLocation: Coordinates,
  vehicleType: VehicleType = 'motor'
): {
  distance: number;
  distanceFormatted: string;
  etaMinutes: number;
  etaFormatted: string;
} {
  const distance = calculateDistance(courierLocation, deliveryLocation);
  const etaMinutes = calculateETA(courierLocation, deliveryLocation, vehicleType);
  
  return {
    distance,
    distanceFormatted: formatDistance(distance),
    etaMinutes,
    etaFormatted: formatETA(etaMinutes),
  };
}

/**
 * Creates a simple ETA range string (e.g., "15-20 menit")
 */
export function getETARange(
  courierLocation: Coordinates,
  deliveryLocation: Coordinates,
  vehicleType: VehicleType = 'motor'
): string {
  const { etaMinutes } = getDeliveryEstimate(courierLocation, deliveryLocation, vehicleType);
  
  // Create a range (±5 minutes or ±20% whichever is larger)
  const variance = Math.max(5, Math.ceil(etaMinutes * 0.2));
  const minEta = Math.max(1, etaMinutes - variance);
  const maxEta = etaMinutes + variance;
  
  if (maxEta < 60) {
    return `${minEta}-${maxEta} menit`;
  }
  
  // For longer times, show simpler format
  const minHours = Math.floor(minEta / 60);
  const maxHours = Math.ceil(maxEta / 60);
  
  if (minHours === maxHours) {
    return `sekitar ${minHours} jam`;
  }
  
  return `${minHours}-${maxHours} jam`;
}
