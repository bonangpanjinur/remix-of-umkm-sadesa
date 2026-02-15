import { 
  fetchProvinces, 
  fetchRegencies, 
  fetchDistricts, 
  fetchVillages, 
  Region 
} from '@/lib/addressApi';

export type { Region };

export const locationService = {
  /**
   * Mengambil daftar provinsi
   */
  getProvinces: async (): Promise<Region[]> => {
    try {
      return await fetchProvinces();
    } catch (error) {
      console.error('Error in locationService.getProvinces:', error);
      return [];
    }
  },

  /**
   * Mengambil daftar kabupaten/kota berdasarkan kode provinsi
   */
  getRegencies: async (provinceCode: string): Promise<Region[]> => {
    try {
      return await fetchRegencies(provinceCode);
    } catch (error) {
      console.error('Error in locationService.getRegencies:', error);
      return [];
    }
  },

  /**
   * Mengambil daftar kecamatan berdasarkan kode kabupaten/kota
   */
  getDistricts: async (regencyCode: string): Promise<Region[]> => {
    try {
      return await fetchDistricts(regencyCode);
    } catch (error) {
      console.error('Error in locationService.getDistricts:', error);
      return [];
    }
  },

  /**
   * Mengambil daftar kelurahan berdasarkan kode kecamatan
   */
  getVillages: async (districtCode: string): Promise<Region[]> => {
    try {
      return await fetchVillages(districtCode);
    } catch (error) {
      console.error('Error in locationService.getVillages:', error);
      return [];
    }
  },

  /**
   * Mendapatkan nama wilayah berdasarkan ID dari daftar wilayah yang ada
   */
  getNameById: (regions: Region[], id: string): string => {
    const region = regions.find(r => r.code === id);
    return region ? region.name : '';
  }
};
