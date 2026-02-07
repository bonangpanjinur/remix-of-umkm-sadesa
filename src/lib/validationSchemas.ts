// Centralized Zod validation schemas for consistent form validation
import { z } from 'zod';

// Common patterns
const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
const indonesianPhoneMessage = 'Nomor telepon tidak valid (contoh: 081234567890)';

// Shared field schemas
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi')
  .email('Format email tidak valid')
  .max(255, 'Email maksimal 255 karakter');

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(100, 'Password maksimal 100 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
  .regex(/[0-9]/, 'Password harus mengandung angka');

export const simplePasswordSchema = z
  .string()
  .min(6, 'Password minimal 6 karakter')
  .max(100, 'Password maksimal 100 karakter');

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Nomor telepon wajib diisi')
  .regex(phoneRegex, indonesianPhoneMessage);

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Nama minimal 2 karakter')
  .max(100, 'Nama maksimal 100 karakter');

export const addressSchema = z
  .string()
  .trim()
  .min(10, 'Alamat minimal 10 karakter')
  .max(500, 'Alamat maksimal 500 karakter');

// Auth Schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
});

export const registerSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword'],
});

// Profile Schemas
export const profileSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  address: addressSchema.optional().or(z.literal('')),
});

// Product Schemas
export const productSchema = z.object({
  name: z.string().trim().min(3, 'Nama produk minimal 3 karakter').max(200, 'Nama maksimal 200 karakter'),
  description: z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter').optional(),
  price: z.number().min(100, 'Harga minimal Rp 100').max(100000000, 'Harga maksimal Rp 100.000.000'),
  stock: z.number().min(0, 'Stok tidak boleh negatif').max(99999, 'Stok maksimal 99999'),
  category: z.string().min(1, 'Kategori harus dipilih'),
  isActive: z.boolean().default(true),
  isPromo: z.boolean().default(false),
});

// Flash Sale Schema
export const flashSaleSchema = z.object({
  productId: z.string().uuid('Produk wajib dipilih'),
  flashPrice: z.number().min(100, 'Harga minimal Rp 100'),
  stockAvailable: z.number().min(1, 'Stok minimal 1'),
  durationHours: z.number().min(1).max(24),
  reason: z.string().max(200).optional(),
});

// Order Schemas
export const checkoutSchema = z.object({
  recipientName: nameSchema,
  phone: phoneSchema,
  address: addressSchema,
  deliveryType: z.enum(['PICKUP', 'INTERNAL']),
  paymentMethod: z.enum(['COD', 'ONLINE']),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

// Address Schema
export const savedAddressSchema = z.object({
  label: z.string().trim().min(1, 'Label wajib diisi').max(50, 'Label maksimal 50 karakter'),
  recipientName: nameSchema,
  phone: phoneSchema,
  provinceId: z.string().min(1, 'Provinsi wajib dipilih'),
  cityId: z.string().min(1, 'Kota wajib dipilih'),
  districtId: z.string().min(1, 'Kecamatan wajib dipilih'),
  villageId: z.string().optional(),
  addressDetail: addressSchema,
  isDefault: z.boolean().default(false),
});

// Review Schema
export const reviewSchema = z.object({
  rating: z.number().min(1, 'Rating wajib dipilih').max(5),
  comment: z.string().trim().max(1000, 'Komentar maksimal 1000 karakter').optional(),
});

// Voucher Schema
export const voucherSchema = z.object({
  code: z.string().trim().min(3, 'Kode minimal 3 karakter').max(20, 'Kode maksimal 20 karakter').regex(/^[A-Z0-9]+$/, 'Kode hanya boleh huruf kapital dan angka'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().min(1, 'Nilai diskon minimal 1'),
  minOrder: z.number().min(0).optional(),
  maxUsage: z.number().min(1).optional(),
  startDate: z.date(),
  endDate: z.date(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'Tanggal berakhir harus setelah tanggal mulai',
  path: ['endDate'],
});

// Merchant Registration Schema
export const merchantRegistrationSchema = z.object({
  storeName: z.string().trim().min(3, 'Nama toko minimal 3 karakter').max(100, 'Nama toko maksimal 100 karakter'),
  ownerName: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  businessCategory: z.string().min(1, 'Kategori bisnis wajib dipilih'),
  businessDescription: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter').optional(),
  provinceId: z.string().min(1, 'Provinsi wajib dipilih'),
  cityId: z.string().min(1, 'Kota wajib dipilih'),
  districtId: z.string().min(1, 'Kecamatan wajib dipilih'),
  subdistrictId: z.string().min(1, 'Kelurahan wajib dipilih'),
  address: addressSchema,
  verifikatorCode: z.string().optional(),
});

// Courier Registration Schema
export const courierRegistrationSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional(),
  ktpNumber: z.string().regex(/^\d{16}$/, 'NIK harus 16 digit'),
  provinceId: z.string().min(1, 'Provinsi wajib dipilih'),
  cityId: z.string().min(1, 'Kota wajib dipilih'),
  districtId: z.string().min(1, 'Kecamatan wajib dipilih'),
  subdistrictId: z.string().min(1, 'Kelurahan wajib dipilih'),
  address: addressSchema,
  vehicleType: z.enum(['motor', 'mobil', 'sepeda']),
  vehiclePlate: z.string().optional(),
});

// Village Registration Schema
export const villageRegistrationSchema = z.object({
  villageName: z.string().trim().min(3, 'Nama desa minimal 3 karakter').max(100, 'Nama desa maksimal 100 karakter'),
  contactName: nameSchema,
  contactPhone: phoneSchema,
  contactEmail: emailSchema,
  provinceId: z.string().min(1, 'Provinsi wajib dipilih'),
  cityId: z.string().min(1, 'Kabupaten wajib dipilih'),
  districtId: z.string().min(1, 'Kecamatan wajib dipilih'),
  description: z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter').optional(),
});

// Withdrawal Schema
export const withdrawalSchema = z.object({
  amount: z.number().min(10000, 'Minimal penarikan Rp 10.000'),
  bankName: z.string().min(1, 'Bank wajib dipilih'),
  accountNumber: z.string().regex(/^\d{10,20}$/, 'Nomor rekening 10-20 digit'),
  accountName: nameSchema,
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type FlashSaleFormData = z.infer<typeof flashSaleSchema>;
export type CheckoutFormData = z.infer<typeof checkoutSchema>;
export type SavedAddressFormData = z.infer<typeof savedAddressSchema>;
export type ReviewFormData = z.infer<typeof reviewSchema>;
export type VoucherFormData = z.infer<typeof voucherSchema>;
export type MerchantRegistrationFormData = z.infer<typeof merchantRegistrationSchema>;
export type CourierRegistrationFormData = z.infer<typeof courierRegistrationSchema>;
export type VillageRegistrationFormData = z.infer<typeof villageRegistrationSchema>;
export type WithdrawalFormData = z.infer<typeof withdrawalSchema>;
