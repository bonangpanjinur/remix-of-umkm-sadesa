import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, User, Loader2, BookMarked, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AddressSelector, type AddressData, formatFullAddress, createEmptyAddressData } from '@/components/AddressSelector';
import { LocationPicker } from './LocationPicker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useGeocoding, reverseGeocode, formatAddressSummary, type ReverseGeocodingResult } from '@/hooks/useGeocoding';
import { fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages } from '@/lib/addressApi';
import { useSavedAddresses, type SavedAddress } from '@/hooks/useSavedAddresses';
import { AddressCard } from '@/components/address/AddressCard';
import { Skeleton } from '@/components/ui/skeleton';

export interface CheckoutAddressData {
  name: string;
  phone: string;
  address: AddressData;
  location: { lat: number; lng: number } | null;
  fullAddress: string;
  detailAddress?: string;
}

interface CheckoutAddressFormProps {
  value: CheckoutAddressData;
  onChange: (data: CheckoutAddressData) => void;
  onDistanceChange?: (distanceKm: number) => void;
  merchantLocation?: { lat: number; lng: number } | null;
  hideMap?: boolean;
  errors?: {
    name?: string;
    phone?: string;
    address?: string;
    location?: string;
  };
}

export function CheckoutAddressForm({
  value,
  onChange,
  onDistanceChange,
  merchantLocation,
  hideMap,
  errors,
}: CheckoutAddressFormProps) {
  const { user } = useAuth();
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileWasEmpty, setProfileWasEmpty] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [reverseGeocodingLoading, setReverseGeocodingLoading] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<ReverseGeocodingResult | null>(null);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const { loading: geocodingLoading, getCoordinatesFromAddress } = useGeocoding();
  const isUpdatingFromMap = useRef(false);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const { addresses: savedAddresses, loading: savedAddressesLoading } = useSavedAddresses();

  // Computed: is address complete?
  const isAddressComplete = !!(value.address.province && value.address.city && value.address.district && value.address.village);
  const isContactComplete = !!(value.name && value.phone);
  const hasDetectedLocation = !!(value.location && detectedAddress);

  // Auto-populate from default saved address or profile on mount
  useEffect(() => {
    if (!user || profileLoaded) return;

    const autoPopulate = async () => {
      try {
        const defaultAddr = savedAddresses.find(a => a.is_default) || (savedAddresses.length > 0 ? savedAddresses[0] : null);
        
        if (defaultAddr) {
          const addrData: AddressData = {
            province: defaultAddr.province_id || '',
            provinceName: defaultAddr.province_name || '',
            city: defaultAddr.city_id || '',
            cityName: defaultAddr.city_name || '',
            district: defaultAddr.district_id || '',
            districtName: defaultAddr.district_name || '',
            village: defaultAddr.village_id || '',
            villageName: defaultAddr.village_name || '',
            detail: defaultAddr.address_detail || '',
          };

          const loc = defaultAddr.lat && defaultAddr.lng ? { lat: defaultAddr.lat, lng: defaultAddr.lng } : null;

          onChange({
            name: defaultAddr.recipient_name,
            phone: defaultAddr.phone,
            address: addrData,
            location: loc,
            fullAddress: defaultAddr.full_address || formatFullAddress(addrData),
            detailAddress: defaultAddr.address_detail || '',
          });

          if (loc) {
            setMapCenter(loc);
            const detected = await reverseGeocode(loc.lat, loc.lng);
            setDetectedAddress(detected);
          } else if (addrData.district && addrData.districtName) {
            const coords = await getCoordinatesFromAddress(addrData.districtName, addrData.villageName, addrData.cityName, addrData.provinceName);
            if (coords) setMapCenter({ lat: coords.lat, lng: coords.lng });
          }

          setProfileLoaded(true);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          const profileHasAddress = profile.province_id || profile.city_id || profile.district_id;
          setProfileWasEmpty(!profileHasAddress);

          if (profileHasAddress) {
            const addrData: AddressData = {
              province: profile.province_id || '',
              provinceName: profile.province_name || '',
              city: profile.city_id || '',
              cityName: profile.city_name || '',
              district: profile.district_id || '',
              districtName: profile.district_name || '',
              village: profile.village_id || '',
              villageName: profile.village_name || '',
              detail: profile.address_detail || '',
            };

            onChange({
              name: profile.full_name || '',
              phone: profile.phone || '',
              address: addrData,
              location: null,
              fullAddress: formatFullAddress(addrData),
              detailAddress: profile.address_detail || '',
            });

            if (addrData.district && addrData.districtName) {
              const coords = await getCoordinatesFromAddress(addrData.districtName, addrData.villageName, addrData.cityName, addrData.provinceName);
              if (coords) setMapCenter({ lat: coords.lat, lng: coords.lng });
            }
          } else {
            onChange({
              ...value,
              name: profile.full_name || '',
              phone: profile.phone || '',
            });
          }
        }
        setProfileLoaded(true);
      } catch (error) {
        console.error('Error auto-populating checkout:', error);
        setProfileLoaded(true);
      }
    };

    if (!savedAddressesLoading) {
      autoPopulate();
    }
  }, [user, profileLoaded, savedAddressesLoading, savedAddresses.length]);

  useEffect(() => {
    if (isUpdatingFromMap.current) {
      isUpdatingFromMap.current = false;
      return;
    }

    if (value.address.district && value.address.districtName) {
      const geocodeAddress = async () => {
        const coords = await getCoordinatesFromAddress(
          value.address.districtName,
          value.address.villageName,
          value.address.cityName,
          value.address.provinceName
        );
        if (coords) {
          setMapCenter({ lat: coords.lat, lng: coords.lng });
        }
      };
      geocodeAddress();
    }
  }, [value.address.district, value.address.village]);

  const saveAddressToProfile = useCallback(async (addressData: CheckoutAddressData) => {
    if (!user || !profileWasEmpty) return;
    if (!addressData.address.province || !addressData.address.city) return;

    try {
      await supabase
        .from('profiles')
        .update({
          full_name: addressData.name || undefined,
          phone: addressData.phone || undefined,
          province_id: addressData.address.province,
          province_name: addressData.address.provinceName,
          city_id: addressData.address.city,
          city_name: addressData.address.cityName,
          district_id: addressData.address.district || null,
          district_name: addressData.address.districtName || null,
          village_id: addressData.address.village || null,
          village_name: addressData.address.villageName || null,
          address_detail: addressData.address.detail || null,
        })
        .eq('user_id', user.id);
      
      setProfileWasEmpty(false);
    } catch (error) {
      console.error('Error saving address to profile:', error);
    }
  }, [user, profileWasEmpty]);

  const handleNameChange = (name: string) => {
    onChange({ ...value, name });
  };

  const handlePhoneChange = (phone: string) => {
    onChange({ ...value, phone });
  };

  const handleAddressChange = (address: AddressData) => {
    const newData = {
      ...value,
      address,
      fullAddress: formatFullAddress(address),
    };
    onChange(newData);
    
    if (profileWasEmpty && address.province && address.city) {
      saveAddressToProfile(newData);
    }
  };

  const handleDetailAddressChange = (detail: string) => {
    onChange({ ...value, detailAddress: detail });
  };

  const handleLocationChange = (location: { lat: number; lng: number }) => {
    onChange({ ...value, location });
  };

  const handleSelectSavedAddress = useCallback(async (address: SavedAddress) => {
    const addressData: AddressData = {
      province: address.province_id || '',
      provinceName: address.province_name || '',
      city: address.city_id || '',
      cityName: address.city_name || '',
      district: address.district_id || '',
      districtName: address.district_name || '',
      village: address.village_id || '',
      villageName: address.village_name || '',
      detail: address.address_detail || '',
    };

    const location = address.lat && address.lng ? { lat: address.lat, lng: address.lng } : value.location;

    onChange({
      name: address.recipient_name,
      phone: address.phone,
      address: addressData,
      location,
      fullAddress: address.full_address || formatFullAddress(addressData),
      detailAddress: address.address_detail || '',
    });

    if (address.lat && address.lng) {
      setMapCenter({ lat: address.lat, lng: address.lng });
      const detected = await reverseGeocode(address.lat, address.lng);
      setDetectedAddress(detected);
    } else if (addressData.district && addressData.districtName) {
      const coords = await getCoordinatesFromAddress(
        addressData.districtName,
        addressData.villageName,
        addressData.cityName,
        addressData.provinceName
      );
      if (coords) {
        setMapCenter({ lat: coords.lat, lng: coords.lng });
      }
    }

    setShowSavedAddresses(false);
  }, [value, onChange, getCoordinatesFromAddress]);

  const handleLocationSelected = useCallback(async (lat: number, lng: number) => {
    isUpdatingFromMap.current = true;
    setReverseGeocodingLoading(true);
    
    try {
      const result = await reverseGeocode(lat, lng);
      setDetectedAddress(result);
      
      if (result) {
        const provinces = await fetchProvinces();
        const matchedProvince = provinces.find(p => 
          result.province && p.name.toLowerCase().includes(result.province.toLowerCase().replace(/provinsi\s*/i, ''))
        );
        
        if (matchedProvince) {
          const cities = await fetchRegencies(matchedProvince.code);
          const matchedCity = cities.find(c => 
            result.city && (
              c.name.toLowerCase().includes(result.city.toLowerCase()) ||
              result.city.toLowerCase().includes(c.name.toLowerCase().replace(/kab\.|kota\s*/i, ''))
            )
          );
          
          if (matchedCity) {
            const districts = await fetchDistricts(matchedCity.code);
            const matchedDistrict = districts.find(d => 
              result.district && (
                d.name.toLowerCase().includes(result.district.toLowerCase()) ||
                result.district.toLowerCase().includes(d.name.toLowerCase())
              )
            );
            
            if (matchedDistrict) {
              const villages = await fetchVillages(matchedDistrict.code);
              const matchedVillage = villages.find(v => 
                result.village && (
                  v.name.toLowerCase().includes(result.village.toLowerCase()) ||
                  result.village.toLowerCase().includes(v.name.toLowerCase())
                )
              );
              
              const newAddress: AddressData = {
                province: matchedProvince.code,
                provinceName: matchedProvince.name,
                city: matchedCity.code,
                cityName: matchedCity.name,
                district: matchedDistrict.code,
                districtName: matchedDistrict.name,
                village: matchedVillage?.code || '',
                villageName: matchedVillage?.name || '',
                detail: value.address.detail,
              };
              
              onChange({
                ...value,
                address: newAddress,
                location: { lat, lng },
                fullAddress: formatFullAddress(newAddress),
              });
              
              return;
            }
          }
        }
        
        onChange({
          ...value,
          location: { lat, lng },
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      onChange({
        ...value,
        location: { lat, lng },
      });
    } finally {
      setReverseGeocodingLoading(false);
    }
  }, [value, onChange]);

  if (!profileLoaded && user) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Saved Address Picker */}
      {savedAddresses.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowSavedAddresses(!showSavedAddresses)}
            className="w-full flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition"
          >
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Pilih Alamat Tersimpan</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-primary transition-transform ${showSavedAddresses ? 'rotate-180' : ''}`} />
          </button>
          
          {showSavedAddresses && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {savedAddresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  selectable
                  onSelect={handleSelectSavedAddress}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact Info with completion indicator */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {isContactComplete ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <User className="h-4 w-4 text-primary" />
          )}
          <h4 className="font-medium text-sm">Info Penerima</h4>
          {isContactComplete && (
            <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Lengkap</span>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5" id="error-name">
            <Label htmlFor="checkout-name" className="text-xs text-muted-foreground">
              Nama Penerima
            </Label>
            <Input
              id="checkout-name"
              placeholder="Nama lengkap penerima"
              value={value.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={errors?.name ? 'border-destructive' : ''}
            />
            {errors?.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5" id="error-phone">
            <Label htmlFor="checkout-phone" className="text-xs text-muted-foreground">
              No. Telepon (WhatsApp)
            </Label>
            <PhoneInput
              value={value.phone}
              onChange={handlePhoneChange}
              placeholder="08xxxxxxxxxx"
              className={errors?.phone ? 'border-destructive' : ''}
            />
            {errors?.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Map-First Address Input */}
      {!hideMap && (
        <div className="space-y-4" id="error-location">
          <div className="flex items-center gap-2">
            {hasDetectedLocation ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <MapPin className="h-4 w-4 text-primary" />
            )}
            <h4 className="font-medium text-sm">Titik Lokasi Pengiriman</h4>
            {(geocodingLoading || reverseGeocodingLoading) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {hasDetectedLocation && (
              <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Terdeteksi</span>
            )}
          </div>

          <div className={errors?.location ? 'rounded-lg border-2 border-destructive p-1' : ''}>
            <LocationPicker
              value={value.location}
              onChange={handleLocationChange}
              merchantLocation={merchantLocation}
              onDistanceChange={onDistanceChange}
              onLocationSelected={handleLocationSelected}
              externalCenter={mapCenter}
            />
          </div>
          {errors?.location && (
            <p className="text-xs text-destructive">{errors.location}</p>
          )}
        </div>
      )}

      {/* Detected Address Summary */}
      {value.location && detectedAddress && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-700 font-medium mb-1">Alamat Terdeteksi:</p>
              <p className="text-sm font-medium text-emerald-900 break-words">
                {formatAddressSummary(detectedAddress)}
              </p>
              {detectedAddress.postcode && (
                <p className="text-xs text-emerald-600 mt-1">
                  Kode Pos: {detectedAddress.postcode}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Address Input */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Detail Alamat</h4>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="checkout-detail" className="text-xs text-muted-foreground">
            Nomor Rumah, Patokan, atau Informasi Tambahan
          </Label>
          <Textarea
            id="checkout-detail"
            placeholder="Contoh: Rumah nomor 42, depan toko kelontong, sebelah masjid"
            value={value.detailAddress || ''}
            onChange={(e) => handleDetailAddressChange(e.target.value)}
            className={`min-h-20 resize-none ${!value.detailAddress && value.location ? 'border-amber-300 focus:border-amber-400' : ''}`}
          />
          <p className="text-xs text-muted-foreground">
            Informasi ini membantu kurir menemukan lokasi Anda dengan lebih mudah
          </p>
        </div>
      </div>

      {/* Address Selector - only show button if address is NOT complete from map detection */}
      {!isAddressComplete && (
        <div id="error-address">
          {!showAddressSelector ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddressSelector(true)}
              className={`w-full ${errors?.address ? 'border-destructive text-destructive' : 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
            >
              <MapPin className="h-3.5 w-3.5 mr-1.5" />
              Pilih Kelurahan/Desa Manual
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/50">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Pilih Wilayah</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddressSelector(false)}
                >
                  Tutup
                </Button>
              </div>
              <AddressSelector
                value={value.address}
                onChange={handleAddressChange}
              />
            </div>
          )}
          {errors?.address && (
            <p className="text-xs text-destructive mt-1 text-center">{errors.address}</p>
          )}
        </div>
      )}

      {/* If address IS complete, show a compact summary with edit option */}
      {isAddressComplete && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-emerald-700 font-medium">Wilayah:</p>
                <p className="text-sm text-foreground truncate">
                  {value.address.villageName}, {value.address.districtName}, {value.address.cityName}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-primary h-7 px-2 flex-shrink-0"
              onClick={() => setShowAddressSelector(!showAddressSelector)}
            >
              Ubah
            </Button>
          </div>
          
          {showAddressSelector && (
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <AddressSelector
                value={value.address}
                onChange={handleAddressChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function createEmptyCheckoutAddress(): CheckoutAddressData {
  return {
    name: '',
    phone: '',
    address: createEmptyAddressData(),
    location: null,
    fullAddress: '',
    detailAddress: '',
  };
}
