import { useState, useCallback } from 'react';

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName?: string;
}

export interface ReverseGeocodingResult {
  province?: string;
  city?: string;
  district?: string;
  village?: string;
  displayName?: string;
  fullAddress?: string;
  postcode?: string;
}

export interface AddressSummary {
  province?: string;
  city?: string;
  district?: string;
  village?: string;
  detail?: string;
  coordinates?: { lat: number; lng: number };
}

// Nominatim API for geocoding (OpenStreetMap)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Forward geocoding - convert address to coordinates
 */
export async function geocodeAddress(
  districtName: string,
  villageName: string,
  cityName?: string,
  provinceName?: string
): Promise<GeocodingResult | null> {
  try {
    // Build search query - prioritize more specific address parts
    const queryParts = [villageName, districtName, cityName, provinceName, 'Indonesia']
      .filter(Boolean);
    const query = queryParts.join(', ');
    
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'id',
    });

    const response = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'PasarDesa/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const results = await response.json();
    
    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
        displayName: results[0].display_name,
      };
    }
    
    // Fallback: Try with just district and city
    if (villageName) {
      const fallbackQuery = [districtName, cityName, provinceName, 'Indonesia']
        .filter(Boolean)
        .join(', ');
      
      const fallbackParams = new URLSearchParams({
        q: fallbackQuery,
        format: 'json',
        limit: '1',
        countrycodes: 'id',
      });

      const fallbackResponse = await fetch(`${NOMINATIM_URL}/search?${fallbackParams.toString()}`, {
        headers: {
          'User-Agent': 'PasarDesa/1.0',
        },
      });

      if (fallbackResponse.ok) {
        const fallbackResults = await fallbackResponse.json();
        if (fallbackResults.length > 0) {
          return {
            lat: parseFloat(fallbackResults[0].lat),
            lng: parseFloat(fallbackResults[0].lon),
            displayName: fallbackResults[0].display_name,
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocoding - convert coordinates to address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1',
      'accept-language': 'id',
    });

    const response = await fetch(`${NOMINATIM_URL}/reverse?${params.toString()}`, {
      headers: {
        'User-Agent': 'PasarDesa/1.0',
      },
    });

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const result = await response.json();
    
    if (result.address) {
      const addr = result.address;
      
      // Extract address components with priority order for Indonesian regions
      const province = addr.state || addr.province;
      const city = addr.city || addr.county || addr.municipality || addr.regency;
      const district = addr.suburb || addr.subdistrict || addr.district || addr.town;
      const village = addr.village || addr.neighbourhood || addr.hamlet || addr.locality;
      const postcode = addr.postcode;
      
      return {
        province,
        city,
        district,
        village,
        displayName: result.display_name,
        fullAddress: result.display_name,
        postcode,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Format address summary for display
 */
export function formatAddressSummary(address: ReverseGeocodingResult | null): string {
  if (!address) return 'Alamat tidak terdeteksi';
  
  const parts: string[] = [];
  
  if (address.village) parts.push(address.village);
  if (address.district) parts.push(`Kec. ${address.district}`);
  if (address.city) parts.push(`Kota ${address.city}`);
  if (address.province) {
    // Remove 'Provinsi' prefix if present
    const provinceName = address.province.replace(/^Provinsi\s+/i, '');
    parts.push(`Prov. ${provinceName}`);
  }
  
  return parts.join(', ');
}

/**
 * Get address summary from coordinates (optimized for display)
 */
export async function getAddressSummary(lat: number, lng: number): Promise<AddressSummary | null> {
  try {
    const result = await reverseGeocode(lat, lng);
    
    if (!result) return null;
    
    return {
      province: result.province?.replace(/^Provinsi\s+/i, ''),
      city: result.city?.replace(/^Kota\s+|^Kab\.\s+/i, ''),
      district: result.district,
      village: result.village,
      coordinates: { lat, lng },
    };
  } catch (error) {
    console.error('Error getting address summary:', error);
    return null;
  }
}

/**
 * Hook for using geocoding functionality
 */
export function useGeocoding() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCoordinatesFromAddress = useCallback(async (
    districtName: string,
    villageName: string,
    cityName?: string,
    provinceName?: string
  ): Promise<GeocodingResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await geocodeAddress(districtName, villageName, cityName, provinceName);
      return result;
    } catch (err) {
      setError('Gagal mendapatkan koordinat');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAddressFromCoordinates = useCallback(async (
    lat: number,
    lng: number
  ): Promise<ReverseGeocodingResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await reverseGeocode(lat, lng);
      return result;
    } catch (err) {
      setError('Gagal mendapatkan alamat');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getCoordinatesFromAddress,
    getAddressFromCoordinates,
  };
}
