

# Analisis Bug dan Rencana Perbaikan

## Bug yang Ditemukan

### Bug 1: `forwardRef` Warning pada BottomNav dan ShopFilterSheet
**Severity: Low (Warning, tidak crash)**
**File:** `src/components/layout/BottomNav.tsx`

Console menunjukkan: *"Function components cannot be given refs"* pada `BottomNav` dan `ShopFilterSheet > DialogContent`. `BottomNav` adalah function component biasa yang dirender langsung oleh parent — kemungkinan ada parent yang mencoba memberikan ref kepadanya. Perlu wrap dengan `React.forwardRef`.

### Bug 2: `forwardRef` Warning pada SheetContent di ShopFilterSheet
**Severity: Low (Warning)**
**File:** `src/components/ui/sheet.tsx` (line 54)

`SheetContent` di dalam `DialogContent` menghasilkan ref warning. Kemungkinan komponen child yang di-pass ke Radix Dialog tidak di-wrap `forwardRef`.

### Bug 3: MerchantChatPage — Realtime Channel Terlalu Luas
**Severity: Medium**
**File:** `src/pages/merchant/MerchantChatPage.tsx` (line 48-51)

Channel realtime subscribe ke semua `INSERT` pada `chat_messages` tanpa filter `user_id` atau `order_id`. Ini berarti setiap pesan baru dari siapapun memicu `fetchThreads()` — tidak efisien dan bisa menyebabkan excessive API calls.

### Bug 4: CourierHistoryPage — Filter delivery_type Tidak Efektif
**Severity: Medium**
**File:** `src/pages/courier/CourierHistoryPage.tsx`

Query mengambil semua orders tanpa filter `delivery_type`. Tab "Delivery" vs "Ride" hanya memfilter di client-side, tapi kolom `delivery_type` pada orders mungkin berisi value seperti `PICKUP`, `DELIVERY`, `RIDE` — perlu verifikasi bahwa filtering logic cocok dengan actual data values.

### Bug 5: NotificationDropdown — `generateDynamicLink` Duplikasi dengan Versi Sebelumnya
**Severity: Low**
**File:** `src/components/notifications/NotificationDropdown.tsx`

Fungsi `generateDynamicLink` sudah ada sebelum fase 3 (terlihat di provided code), namun di fase 3 dikatakan "diperbarui". Perlu pastikan tidak ada duplikasi logic.

---

## Rencana Perbaikan

### Fix 1: Wrap BottomNav dengan forwardRef
**File:** `src/components/layout/BottomNav.tsx`
- Wrap export dengan `React.forwardRef` untuk menghilangkan console warning.

### Fix 2: Fix SheetContent ref forwarding
**File:** `src/components/ui/sheet.tsx`
- Periksa apakah `SheetContent` sudah menggunakan `forwardRef`. Jika ada child component tanpa `forwardRef`, wrap dengan benar.

### Fix 3: Tambah filter pada MerchantChat realtime channel
**File:** `src/pages/merchant/MerchantChatPage.tsx`
- Tambahkan filter `or` pada realtime subscription: `sender_id=eq.${user.id}` atau `receiver_id=eq.${user.id}` agar hanya pesan relevan yang memicu refresh.

### Fix 4: Verifikasi CourierHistoryPage delivery_type values
**File:** `src/pages/courier/CourierHistoryPage.tsx`
- Pastikan filter tab menggunakan value yang benar dari database (`DELIVERY`, `RIDE`, `PICKUP` dll).
- Tambah filter ke query Supabase jika memungkinkan untuk mengurangi data transfer.

### Technical Details

**BottomNav forwardRef pattern:**
```tsx
export const BottomNav = React.forwardRef<HTMLElement, {}>(
  function BottomNav(props, ref) {
    // existing logic
    return <nav ref={ref} ...>...</nav>;
  }
);
```

**MerchantChat realtime filter:**
```tsx
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'chat_messages',
  filter: `receiver_id=eq.${user.id}`
}, () => fetchThreads())
```

Total: 4 file perlu diperbaiki.

