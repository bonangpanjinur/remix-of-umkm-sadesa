// Indonesian regions data for address selection
// This is a simplified version - in production, you might want to use an API

export interface Province {
  id: string;
  name: string;
}

export interface City {
  id: string;
  provinceId: string;
  name: string;
  type: 'kabupaten' | 'kota';
}

export interface District {
  id: string;
  cityId: string;
  name: string;
}

export interface Subdistrict {
  id: string;
  districtId: string;
  name: string;
}

// Sample data for West Java region (can be expanded)
export const provinces: Province[] = [
  { id: 'jawa-barat', name: 'Jawa Barat' },
  { id: 'jawa-tengah', name: 'Jawa Tengah' },
  { id: 'jawa-timur', name: 'Jawa Timur' },
  { id: 'banten', name: 'Banten' },
  { id: 'dki-jakarta', name: 'DKI Jakarta' },
  { id: 'diy', name: 'D.I. Yogyakarta' },
];

export const cities: City[] = [
  // Jawa Barat
  { id: 'bogor', provinceId: 'jawa-barat', name: 'Bogor', type: 'kabupaten' },
  { id: 'sukabumi', provinceId: 'jawa-barat', name: 'Sukabumi', type: 'kabupaten' },
  { id: 'cianjur', provinceId: 'jawa-barat', name: 'Cianjur', type: 'kabupaten' },
  { id: 'bandung', provinceId: 'jawa-barat', name: 'Bandung', type: 'kabupaten' },
  { id: 'garut', provinceId: 'jawa-barat', name: 'Garut', type: 'kabupaten' },
  { id: 'kota-bogor', provinceId: 'jawa-barat', name: 'Kota Bogor', type: 'kota' },
  { id: 'kota-bandung', provinceId: 'jawa-barat', name: 'Kota Bandung', type: 'kota' },
  // Jawa Tengah
  { id: 'semarang', provinceId: 'jawa-tengah', name: 'Semarang', type: 'kabupaten' },
  { id: 'solo', provinceId: 'jawa-tengah', name: 'Surakarta', type: 'kota' },
  // Add more as needed
];

export const districts: District[] = [
  // Bogor
  { id: 'megamendung', cityId: 'bogor', name: 'Megamendung' },
  { id: 'cisarua', cityId: 'bogor', name: 'Cisarua' },
  { id: 'ciawi', cityId: 'bogor', name: 'Ciawi' },
  { id: 'sukaraja', cityId: 'bogor', name: 'Sukaraja' },
  { id: 'cibinong', cityId: 'bogor', name: 'Cibinong' },
  // Sukabumi
  { id: 'cisaat', cityId: 'sukabumi', name: 'Cisaat' },
  { id: 'cibadak', cityId: 'sukabumi', name: 'Cibadak' },
  { id: 'palabuhanratu', cityId: 'sukabumi', name: 'Palabuhanratu' },
  // Bandung
  { id: 'lembang', cityId: 'bandung', name: 'Lembang' },
  { id: 'ciwidey', cityId: 'bandung', name: 'Ciwidey' },
  { id: 'pangalengan', cityId: 'bandung', name: 'Pangalengan' },
  // Add more as needed
];

export const subdistricts: Subdistrict[] = [
  // Megamendung
  { id: 'megamendung-sub', districtId: 'megamendung', name: 'Megamendung' },
  { id: 'cipayung-girang', districtId: 'megamendung', name: 'Cipayung Girang' },
  { id: 'sukaresmi', districtId: 'megamendung', name: 'Sukaresmi' },
  { id: 'bojong', districtId: 'megamendung', name: 'Bojong' },
  // Cisarua
  { id: 'tugu-utara', districtId: 'cisarua', name: 'Tugu Utara' },
  { id: 'tugu-selatan', districtId: 'cisarua', name: 'Tugu Selatan' },
  { id: 'cibeureum', districtId: 'cisarua', name: 'Cibeureum' },
  // Cisaat
  { id: 'sukamaju', districtId: 'cisaat', name: 'Sukamaju' },
  { id: 'cisaat-sub', districtId: 'cisaat', name: 'Cisaat' },
  { id: 'nagrak', districtId: 'cisaat', name: 'Nagrak' },
  // Lembang
  { id: 'lembang-sub', districtId: 'lembang', name: 'Lembang' },
  { id: 'cikole', districtId: 'lembang', name: 'Cikole' },
  { id: 'cibogo', districtId: 'lembang', name: 'Cibogo' },
  // Add more as needed
];

export function getCitiesByProvince(provinceId: string): City[] {
  return cities.filter(c => c.provinceId === provinceId);
}

export function getDistrictsByCity(cityId: string): District[] {
  return districts.filter(d => d.cityId === cityId);
}

export function getSubdistrictsByDistrict(districtId: string): Subdistrict[] {
  return subdistricts.filter(s => s.districtId === districtId);
}

export function getSubdistrictName(subdistrictId: string): string {
  const subdistrict = subdistricts.find(s => s.id === subdistrictId);
  return subdistrict?.name || '';
}
