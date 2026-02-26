import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
  preloadAddressChain,
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
  showDetailInput?: boolean;
}

export function AddressSelector({ 
  value, 
  onChange, 
  disabled,
  showDetailInput = true 
}: AddressSelectorProps) {
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);
  
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Initial load - preload all data if we have existing codes
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const initializeData = async () => {
      setError(null);
      
      // If we have existing address codes, preload the entire chain
      if (value.province && value.city && value.district) {
        setLoadingProvinces(true);
        setLoadingCities(true);
        setLoadingDistricts(true);
        setLoadingVillages(true);
        
        try {
          const result = await preloadAddressChain(
            value.province,
            value.city,
            value.district
          );
          
          setProvinces(result.provinces);
          setCities(result.cities);
          setDistricts(result.districts);
          setVillages(result.villages);
        } catch (err) {
          setError('Gagal memuat data alamat');
          console.error('Error preloading address chain:', err);
        } finally {
          setLoadingProvinces(false);
          setLoadingCities(false);
          setLoadingDistricts(false);
          setLoadingVillages(false);
        }
      } else {
        // Just load provinces
        setLoadingProvinces(true);
        try {
          const data = await fetchProvinces();
          setProvinces(data);
          if (data.length === 0) {
            setError('Tidak dapat memuat data provinsi');
          }
        } catch (err) {
          setError('Gagal memuat data provinsi');
        } finally {
          setLoadingProvinces(false);
        }
      }
    };

    initializeData();
  }, []);

  // Load cities when province changes (after initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (!value.province) {
      setCities([]);
      return;
    }

    const loadCities = async () => {
      setLoadingCities(true);
      try {
        const data = await fetchRegencies(value.province);
        setCities(data);
      } catch (err) {
        console.error('Error loading cities:', err);
      } finally {
        setLoadingCities(false);
      }
    };
    
    loadCities();
  }, [value.province]);

  // Load districts when city changes
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (!value.city) {
      setDistricts([]);
      return;
    }

    const loadDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const data = await fetchDistricts(value.city);
        setDistricts(data);
      } catch (err) {
        console.error('Error loading districts:', err);
      } finally {
        setLoadingDistricts(false);
      }
    };
    
    loadDistricts();
  }, [value.city]);

  // Load villages when district changes
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (!value.district) {
      setVillages([]);
      return;
    }

    const loadVillages = async () => {
      setLoadingVillages(true);
      setError(null);
      try {
        const data = await fetchVillages(value.district);
        setVillages(data);
        if (data.length === 0) {
          console.warn('No villages found for district:', value.district);
        }
      } catch (err) {
        console.error('Error loading villages:', err);
        setError('Gagal memuat data desa/kelurahan. Silakan coba lagi.');
      } finally {
        setLoadingVillages(false);
      }
    };
    
    loadVillages();
  }, [value.district]);

  const handleRetry = useCallback(async () => {
    setError(null);
    initialLoadDone.current = false;
    setLoadingProvinces(true);
    
    try {
      const data = await fetchProvinces();
      setProvinces(data);
      initialLoadDone.current = true;
      
      if (data.length === 0) {
        setError('Tidak dapat memuat data provinsi');
      }
    } catch (err) {
      setError('Gagal memuat data provinsi');
    } finally {
      setLoadingProvinces(false);
    }
  }, []);

  const handleProvinceChange = (provinceCode: string) => {
    const province = provinces.find(p => p.code === provinceCode);
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
    // Reset dependent lists
    setDistricts([]);
    setVillages([]);
  };

  const handleCityChange = (cityCode: string) => {
    const city = cities.find(c => c.code === cityCode);
    onChange({
      ...value,
      city: cityCode,
      cityName: city?.name || '',
      district: '',
      districtName: '',
      village: '',
      villageName: '',
    });
    // Reset dependent lists
    setVillages([]);
  };

  const handleDistrictChange = (districtCode: string) => {
    const district = districts.find(d => d.code === districtCode);
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

  // Error state
  if (error && provinces.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={loadingProvinces}
        >
          {loadingProvinces ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Coba Lagi
        </Button>
      </div>
    );
  }

  const isLoading = loadingProvinces || loadingCities || loadingDistricts || loadingVillages;

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
                <span className="text-muted-foreground">Memuat provinsi...</span>
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
                <span className="text-muted-foreground">Memuat kota...</span>
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
                <span className="text-muted-foreground">Memuat kecamatan...</span>
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
          <SelectTrigger className={`h-10 ${!value.village && value.district && !loadingVillages && villages.length === 0 ? 'border-warning' : ''}`}>
            {loadingVillages ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-muted-foreground">Memuat desa...</span>
              </div>
            ) : (
              <SelectValue placeholder={villages.length === 0 && value.district ? "Data desa tidak tersedia" : "Pilih Kelurahan/Desa"} />
            )}
          </SelectTrigger>
          <SelectContent>
            {villages.length > 0 ? (
              villages.map((village) => (
                <SelectItem key={village.code} value={village.code}>
                  {village.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-xs text-center text-muted-foreground">
                {value.district ? "Tidak ada data desa" : "Pilih kecamatan terlebih dahulu"}
              </div>
            )}
          </SelectContent>
        </Select>
        {value.district && !loadingVillages && villages.length === 0 && (
          <p className="text-[10px] text-amber-600 mt-1">
            Jika data desa tidak muncul, coba pilih ulang kecamatan atau refresh halaman.
          </p>
        )}
      </div>

      {/* Detail Address */}
      {showDetailInput && (
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
      )}
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
