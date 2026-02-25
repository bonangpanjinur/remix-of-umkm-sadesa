# Chat Role Detection & Label Improvements

## Ringkasan Masalah
Fitur chat di aplikasi masih memiliki beberapa masalah terkait penentuan peran pengguna (Penjual/Pembeli/Kurir):

1. **Logika Peran Statis**: Fungsi `getRoleLabel()` hanya memeriksa apakah pengirim adalah pembeli, tanpa mempertimbangkan peran pengguna yang sedang login
2. **Label Tab Tidak Sesuai Konteks**: Di halaman chat penjual, tab seharusnya menampilkan "Pembeli" sebagai lawan bicara, bukan "Penjual"
3. **Posisi Bubble Chat Tidak Konsisten**: Bubble chat tidak selalu menampilkan posisi yang benar berdasarkan siapa yang mengirim pesan

## Solusi yang Diterapkan

### 1. Perbaikan `getRoleLabel()` di `OrderChat.tsx`

**File**: `src/components/chat/OrderChat.tsx`

Mengubah logika dari statis menjadi dinamis dengan mempertimbangkan:
- **Chat Type**: Jenis chat (`buyer_merchant`, `buyer_courier`, `merchant_courier`)
- **Order Info**: Data order yang berisi `buyerId` dan `merchantId`
- **Sender ID**: ID pengirim pesan

**Logika Baru:**
```typescript
const getRoleLabel = (senderId: string): string => {
  if (!orderInfo || !user) return '';
  
  // Determine sender's role based on chat type and order info
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

**Keuntungan:**
- Setiap pesan menampilkan label peran yang akurat sesuai dengan pengirim
- Bekerja untuk semua tipe chat
- Mudah diperluas untuk tipe chat baru

### 2. Verifikasi Label Tab di `MerchantChatPage.tsx`

**File**: `src/pages/merchant/MerchantChatPage.tsx` (baris 169-174)

Label tab sudah benar:
```tsx
<TabsTrigger value="buyer_merchant" className="...">
  <User className="h-3 w-3 mr-1" /> Pembeli
</TabsTrigger>
<TabsTrigger value="merchant_courier" className="...">
  <Truck className="h-3 w-3 mr-1" /> Kurir
</TabsTrigger>
```

Ini menampilkan "Pembeli" dan "Kurir" yang merupakan lawan bicara penjual, sesuai dengan perspektif penjual.

### 3. Posisi Bubble Chat di `OrderChat.tsx`

**File**: `src/components/chat/OrderChat.tsx` (baris 376)

Logika posisi bubble sudah benar:
```typescript
const isMine = msg.sender_id === user?.id;
// ... kemudian digunakan untuk menentukan posisi
<div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
```

Ini memastikan:
- Pesan dari pengguna yang login muncul di sebelah kanan (hijau)
- Pesan dari lawan bicara muncul di sebelah kiri (putih)

## Perubahan File

| File | Perubahan | Status |
|------|-----------|--------|
| `src/components/chat/OrderChat.tsx` | Perbaikan fungsi `getRoleLabel()` | ✅ Selesai |
| `src/pages/merchant/MerchantChatPage.tsx` | Verifikasi label tab | ✅ Benar |
| `src/pages/buyer/BuyerChatPage.tsx` | Tidak perlu perubahan | ✅ Benar |
| `src/pages/courier/CourierChatPage.tsx` | Tidak perlu perubahan | ✅ Benar |

## Testing Checklist

### Sebagai Pembeli
- [ ] Buka chat dengan penjual
- [ ] Verifikasi pesan Anda berlabel "Pembeli" (bubble hijau, kanan)
- [ ] Verifikasi pesan penjual berlabel "Penjual" (bubble putih, kiri)
- [ ] Verifikasi tab menampilkan "Penjual"

### Sebagai Penjual
- [ ] Buka chat dengan pembeli
- [ ] Verifikasi pesan Anda berlabel "Penjual" (bubble hijau, kanan)
- [ ] Verifikasi pesan pembeli berlabel "Pembeli" (bubble putih, kiri)
- [ ] Verifikasi tab menampilkan "Pembeli"

### Sebagai Kurir
- [ ] Buka chat dengan pembeli
- [ ] Verifikasi label peran sesuai dengan tipe chat
- [ ] Buka chat dengan penjual
- [ ] Verifikasi label peran sesuai dengan tipe chat

## Catatan Teknis

1. **Data Order**: `orderInfo.buyerId` dan `orderInfo.merchantId` di-fetch dari database saat komponen dibuka
2. **Real-time Updates**: Menggunakan Supabase real-time subscription untuk update pesan
3. **Kompatibilitas**: Bekerja untuk semua tipe chat yang ada saat ini

## Commit History

```
4e7269f - fix: dynamic role detection in OrderChat component
fb68a8b - fix: dynamic role detection in chat based on order data (buyer vs merchant)
```

## Kesimpulan

Perbaikan ini memastikan bahwa:
1. ✅ Peran pengguna dideteksi secara otomatis berdasarkan data order
2. ✅ Label pesan menampilkan peran yang akurat untuk setiap pengirim
3. ✅ Posisi bubble chat konsisten dengan siapa yang mengirim pesan
4. ✅ Label tab menampilkan lawan bicara dari perspektif pengguna yang login
