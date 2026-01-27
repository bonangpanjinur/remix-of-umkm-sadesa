// Emsifa API for Indonesian regions
// Source: https://github.com/emsifa/api-wilayah-indonesia

const BASE_URL = 'https://emsifa.github.io/api-wilayah-indonesia/api';

export interface Region {
  id: string;
  name: string;
}

export async function fetchProvinces(): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/provinces.json`);
    if (!response.ok) throw new Error('Failed to fetch provinces');
    return await response.json();
  } catch (error) {
    console.error('Error fetching provinces:', error);
    return [];
  }
}

export async function fetchRegencies(provinceId: string): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/regencies/${provinceId}.json`);
    if (!response.ok) throw new Error('Failed to fetch regencies');
    return await response.json();
  } catch (error) {
    console.error('Error fetching regencies:', error);
    return [];
  }
}

export async function fetchDistricts(regencyId: string): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/districts/${regencyId}.json`);
    if (!response.ok) throw new Error('Failed to fetch districts');
    return await response.json();
  } catch (error) {
    console.error('Error fetching districts:', error);
    return [];
  }
}

export async function fetchVillages(districtId: string): Promise<Region[]> {
  try {
    const response = await fetch(`${BASE_URL}/villages/${districtId}.json`);
    if (!response.ok) throw new Error('Failed to fetch villages');
    return await response.json();
  } catch (error) {
    console.error('Error fetching villages:', error);
    return [];
  }
}
