# Bug Analysis and Fixes - Pesanan Saya (Orders Page)

## Bug #1: Foto dan Nama Produk Tidak Muncul

### Root Cause Analysis

**Location**: `src/pages/OrdersPage.tsx` (lines 499-501)

```typescript
const firstItem = order.order_items?.[0];
const imageUrl = firstItem?.products?.image_url;
const productName = firstItem?.product_name || firstItem?.products?.name || "Produk";
```

**Problem**:
1. The code relies on `firstItem?.products?.image_url` and `firstItem?.products?.name`, which are nested relations from Supabase
2. The query has multiple fallback levels (L1-L4) in `fetchOrders()` function (lines 126-179)
3. When L1 query fails (with full relations), the fallback queries (L2, L3, L4) don't include the `products` relation
4. Even though there's a secondary fetch for missing product data (lines 183-214), it only fetches when `product_id` exists AND `products` is null
5. The `product_id` field is NOT included in the L2-L4 queries, so the secondary fetch never triggers

**Why it happens**:
- The `order_items` table has `product_id` and `product_name` columns
- When the full L1 query fails, the fallback queries only select `product_name` and `product_price`
- Without `product_id`, the code cannot fetch product details later
- Result: `imageUrl` is undefined and `productName` falls back to "Produk"

### Fix Strategy

**Solution**: Ensure `product_id` is always selected in all query levels, so the secondary fetch mechanism can work properly.

**Changes needed**:
1. Add `product_id` to L2, L3, and L4 query selections
2. Ensure the secondary fetch logic properly handles all cases
3. Add fallback image URL when no image is available

---

## Bug #2: Tombol "Pesan Lagi" Tidak Berfungsi

### Root Cause Analysis

**Location**: `src/pages/OrdersPage.tsx` (lines 291-343)

```typescript
const handleReorder = useCallback(async (order: BuyerOrder) => {
  // ... code ...
  for (const item of order.order_items) {
    const productId = (item as any).product_id;
    if (!productId || stockMap[productId] === undefined) {
      skippedCount++;
      continue;
    }
    // ... add to cart ...
    addToCart({
      id: productId,
      name: item.product_name,
      price: item.product_price,
      image: item.products?.image_url || '/placeholder.svg',
      stock: actualStock,
      merchantId: order.merchant_id || '',
      merchantName: order.merchants?.name || '',
      category: '',
      description: '',
    } as any, Math.min(item.quantity, actualStock));
  }
}, [navigate, addToCart]);
```

**Problems**:
1. The object passed to `addToCart()` is incomplete - it's missing the `isAvailable` property
2. In `CartContext.tsx` (line 46), there's a guard check: `if (product.isAvailable === false)`
3. Since `isAvailable` is undefined (not false), this check doesn't prevent adding, BUT
4. The Product type expects many properties that are being set to empty strings (`category: ''`, `description: ''`)
5. The `isAvailable` property should be calculated based on stock and merchant status
6. Without proper product data, the cart item may not render correctly

**Why it happens**:
- The `handleReorder` function constructs a minimal Product object
- It doesn't include all required properties from the Product type
- The `isAvailable` property is never set, so it defaults to `undefined`
- This causes type safety issues and potential rendering problems in the cart

### Fix Strategy

**Solution**: 
1. Fetch complete product data from the database before adding to cart
2. Ensure all required Product properties are populated
3. Set `isAvailable` to true only if stock > 0 and merchant is active
4. Add proper error handling and user feedback

**Changes needed**:
1. Fetch full product details including all metadata
2. Properly construct Product objects with all required fields
3. Add validation before adding to cart
4. Improve error messages for unavailable products

---

## Implementation Plan

### Fix #1: OrdersPage.tsx - Ensure product_id is always selected

**Change in fetchOrders() function**:
- L2 query: Add `product_id` to selection
- L3 query: Add `product_id` to selection  
- L4 query: Add `product_id` to selection

### Fix #2: OrdersPage.tsx - Improve handleReorder function

**Changes**:
- Fetch complete product data from database
- Include all required Product properties
- Set proper `isAvailable` status
- Add better error handling

---

## Testing Checklist

- [ ] Verify product images appear in order list
- [ ] Verify product names appear correctly (not showing "Produk")
- [ ] Click "Pesan Lagi" button on a completed order
- [ ] Verify products are added to cart successfully
- [ ] Verify cart displays correct product information
- [ ] Test with multiple products in a single order
- [ ] Test with products that are no longer available
- [ ] Test with products from closed merchants
