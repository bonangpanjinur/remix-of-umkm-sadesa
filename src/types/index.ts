// Core domain types for Desa Wisata & UMKM Platform

export interface Village {
  id: string;
  name: string;
  district: string;
  regency: string;
  subdistrict?: string;
  description: string;
  image: string;
  isActive: boolean;
  registrationStatus?: string;
  registeredAt?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface Merchant {
  id: string;
  userId: string;
  name: string;
  address: string;
  villageId: string;
  villageName: string;
  openTime: string;
  closeTime: string;
  classificationPrice: PriceClassification;
  status: MerchantStatus;
  orderMode: OrderMode;
  ratingAvg: number;
  ratingCount: number;
  badge?: MerchantBadge;
  image?: string;
  phone?: string;
  isOpen: boolean;
  // Extended fields for admin
  registrationStatus?: string;
  registeredAt?: string;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  businessCategory?: string;
  businessDescription?: string;
  tradeGroup?: string;
  verifikatorCode?: string;
}

export interface Product {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantVillage?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  category: ProductCategory;
  isActive: boolean;
  isPromo?: boolean;
  // Availability fields
  isAvailable?: boolean;
  isMerchantOpen?: boolean;
  hasQuota?: boolean;
}

export interface Tourism {
  id: string;
  villageId: string;
  villageName: string;
  name: string;
  description: string;
  image: string;
  locationLat: number;
  locationLng: number;
  waLink: string;
  sosmedLink?: string;
  facilities: string[];
  isActive: boolean;
  viewCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  merchantId: string;
  buyerId: string;
  status: OrderStatus;
  handledBy: 'ADMIN' | 'MERCHANT';
  deliveryType: DeliveryType;
  shippingCost: number;
  subtotal: number;
  total: number;
  items: OrderItem[];
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

// Enums
export type PriceClassification = 
  | 'UNDER_5K' 
  | 'FROM_5K_TO_10K' 
  | 'FROM_10K_TO_20K' 
  | 'ABOVE_20K';

export type MerchantStatus = 'ACTIVE' | 'INACTIVE';

export type OrderMode = 'SELF' | 'ADMIN_ASSISTED';

export type MerchantBadge = 'VERIFIED' | 'POPULAR' | 'NEW';

export type ProductCategory = 'kuliner' | 'fashion' | 'kriya' | 'wisata';

export type OrderStatus = 'NEW' | 'PROCESSED' | 'SENT' | 'DONE' | 'CANCELED';

export type DeliveryType = 'PICKUP' | 'INTERNAL';

export type UserRole = 'ADMIN' | 'ADMIN_DESA' | 'MERCHANT' | 'BUYER' | 'VERIFIER' | 'COURIER';
