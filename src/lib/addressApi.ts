// Wilayah.id API for Indonesian regions
// Source: https://wilayah.id/

const BASE_URL = 'https://wilayah.id/api';

export interface Region {
  code: string;
  name: string;
}

interface WilayahResponse {
  data: Region[];
  meta: {
    administrative_area_level: number;
    updated_at: string;
  };
}

export async function fetchProvinces(): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/provinces.json`);
    if (!response.ok) throw new Error('Failed to fetch provinces');
    const result: WilayahResponse = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching provinces:', error);
    return [];
  }
}

export async function fetchRegencies(provinceCode: string): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/regencies/${provinceCode}.json`);
    if (!response.ok) throw new Error('Failed to fetch regencies');
    const result: WilayahResponse = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching regencies:', error);
    return [];
  }
}

export async function fetchDistricts(regencyCode: string): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/districts/${regencyCode}.json`);
    if (!response.ok) throw new Error('Failed to fetch districts');
    const result: WilayahResponse = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching districts:', error);
    return [];
  }
}

export async function fetchVillages(districtCode: string): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/villages/${districtCode}.json`);
    if (!response.ok) throw new Error('Failed to fetch villages');
    const result: WilayahResponse = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching villages:', error);
    return [];
  }
}
