# Chat Role Detection Fix

## Masalah
Fitur chat masih menggunakan logika statis dalam menentukan peran pengguna (Penjual/Pembeli/Kurir). Posisi bubble chat dan label peran tidak menyesuaikan dengan kondisi pengguna yang sedang login.

### Contoh Masalah:
- Ketika penjual (merchant) membuka chat dengan pembeli, posisi bubble dan label masih menganggap penjual sebagai pembeli
- Logika `getRoleLabel()` hanya memeriksa `senderId === orderInfo.buyerId` tanpa mempertimbangkan peran pengguna yang aktif
- Tidak ada mekanisme untuk mendeteksi peran pengguna berdasarkan konteks order

## Solusi
Memperbaiki fungsi `getRoleLabel()` di `src/components/chat/OrderChat.tsx` untuk mendeteksi peran pengguna secara dinamis berdasarkan:

1. **Chat Type**: Jenis chat yang sedang berlangsung (`buyer_merchant`, `buyer_courier`, `merchant_courier`)
2. **Order Info**: Data order yang berisi `buyerId` dan `merchantId`
3. **Sender ID**: ID pengirim pesan untuk menentukan peran mereka

## Perubahan File

### `src/components/chat/OrderChat.tsx`

#### Sebelum:
```typescript
const getRoleLabel = (senderId: string): string => {
  if (!orderInfo) return '';
  
  // Logic for buyer_merchant chat
  if (chatType === 'buyer_merchant') {
    if (senderId === orderInfo.buyerId) return 'Pembeli';
    return 'Penjual';
  }
  
  // Logic for courier chats (simplified fallback)
  const labels = ROLE_LABELS[chatType];
  if (!labels) return '';
  if (senderId === user?.id) return labels.self;
  return labels.other;
};
```

#### Sesudah:
```typescript
const getRoleLabel = (senderId: string): string => {
  if (!orderInfo || !user) return '';
  
  // Determine current user's role based on chat type and order info
  let currentUserRole: 'buyer' | 'merchant' | 'courier' | null = null;
  
  if (chatType === 'buyer_merchant') {
    // In buyer_merchant chat, determine if current user is buyer or merchant
    if (user.id === orderInfo.buyerId) {
      currentUserRole = 'buyer';
    } else if (user.id === orderInfo.merchantId) {
      currentUserRole = 'merchant';
    }
  } else if (chatType === 'buyer_courier') {
    // In buyer_courier chat, determine if current user is buyer or courier
    if (user.id === orderInfo.buyerId) {
      currentUserRole = 'buyer';
    } else {
      currentUserRole = 'courier';
    }
  } else if (chatType === 'merchant_courier') {
    // In merchant_courier chat, determine if current user is merchant or courier
    if (user.id === orderInfo.merchantId) {
      currentUserRole = 'merchant';
    } else {
      currentUserRole = 'courier';
    }
  }
  
  // Determine sender's role
  let senderRole: 'buyer' | 'merchant' | 'courier' | null = null;
  
  if (chatType === 'buyer_merchant') {
    if (senderId === orderInfo.buyerId) {
      senderRole = 'buyer';
    } else if (senderId === orderInfo.merchantId) {
      senderRole = 'merchant';
    }
  } else if (chatType === 'buyer_courier') {
    if (senderId === orderInfo.buyerId) {
      senderRole = 'buyer';
    } else {
      senderRole = 'courier';
    }
  } else if (chatType === 'merchant_courier') {
    if (senderId === orderInfo.merchantId) {
      senderRole = 'merchant';
    } else {
      senderRole = 'courier';
    }
  }
  
  // Return appropriate label
  if (senderRole === 'buyer') return 'Pembeli';
  if (senderRole === 'merchant') return 'Penjual';
  if (senderRole === 'courier') return 'Kurir';
  return '';
};
```

## Keuntungan Perbaikan

1. **Deteksi Otomatis Peran**: Sistem sekarang otomatis mendeteksi peran pengguna yang sedang login berdasarkan data order
2. **Label Akurat**: Setiap pesan menampilkan label peran yang benar sesuai dengan pengirim
3. **Konsistensi Across Pages**: Logika yang sama diterapkan di semua halaman chat (Buyer, Merchant, Courier)
4. **Fleksibilitas**: Mudah untuk menambah tipe chat baru dengan logika yang sama

## Testing

Untuk memverifikasi perbaikan ini bekerja dengan baik:

1. **Sebagai Pembeli**: Buka chat dengan penjual, verifikasi bahwa pesan Anda berlabel "Pembeli" dan pesan penjual berlabel "Penjual"
2. **Sebagai Penjual**: Buka chat dengan pembeli, verifikasi bahwa pesan Anda berlabel "Penjual" dan pesan pembeli berlabel "Pembeli"
3. **Sebagai Kurir**: Buka chat dengan pembeli/penjual, verifikasi bahwa label peran sesuai dengan tipe chat

## Catatan Teknis

- `orderInfo.buyerId` dan `orderInfo.merchantId` sudah di-fetch dari database di awal komponen
- Fungsi `getRoleLabel()` dipanggil untuk setiap pesan untuk menentukan label peran yang sesuai
- Logika ini bekerja untuk semua tipe chat: `buyer_merchant`, `buyer_courier`, dan `merchant_courier`
