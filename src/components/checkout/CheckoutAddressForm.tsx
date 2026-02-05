import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddressSelector, type AddressData, formatFullAddress, createEmptyAddressData } from '@/components/AddressSelector';
import { LocationPicker } from './LocationPicker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useGeocoding, reverseGeocode } from '@/hooks/useGeocoding';
import { fetchProvinces, fetchRegencies, fetchDistricts, fetchVillages } from '@/lib/addressApi';

export interface CheckoutAddressData {
  name: string;
  phone: string;
  address: AddressData;
  location: { lat: number; lng: number } | null;
  fullAddress: string;
}

interface CheckoutAddressFormProps {
  value: CheckoutAddressData;
  onChange: (data: CheckoutAddressData) => void;
  onDistanceChange?: (distanceKm: number) => void;
  merchantLocation?: { lat: number; lng: number } | null;
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
  errors,
}: CheckoutAddressFormProps) {
  const { user } = useAuth();
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileWasEmpty, setProfileWasEmpty] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [reverseGeocodingLoading, setReverseGeocodingLoading] = useState(false);
  const { loading: geocodingLoading, getCoordinatesFromAddress } = useGeocoding();
  const isUpdatingFromMap = useRef(false);

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!user || profileLoaded) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const profileHasAddress = profile.province_id || profile.city_id || profile.district_id;
          setProfileWasEmpty(!profileHasAddress);
          
          const hasExistingData = value.name || value.phone || value.address.province;
          
          if (!hasExistingData && profileHasAddress) {
            const addressData: AddressData = {
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
              address: addressData,
              location: value.location,
              fullAddress: formatFullAddress(addressData),
            });

            // Auto-geocode the address to set map center
            if (addressData.district && addressData.districtName) {
              setTimeout(async () => {
                const coords = await getCoordinatesFromAddress(
                  addressData.districtName,
                  addressData.villageName,
                  addressData.cityName,
                  addressData.provinceName
                );
                if (coords) {
                  setMapCenter({ lat: coords.lat, lng: coords.lng });
                }
              }, 500);
            }
          } else if (!hasExistingData) {
            onChange({
              ...value,
              name: profile.full_name || '',
              phone: profile.phone || '',
            });
          }
        }
        setProfileLoaded(true);
      } catch (error) {
        console.error('Error loading profile:', error);
        setProfileLoaded(true);
      }
    };

    loadProfile();
  }, [user, profileLoaded]);

  // Geocode when address changes (forward geocoding)
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

  // Save address to profile if profile was empty
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

  const handleLocationChange = (location: { lat: number; lng: number }) => {
    onChange({ ...value, location });
  };

  // Handle when user selects location on map or uses "Lokasi Saya" - reverse geocode
  const handleLocationSelected = useCallback(async (lat: number, lng: number) => {
    isUpdatingFromMap.current = true;
    setReverseGeocodingLoading(true);
    
    try {
      const result = await reverseGeocode(lat, lng);
      
      if (result) {
        // Try to match the reverse geocoded address to our region codes
        // This is a simplified matching - in production you'd want fuzzy matching
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
        
        // If we couldn't match all levels, just update the location
        onChange({
          ...value,
          location: { lat, lng },
        });
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Still update the location even if reverse geocoding fails
      onChange({
        ...value,
        location: { lat, lng },
      });
    } finally {
      setReverseGeocodingLoading(false);
    }
  }, [value, onChange]);

  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Info Penerima</h4>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="checkout-name" className="text-xs text-muted-foreground">
              Nama Penerima
            </Label>
            <Input
              id="checkout-name"
              placeholder="Nama lengkap penerima"
              value={value.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
            {errors?.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="checkout-phone" className="text-xs text-muted-foreground">
              No. Telepon (WhatsApp)
            </Label>
            <PhoneInput
              value={value.phone}
              onChange={handlePhoneChange}
              placeholder="08xxxxxxxxxx"
            />
            {errors?.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Address Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Alamat Pengiriman</h4>
          {(geocodingLoading || reverseGeocodingLoading) && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>

        <AddressSelector
          value={value.address}
          onChange={handleAddressChange}
        />
        {errors?.address && (
          <p className="text-xs text-destructive">{errors.address}</p>
        )}
      </div>

      {/* Map Location Picker */}
      <div className="space-y-4">
        <LocationPicker
          value={value.location}
          onChange={handleLocationChange}
          merchantLocation={merchantLocation}
          onDistanceChange={onDistanceChange}
          onLocationSelected={handleLocationSelected}
          externalCenter={mapCenter}
        />
        {errors?.location && (
          <p className="text-xs text-destructive">{errors.location}</p>
        )}
      </div>
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
  };
}
