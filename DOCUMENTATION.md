# 📖 Dokumentasi Lengkap Platform Desa Wisata & UMKM

## 📋 Daftar Isi

1. [Gambaran Umum](#gambaran-umum)
2. [Tech Stack](#tech-stack)
3. [Struktur Project](#struktur-project)
4. [Roles & Hak Akses](#roles--hak-akses)
5. [Fitur Berdasarkan Role](#fitur-berdasarkan-role)
6. [Alur Sistem](#alur-sistem)
7. [Database Schema](#database-schema)
8. [API & Edge Functions](#api--edge-functions)
9. [Komponen Utama](#komponen-utama)
10. [Konfigurasi](#konfigurasi)

---

## 🎯 Gambaran Umum

**Platform Desa Wisata & UMKM** adalah aplikasi web Progressive Web App (PWA) yang menghubungkan:
- **Desa Wisata** - Menampilkan destinasi wisata lokal
- **UMKM/Merchant** - Pedagang lokal yang menjual produk khas desa
- **Pembeli** - Konsumen yang dapat membeli produk dan menjelajahi wisata
- **Kurir** - Pengantar pesanan lokal

### Fitur Utama:
- 🛒 **E-Commerce** - Sistem jual-beli produk lokal
- 🏘️ **Desa Wisata** - Informasi dan promosi wisata desa
- 📦 **Manajemen Pesanan** - Tracking pesanan real-time
- 💳 **Pembayaran** - Integrasi Xendit (QRIS, VA, dll)
- 🚚 **Pengiriman** - Kurir internal dengan tracking lokasi
- 📱 **PWA** - Instalasi di perangkat mobile
- 🔔 **Push Notification** - Notifikasi real-time

---

## 🛠️ Tech Stack

### Frontend
| Teknologi | Kegunaan |
|-----------|----------|
| **React 18** | Framework UI |
| **TypeScript** | Type safety |
| **Vite** | Build tool |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | Komponen UI |
| **React Router v6** | Routing |
| **TanStack Query** | Data fetching & caching |
| **Framer Motion** | Animasi |
| **Recharts** | Charts & analytics |
| **Leaflet** | Peta interaktif |

### Backend (Lovable Cloud / Supabase)
| Teknologi | Kegunaan |
|-----------|----------|
| **PostgreSQL** | Database |
| **Row Level Security** | Keamanan data |
| **Edge Functions** | Serverless functions |
| **Realtime** | Subscriptions real-time |
| **Storage** | File storage |
| **Authentication** | Auth system |

### Integrasi
| Layanan | Kegunaan |
|---------|----------|
| **Xendit** | Payment gateway |
| **Wilayah API** | Data wilayah Indonesia |

---

## 📁 Struktur Project

```
src/
├── assets/              # Gambar & aset statis
├── components/          # Komponen React
│   ├── admin/           # Komponen untuk Admin
│   ├── auth/            # Komponen autentikasi
│   ├── checkout/        # Komponen checkout
│   ├── courier/         # Komponen kurir
│   ├── desa/            # Komponen admin desa
│   ├── explore/         # Komponen eksplorasi
│   ├── home/            # Komponen homepage
│   ├── layout/          # Layout (Header, BottomNav)
│   ├── merchant/        # Komponen merchant
│   ├── notifications/   # Notifikasi
│   ├── order/           # Komponen pesanan
│   ├── product/         # Komponen produk
│   ├── pwa/             # PWA components
│   ├── settings/        # Pengaturan
│   ├── ui/              # shadcn/ui components
│   ├── verifikator/     # Komponen verifikator
│   └── village/         # Komponen desa
├── contexts/            # React contexts
│   ├── AuthContext.tsx  # Auth state management
│   ├── CartContext.tsx  # Keranjang belanja
│   └── WhitelabelContext.tsx # Pengaturan whitelabel
├── data/                # Data statis
├── hooks/               # Custom hooks
├── integrations/        # Integrasi Supabase
├── lib/                 # Utility functions & API
├── pages/               # Halaman aplikasi
│   ├── admin/           # Halaman admin
│   ├── buyer/           # Halaman pembeli
│   ├── courier/         # Halaman kurir
│   ├── desa/            # Halaman admin desa
│   ├── merchant/        # Halaman merchant
│   └── verifikator/     # Halaman verifikator
└── types/               # TypeScript types
```

---

## 👥 Roles & Hak Akses

Platform ini menggunakan **Role-Based Access Control (RBAC)** dengan 6 role:

### 1. 👑 Admin Pusat (`admin`)
**Dashboard:** `/admin`
**Hak Akses Penuh:**
- Mengelola semua data platform
- Approval merchant, desa, kurir
- Manajemen pesanan & refund
- Keuangan & withdrawal
- Pengaturan sistem
- Broadcast notifikasi
- Whitelabel & branding

### 2. 🏘️ Admin Desa (`admin_desa`)
**Dashboard:** `/desa`
**Hak Akses:**
- Mengelola data desa sendiri
- Mengelola wisata desa
- Melihat statistik desa

### 3. ✅ Verifikator (`verifikator`)
**Dashboard:** `/verifikator`
**Hak Akses:**
- Verifikasi merchant dengan kode referral
- Melihat komisi dari merchant
- Request withdrawal komisi

### 4. 🏪 Merchant (`merchant`)
**Dashboard:** `/merchant`
**Hak Akses:**
- Mengelola produk (CRUD)
- Mengelola pesanan
- Flash sale & promo
- Voucher management
- Statistik & analytics
- Request withdrawal

### 5. 🚚 Kurir (`courier`)
**Dashboard:** `/courier`
**Hak Akses:**
- Melihat pesanan yang ditugaskan
- Update status pengiriman
- Upload bukti pengiriman (POD)
- Tracking lokasi real-time
- Melihat pendapatan

### 6. 🛒 Pembeli (`buyer`)
**Dashboard:** `/` (Homepage)
**Hak Akses:**
- Menjelajahi produk & wisata
- Menambah ke keranjang
- Checkout & pembayaran
- Tracking pesanan
- Review & rating
- Wishlist

### Prioritas Role (Login Redirect)
```
admin > admin_desa > verifikator > merchant > courier > buyer
```

---

## ⚙️ Fitur Berdasarkan Role

### 👑 Admin Pusat

| Halaman | Deskripsi |
|---------|-----------|
| `/admin` | Dashboard statistik |
| `/admin/merchants` | Kelola & approval merchant |
| `/admin/villages` | Kelola & approval desa |
| `/admin/couriers` | Kelola & approval kurir |
| `/admin/orders` | Semua pesanan platform |
| `/admin/products` | Semua produk |
| `/admin/users` | Manajemen user |
| `/admin/roles` | Manajemen role |
| `/admin/finance` | Keuangan platform |
| `/admin/withdrawals` | Approval withdrawal merchant |
| `/admin/verifikator-withdrawals` | Approval withdrawal verifikator |
| `/admin/verifikator-commissions` | Komisi verifikator |
| `/admin/refunds` | Request refund |
| `/admin/promotions` | Banner & promosi |
| `/admin/banners` | Kelola banner |
| `/admin/categories` | Kelola kategori |
| `/admin/packages` | Paket langganan merchant |
| `/admin/codes` | Kode verifikator |
| `/admin/broadcast` | Broadcast notifikasi |
| `/admin/reports` | Laporan & export |
| `/admin/logs` | Audit logs |
| `/admin/settings` | Pengaturan umum |
| `/admin/homepage-layout` | Pengaturan tampilan homepage |
| `/admin/whitelabel` | Branding & whitelabel |
| `/admin/seo` | SEO settings |
| `/admin/pwa-settings` | PWA settings |
| `/admin/backup` | Manual backup |
| `/admin/scheduled-backup` | Scheduled backup |

### 🏘️ Admin Desa

| Halaman | Deskripsi |
|---------|-----------|
| `/desa` | Dashboard desa |
| `/desa/tourism` | Kelola wisata desa |

### ✅ Verifikator

| Halaman | Deskripsi |
|---------|-----------|
| `/verifikator` | Dashboard |
| `/verifikator/merchants` | Merchant terverifikasi |
| `/verifikator/earnings` | Pendapatan & withdrawal |

### 🏪 Merchant

| Halaman | Deskripsi |
|---------|-----------|
| `/merchant` | Dashboard & statistik |
| `/merchant/products` | Kelola produk |
| `/merchant/orders` | Pesanan masuk |
| `/merchant/analytics` | Analytics detail |
| `/merchant/reviews` | Review pelanggan |
| `/merchant/flash-sale` | Flash sale |
| `/merchant/promo` | Promo produk |
| `/merchant/scheduled-promo` | Promo terjadwal |
| `/merchant/vouchers` | Kelola voucher |
| `/merchant/subscription` | Paket langganan |
| `/merchant/withdrawal` | Request withdrawal |
| `/merchant/visitor-stats` | Statistik pengunjung |
| `/merchant/settings` | Pengaturan toko |

### 🚚 Kurir

| Halaman | Deskripsi |
|---------|-----------|
| `/courier` | Dashboard & pesanan aktif |
| `/courier/history` | Riwayat pengiriman |
| `/courier/earnings` | Pendapatan |

### 🛒 Pembeli (Public)

| Halaman | Deskripsi |
|---------|-----------|
| `/` | Homepage |
| `/explore` | Eksplorasi |
| `/products` | Daftar produk |
| `/product/:id` | Detail produk |
| `/shops` | Daftar toko |
| `/shop/:id` | Profil toko |
| `/tourism` | Daftar wisata |
| `/tourism/:id` | Detail wisata |
| `/search` | Hasil pencarian |
| `/cart` | Keranjang |
| `/checkout` | Checkout |
| `/orders` | Riwayat pesanan |
| `/orders/:id` | Tracking pesanan |
| `/account` | Profil akun |
| `/settings` | Pengaturan |
| `/wishlist` | Wishlist |
| `/reviews` | Review saya |
| `/saved-addresses` | Alamat tersimpan |
| `/notifications` | Notifikasi |

---

## 🔄 Alur Sistem

### Alur Registrasi Merchant

```
┌─────────────────┐
│ Merchant Daftar │
│ /register/      │
│ merchant        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Status: PENDING │
│ (Menunggu       │
│  approval)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Admin Review    │
│ /admin/merchants│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│APPROVE│ │ REJECT   │
└───┬───┘ └────┬─────┘
    │          │
    ▼          ▼
┌───────────┐ ┌────────────┐
│ ACTIVE    │ │ Ditolak    │
│ + Beli    │ │ (dengan    │
│ Paket     │ │ alasan)    │
└───────────┘ └────────────┘
```

### Alur Pemesanan

```
┌──────────────┐
│ Pembeli      │
│ tambah ke    │
│ keranjang    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Checkout     │
│ - Alamat     │
│ - Metode     │
│   pembayaran │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Pembayaran   │
│ via Xendit   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Order Status │
│ = NEW        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Merchant     │
│ proses       │
│ pesanan      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Status =     │
│ PROCESSED    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Admin assign │
│ kurir        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Kurir        │
│ mengantarkan │
│ Status=SENT  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Bukti        │
│ pengiriman   │
│ (POD)        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Status =     │
│ DONE         │
└──────────────┘
```

### Alur Pembayaran

```
┌──────────────┐
│ Checkout     │
│ Pilih metode │
│ pembayaran   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│         Metode Pembayaran        │
├────────────────┬─────────────────┤
│ ONLINE         │ COD             │
│ (QRIS, VA)     │ (Cash on Deliv) │
└───────┬────────┴────────┬────────┘
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Xendit       │  │ Konfirmasi   │
│ Payment      │  │ dari pembeli │
│ Gateway      │  │ (deadline)   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Webhook      │  │ Bayar saat   │
│ konfirmasi   │  │ terima       │
└──────┬───────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│ Order        │
│ diproses     │
└──────────────┘
```

---

## 🗄️ Database Schema

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `profiles` | Data profil user |
| `user_roles` | Role-role user |
| `villages` | Data desa |
| `merchants` | Data merchant/toko |
| `products` | Produk |
| `product_images` | Gambar produk |
| `product_variants` | Varian produk |
| `categories` | Kategori produk |
| `orders` | Pesanan |
| `order_items` | Item dalam pesanan |
| `couriers` | Data kurir |
| `courier_earnings` | Pendapatan kurir |
| `tourism` | Destinasi wisata |
| `reviews` | Review produk |
| `notifications` | Notifikasi |
| `promotions` | Banner promosi |
| `flash_sales` | Flash sale |
| `vouchers` | Voucher diskon |
| `merchant_subscriptions` | Langganan merchant |
| `transaction_packages` | Paket transaksi |
| `withdrawal_requests` | Request withdrawal merchant |
| `verifikator_withdrawals` | Withdrawal verifikator |
| `refund_requests` | Request refund |
| `platform_fees` | Fee platform |
| `insurance_fund` | Dana asuransi |
| `app_settings` | Pengaturan aplikasi |
| `admin_audit_logs` | Log aktivitas admin |
| `backup_logs` | Log backup |
| `backup_schedules` | Jadwal backup |
| `broadcast_notifications` | Broadcast message |
| `push_subscriptions` | Push notification subs |
| `rate_limits` | Rate limiting |
| `password_reset_tokens` | Token reset password |
| `trade_groups` | Kelompok dagang |
| `group_members` | Anggota kelompok |
| `kas_payments` | Pembayaran kas |
| `saved_addresses` | Alamat tersimpan |
| `wishlists` | Wishlist user |

### Relasi Penting

```
users (auth.users)
    │
    ├─── profiles (1:1)
    │
    ├─── user_roles (1:n)
    │
    ├─── merchants (1:1)
    │       │
    │       ├─── products (1:n)
    │       │       │
    │       │       ├─── product_images (1:n)
    │       │       ├─── product_variants (1:n)
    │       │       └─── flash_sales (1:n)
    │       │
    │       ├─── orders (1:n)
    │       │       └─── order_items (1:n)
    │       │
    │       ├─── merchant_subscriptions (1:n)
    │       └─── reviews (1:n)
    │
    ├─── couriers (1:1)
    │       └─── courier_earnings (1:n)
    │
    └─── orders (as buyer) (1:n)

villages
    │
    ├─── merchants (1:n)
    │
    ├─── tourism (1:n)
    │
    └─── couriers (1:n)
```

---

## 🔌 API & Edge Functions

### Edge Functions

| Function | Deskripsi |
|----------|-----------|
| `assign-courier` | Auto-assign kurir ke order |
| `send-push-notification` | Kirim push notification |
| `wilayah-proxy` | Proxy API wilayah Indonesia |
| `xendit-payment` | Buat invoice Xendit |
| `xendit-webhook` | Handle webhook Xendit |

### API Modules (`src/lib/`)

| Module | Deskripsi |
|--------|-----------|
| `api.ts` | API utama (products, villages, tourism) |
| `adminApi.ts` | API admin |
| `addressApi.ts` | API alamat & wilayah |
| `courierApi.ts` | API kurir |
| `paymentApi.ts` | API pembayaran |
| `searchApi.ts` | API pencarian |
| `promotions.ts` | API promosi |
| `storage.ts` | Upload file storage |
| `auditLog.ts` | Logging aktivitas |
| `codSecurity.ts` | Keamanan COD |
| `etaCalculation.ts` | Estimasi pengiriman |
| `merchantOperatingHours.ts` | Jam operasi toko |
| `phoneValidation.ts` | Validasi nomor HP |
| `pushNotification.ts` | Push notifications |
| `rateLimit.ts` | Rate limiting |
| `validationSchemas.ts` | Schema validasi (Zod) |

---

## 🧩 Komponen Utama

### Layout Components

| Komponen | Deskripsi |
|----------|-----------|
| `Header` | Header dengan logo & notifikasi |
| `BottomNav` | Navigasi bawah mobile |
| `FloatingCartButton` | Tombol keranjang melayang |
| `AdminLayout` | Layout dashboard admin |
| `MerchantLayout` | Layout dashboard merchant |
| `CourierLayout` | Layout dashboard kurir |
| `DesaLayout` | Layout dashboard admin desa |
| `VerifikatorLayout` | Layout dashboard verifikator |

### Home Components

| Komponen | Deskripsi |
|----------|-----------|
| `HeroCarousel` | Carousel banner utama |
| `TourismCarousel` | Carousel wisata populer |
| `CategoryIcon` | Icon kategori |
| `ProductCard` | Card produk |
| `VillageCard` | Card desa |
| `TourismCard` | Card wisata |

### Auth Components

| Komponen | Deskripsi |
|----------|-----------|
| `ProtectedRoute` | Route yang butuh auth |
| `RoleBasedRedirect` | Redirect berdasar role |

### Checkout Components

| Komponen | Deskripsi |
|----------|-----------|
| `CheckoutAddressForm` | Form alamat |
| `LocationPicker` | Pilih lokasi peta |
| `VoucherInput` | Input kode voucher |
| `QuotaBlockedAlert` | Alert quota habis |

---

## ⚙️ Konfigurasi

### Environment Variables

```env
VITE_SUPABASE_URL=<supabase_url>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_SUPABASE_PROJECT_ID=<project_id>
```

### App Settings (Database)

| Key | Deskripsi |
|-----|-----------|
| `registration` | Aktif/non-aktif registrasi |
| `address_api` | Konfigurasi API wilayah |
| `xendit_payment` | Konfigurasi Xendit |
| `shipping_fee` | Pengaturan ongkir |
| `platform_fee` | Fee platform |
| `shipping_zones` | Zona pengiriman |
| `cod_settings` | Pengaturan COD |
| `whitelabel` | Branding & nama situs |
| `homepage_layout` | Urutan & visibility section homepage |

### PWA Configuration

PWA dikonfigurasi melalui:
- `vite.config.ts` - VitePWA plugin
- `public/sw.js` - Service worker
- `public/pwa-*.png` - Icon PWA

---

## 🔐 Keamanan

### Row Level Security (RLS)

Semua tabel menggunakan RLS untuk memastikan:
- User hanya bisa akses data miliknya
- Admin punya akses penuh
- Role-specific access control

### Security Functions

```sql
-- Cek apakah user punya role tertentu
public.has_role(user_id, role)

-- Digunakan di RLS policies
```

### Best Practices

1. ✅ Role disimpan di tabel terpisah (`user_roles`)
2. ✅ Tidak ada hardcoded credentials
3. ✅ Server-side validation dengan RLS
4. ✅ API keys disimpan di secrets
5. ✅ Rate limiting untuk prevent abuse
6. ✅ Audit logging untuk tracking

---

## 📱 PWA Features

- **Installable** - Bisa diinstall di device
- **Offline Support** - Service worker caching
- **Push Notifications** - Notifikasi real-time
- **Update Prompt** - Prompt update saat ada versi baru
- **Install Banner** - Banner install di homepage

---

## 🚀 Deployment

Platform ini di-deploy melalui **Lovable Cloud** dengan:
- **Preview URL:** Untuk testing
- **Published URL:** Untuk production

### Update Deployment

- **Frontend:** Klik "Update" di publish dialog
- **Backend:** Edge functions deploy otomatis

---

## 📞 Support

Untuk bantuan lebih lanjut:
- Lihat dokumentasi Lovable: https://docs.lovable.dev
- Buka issue di GitHub repository

---

**© 2024 Platform Desa Wisata & UMKM**
