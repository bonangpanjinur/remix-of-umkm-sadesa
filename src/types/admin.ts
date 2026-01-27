export interface Courier {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  address: string;
  ktpNumber: string;
  ktpImageUrl: string;
  photoUrl: string;
  vehicleType: string;
  vehiclePlate?: string;
  vehicleImageUrl: string;
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'ACTIVE' | 'INACTIVE';
  isAvailable: boolean;
  currentLat?: number;
  currentLng?: number;
  lastLocationUpdate?: string;
  villageId?: string;
  villageName?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  registeredAt: string;
  createdAt: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description?: string;
  category: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationSettings {
  enabled: boolean;
}

export interface AddressApiSettings {
  provider: string;
  base_url: string;
}

export interface PaymentSettings {
  enabled: boolean;
  server_key?: string;
  client_key?: string;
  secret_key?: string;
  public_key?: string;
  is_production?: boolean;
}

export interface ShippingFeeSettings {
  base_fee: number;
  per_km_fee: number;
  min_fee: number;
  max_fee: number;
  free_shipping_min_order: number;
}

export interface PlatformFeeSettings {
  percentage: number;
  min_fee: number;
  max_fee: number;
  enabled: boolean;
}

export interface ShippingZone {
  name: string;
  max_distance_km: number;
  fee: number;
}

export interface ShippingZonesSettings {
  zones: ShippingZone[];
}

export interface AdminStats {
  totalMerchants: number;
  pendingMerchants: number;
  totalVillages: number;
  pendingVillages: number;
  totalCouriers: number;
  pendingCouriers: number;
  totalProducts: number;
  totalOrders: number;
  totalPromotions: number;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ApprovalType = 'merchant' | 'village' | 'courier';
