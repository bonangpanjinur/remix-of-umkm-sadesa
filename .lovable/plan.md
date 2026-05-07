# Fitur yang Belum Ada & Layak Diimplementasikan

Berdasarkan eksplorasi codebase DesaMart, berikut daftar fitur yang **belum tersedia** namun memberi dampak besar pada pengalaman, retensi, dan pendapatan platform. Dikelompokkan per area, diurutkan berdasarkan dampak vs effort.

---

## A. Buyer Experience (impact tinggi, effort sedang)

1. **Loyalty / Poin & Cashback**
   Poin per transaksi, redeem jadi diskon. Memicu repeat order — fitur klasik marketplace yang belum ada di project.

2. **Referral Program ("Ajak Teman")**
   Kode referral unik per user, reward untuk pengundang & yang diundang. Cocok untuk pertumbuhan organik di komunitas desa.

3. **Live Order Tracking di Buyer Side dengan Map**
   Sudah ada `CourierMap` & realtime tracking untuk kurir. Belum ada halaman buyer yang menampilkan posisi kurir di peta secara live (saat ini hanya status text).

4. **Repeat Order / "Pesan Lagi"** dari halaman Orders
   1-click reorder dari riwayat — sederhana, sangat berguna untuk produk konsumsi harian.

5. **Subscribe & Save (Langganan Mingguan/Bulanan)**
   Untuk produk rutin (sayur, sembako). Auto-create order pada interval tertentu.

6. **Group Buy / Patungan Tetangga**
   Kumpulan order dari tetangga sekompleks → 1 pengiriman → ongkir lebih murah. Sangat relevan dengan tema desa.

7. **Wishlist Price Drop & Stock Alert**
   Notifikasi push saat item wishlist turun harga atau restock.

---

## B. Merchant Tools (impact tinggi, effort sedang)

8. **Inventory Bulk Import/Export (CSV/Excel)**
   Saat ini produk diinput satu-satu. Bulk import mempercepat onboarding merchant baru.

9. **Stock Auto-Restock Alert + Threshold**
   Notifikasi merchant saat stok di bawah batas minimum.

10. **Product Variants (ukuran, warna, rasa)**
    Saat ini 1 produk = 1 SKU. Tambah varian dengan stok & harga berbeda.

11. **Discount Bundling ("Beli 2 Hemat")**
    Promo bundle multi-produk, beda dari flash sale yang sudah ada.

12. **Auto-Reply Chat / FAQ Templates**
    Merchant set template balasan cepat ("Stok ready", "Dikirim besok").

13. **Merchant Mobile Notification Sound Per Event**
    Sudah ada beep untuk order baru. Tambah konfigurasi suara berbeda untuk chat, refund request, dsb.

---

## C. Courier / Ojek Desa (impact menengah)

14. **Courier Performance Score & Rating dari Buyer**
    Rating per pengiriman → leaderboard kurir → bonus dari admin.

15. **Multi-Stop Delivery (Batching)**
    1 kurir ambil beberapa order dari 1 toko sekaligus. Penghematan besar untuk pasar desa.

16. **Heatmap Permintaan untuk Kurir**
    Peta area dengan banyak request agar kurir tahu posisi optimal.

---

## D. Tourism Module (saat ini cukup pasif)

17. **Booking & Tiket Wisata Online**
    Saat ini Tourism hanya direktori. Tambah pembelian tiket + QR code masuk.

18. **Review & Foto Pengunjung Wisata**
    User-generated content untuk meningkatkan trust.

19. **Paket Wisata + Homestay + Kuliner UMKM**
    Cross-sell antar modul (wisata ↔ merchant lokal).

---

## E. Admin / Operasional (impact tinggi untuk skalabilitas)

20. **Dashboard Anomaly Detection**
    Alert otomatis saat lonjakan refund, order cancel, atau churn merchant.

21. **A/B Testing Banner & Promo**
    Test 2 varian banner di homepage, ukur CTR.

22. **Audit Log Searchable Timeline**
    `auditLog.ts` sudah ada — tambah UI filter/search yang user-friendly per entitas.

23. **Email Marketing Broadcast (selain push notification)**
    Sudah ada `AdminBroadcastPage`. Tambah jalur email + template builder sederhana.

---

## F. Trust & Safety (impact tinggi, sering terabaikan)

24. **Buyer Verification (KTP optional untuk COD besar)**
    Cegah fake order COD. Threshold transaksi tertentu wajib upload KTP.

25. **Dispute Center (selain Refund)**
    Mediasi 3-pihak (buyer-merchant-admin) dengan timeline & evidence upload.

26. **2FA untuk Merchant & Admin**
    OTP via email/SMS saat login dari device baru.

---

## G. PWA & Performance (quick wins)

27. **Offline Mode untuk Browse Produk**
    Cache produk terakhir dilihat di service worker — buyer di area sinyal lemah tetap bisa lihat.

28. **App Shortcuts (Android Long-Press Icon)**
    Quick action: "Pesan Lagi", "Cari Produk", "Top-up". Edit `manifest.webmanifest`.

29. **Skeleton Loading Konsisten Semua Halaman**
    Beberapa halaman masih flash-blank. Standardize skeleton component.

---

## H. AI Features (pakai Lovable AI Gateway, tanpa API key tambahan)

30. **AI Product Description Generator untuk Merchant**
    Input nama + foto produk → AI generate deskripsi menarik (Gemini Flash).

31. **AI Customer Service Bot (Layer Pertama)**
    Bot jawab pertanyaan umum sebelum eskalasi ke merchant. Hemat waktu UMKM.

32. **AI Smart Search (Semantic)**
    "Sambal pedas yang halal & murah" → pencarian semantik, bukan cuma keyword match.

33. **AI Image Auto-Tagging Produk**
    Upload foto → AI saran kategori + tag otomatis.

---

## Rekomendasi Prioritas (Top 5)

| # | Fitur | Alasan |
|---|---|---|
| 1 | **Repeat Order** | Effort kecil, retention tinggi |
| 2 | **Live Map Tracking di Buyer** | Infrastruktur sudah ada, tinggal UI |
| 3 | **AI Product Description Generator** | Lovable AI free, langsung bantu merchant |
| 4 | **Loyalty Points** | Memicu repeat purchase signifikan |
| 5 | **Product Variants** | Blocker bagi banyak kategori produk |

---

## Langkah Selanjutnya

Pilih 1–3 fitur dari daftar di atas (atau kombinasi), lalu saya akan buat plan teknis detail (skema DB, komponen, edge function, RLS) untuk masing-masing.
