import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchProvinces,
  fetchRegencies,
  fetchDistricts,
  fetchVillages,
  type Region,
} from '@/lib/addressApi';

export interface AddressData {
  province: string;
  provinceName: string;
  city: string;
  cityName: string;
  district: string;
  districtName: string;
  village: string;
  villageName: string;
  detail: string;
}

interface AddressSelectorProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  disabled?: boolean;
  initialNames?: {
    provinceName?: string;
    cityName?: string;
    districtName?: string;
    villageName?: string;
  };
}

export function AddressSelector({ value, onChange, disabled, initialNames }: AddressSelectorProps) {
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);
  
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  const [initialized, setInitialized] = useState(false);

  // Load provinces on mount
  useEffect(() => {
    const loadProvinces = async () => {
      setLoadingProvinces(true);
      const data = await fetchProvinces();
      setProvinces(data);
      setLoadingProvinces(false);

      // Auto-select province by name if provided
      if (initialNames?.provinceName && !value.province && !initialized) {
        const matchedProvince = data.find(
          (p) => p.name.toLowerCase() === initialNames.provinceName?.toLowerCase()
        );
        if (matchedProvince) {
          onChange({
            ...value,
            province: matchedProvince.code,
            provinceName: matchedProvince.name,
          });
        }
      }
    };
    loadProvinces();
  }, []);

  // Load cities when province changes
  useEffect(() => {
    if (value.province) {
      const loadCities = async () => {
        setLoadingCities(true);
        const data = await fetchRegencies(value.province);
        setCities(data);
        setLoadingCities(false);

        // Auto-select city by name if provided
        if (initialNames?.cityName && !value.city && !initialized) {
          const matchedCity = data.find(
            (c) => c.name.toLowerCase() === initialNames.cityName?.toLowerCase()
          );
          if (matchedCity) {
            onChange({
              ...value,
              city: matchedCity.code,
              cityName: matchedCity.name,
            });
          }
        }
      };
      loadCities();
    } else {
      setCities([]);
    }
  }, [value.province]);

  // Load districts when city changes
  useEffect(() => {
    if (value.city) {
      const loadDistricts = async () => {
        setLoadingDistricts(true);
        const data = await fetchDistricts(value.city);
        setDistricts(data);
        setLoadingDistricts(false);

        // Auto-select district by name if provided
        if (initialNames?.districtName && !value.district && !initialized) {
          const matchedDistrict = data.find(
            (d) => d.name.toLowerCase() === initialNames.districtName?.toLowerCase()
          );
          if (matchedDistrict) {
            onChange({
              ...value,
              district: matchedDistrict.code,
              districtName: matchedDistrict.name,
            });
          }
        }
      };
      loadDistricts();
    } else {
      setDistricts([]);
    }
  }, [value.city]);

  // Load villages when district changes
  useEffect(() => {
    if (value.district) {
      const loadVillages = async () => {
        setLoadingVillages(true);
        const data = await fetchVillages(value.district);
        setVillages(data);
        setLoadingVillages(false);

        // Auto-select village by name if provided
        if (initialNames?.villageName && !value.village && !initialized) {
          const matchedVillage = data.find(
            (v) => v.name.toLowerCase() === initialNames.villageName?.toLowerCase()
          );
          if (matchedVillage) {
            onChange({
              ...value,
              village: matchedVillage.code,
              villageName: matchedVillage.name,
            });
            setInitialized(true); // Mark as initialized after full chain
          }
        }
      };
      loadVillages();
    } else {
      setVillages([]);
    }
  }, [value.district]);

  const handleProvinceChange = (provinceCode: string) => {
    const province = provinces.find(p => p.code === provinceCode);
    setInitialized(true); // User manually changed, stop auto-fill
    onChange({
      province: provinceCode,
      provinceName: province?.name || '',
      city: '',
      cityName: '',
      district: '',
      districtName: '',
      village: '',
      villageName: '',
      detail: value.detail,
    });
  };

  const handleCityChange = (cityCode: string) => {
    const city = cities.find(c => c.code === cityCode);
    setInitialized(true);
    onChange({
      ...value,
      city: cityCode,
      cityName: city?.name || '',
      district: '',
      districtName: '',
      village: '',
      villageName: '',
    });
  };

  const handleDistrictChange = (districtCode: string) => {
    const district = districts.find(d => d.code === districtCode);
    setInitialized(true);
    onChange({
      ...value,
      district: districtCode,
      districtName: district?.name || '',
      village: '',
      villageName: '',
    });
  };

  const handleVillageChange = (villageCode: string) => {
    const village = villages.find(v => v.code === villageCode);
    setInitialized(true);
    onChange({
      ...value,
      village: villageCode,
      villageName: village?.name || '',
    });
  };

  const handleDetailChange = (detail: string) => {
    onChange({
      ...value,
      detail,
    });
  };

  return (
    <div className="space-y-3">
      {/* Province */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Provinsi</Label>
        <Select
          value={value.province}
          onValueChange={handleProvinceChange}
          disabled={disabled || loadingProvinces}
        >
          <SelectTrigger className="h-10">
            {loadingProvinces ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <SelectValue placeholder="Pilih Provinsi" />
            )}
          </SelectTrigger>
          <SelectContent>
            {provinces.map((province) => (
              <SelectItem key={province.code} value={province.code}>
                {province.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Kota/Kabupaten</Label>
        <Select
          value={value.city}
          onValueChange={handleCityChange}
          disabled={disabled || !value.province || loadingCities}
        >
          <SelectTrigger className="h-10">
            {loadingCities ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <SelectValue placeholder="Pilih Kota/Kabupaten" />
            )}
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.code} value={city.code}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Kecamatan</Label>
        <Select
          value={value.district}
          onValueChange={handleDistrictChange}
          disabled={disabled || !value.city || loadingDistricts}
        >
          <SelectTrigger className="h-10">
            {loadingDistricts ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <SelectValue placeholder="Pilih Kecamatan" />
            )}
          </SelectTrigger>
          <SelectContent>
            {districts.map((district) => (
              <SelectItem key={district.code} value={district.code}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Village */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Kelurahan/Desa</Label>
        <Select
          value={value.village}
          onValueChange={handleVillageChange}
          disabled={disabled || !value.district || loadingVillages}
        >
          <SelectTrigger className="h-10">
            {loadingVillages ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Memuat...</span>
              </div>
            ) : (
              <SelectValue placeholder="Pilih Kelurahan/Desa" />
            )}
          </SelectTrigger>
          <SelectContent>
            {villages.map((village) => (
              <SelectItem key={village.code} value={village.code}>
                {village.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Detail Address */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Detail Alamat (RT/RW, Nama Jalan, dll)</Label>
        <Textarea
          value={value.detail}
          onChange={(e) => handleDetailChange(e.target.value)}
          placeholder="Contoh: Jl. Merdeka No. 10, RT 01/RW 02"
          className="min-h-[70px] resize-none"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// Helper function to format full address from AddressData
export function formatFullAddress(data: AddressData): string {
  const parts = [
    data.detail,
    data.villageName,
    data.districtName,
    data.cityName,
    data.provinceName,
  ].filter(Boolean);
  return parts.join(', ');
}

// Helper function to create empty AddressData
export function createEmptyAddressData(): AddressData {
  return {
    province: '',
    provinceName: '',
    city: '',
    cityName: '',
    district: '',
    districtName: '',
    village: '',
    villageName: '',
    detail: '',
  };
}
