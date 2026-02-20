

# Perbaikan Bug 2 Modal di Detail Pesanan Merchant

## Masalah
Saat merchant membuka Detail Pesanan (status PROCESSED) dan klik tombol "Kirim Pesanan", muncul **2 modal bertumpuk**:
1. Modal "Detail Pesanan" tetap terbuka
2. Modal "Pilih Metode Pengiriman" muncul di atasnya

Ini terjadi karena `openDeliveryChoiceDialog()` (baris 710) hanya membuka dialog baru tanpa menutup dialog detail yang sedang aktif.

## Solusi: Gabungkan Pilihan Pengiriman ke Dalam Dialog Detail

Daripada menutup dialog detail lalu membuka dialog baru (pengalaman terputus), lebih baik **menampilkan pilihan metode pengiriman langsung di dalam dialog detail pesanan** -- menggantikan tombol "Kirim Pesanan" dengan inline radio/button group.

### Perubahan di `src/pages/merchant/MerchantOrdersPage.tsx`

**Bagian Actions untuk status PROCESSED (baris 698-717):**

Sebelum:
```
{selectedOrder.status === 'PROCESSED' && delivery_type !== 'PICKUP' && (
  <Button onClick={() => openDeliveryChoiceDialog(selectedOrder.id)}>
    Kirim Pesanan
  </Button>
)}
```

Sesudah:
```
{selectedOrder.status === 'PROCESSED' && delivery_type !== 'PICKUP' && (
  <div className="space-y-3">
    <p className="text-sm font-semibold">Pilih Metode Pengiriman:</p>
    <Button variant="outline" onClick={() => handleSelfDelivery(selectedOrder.id)}>
      Antar Sendiri
    </Button>
    <Button variant="outline" onClick={async () => {
      // update status ASSIGNED + close dialog
      ...
    }}>
      Kurir Desa
    </Button>
  </div>
)}
```

**Hapus dialog terpisah "Delivery Choice Dialog" (baris 740-801):**
- Dialog terpisah tidak lagi diperlukan karena sudah inline
- State `deliveryChoiceDialogOpen` dan `deliveryChoiceOrderId` juga dihapus

### Detail Teknis

1. **Hapus state**: `deliveryChoiceDialogOpen`, `deliveryChoiceOrderId`, dan fungsi `openDeliveryChoiceDialog`
2. **Inline pilihan pengiriman** di dalam blok `selectedOrder.status === 'PROCESSED'` pada dialog detail
3. **Tutup detail dialog** setelah aksi berhasil (sudah dilakukan oleh `handleSelfDelivery` dan handler kurir desa)
4. **Pertahankan UX** yang sama: 2 tombol besar (Antar Sendiri / Kurir Desa) dengan deskripsi

### File yang Dimodifikasi
- `src/pages/merchant/MerchantOrdersPage.tsx` -- satu-satunya file yang perlu diubah

### Tidak Ada Perubahan Database
Perbaikan ini murni frontend.
