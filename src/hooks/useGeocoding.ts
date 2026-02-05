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
      return {
        province: addr.state || addr.province,
        city: addr.city || addr.county || addr.municipality || addr.regency,
        district: addr.suburb || addr.subdistrict || addr.district || addr.town,
        village: addr.village || addr.neighbourhood || addr.hamlet || addr.locality,
        displayName: result.display_name,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
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
