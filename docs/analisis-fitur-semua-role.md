# DesaMart — Analisis Fitur untuk Semua Role

> Tanggal: 8 Mei 2026
> Cakupan: Marketplace DesaMart + POS SaaS (Phase 1–6)

---

## 1. SUPER ADMIN (Role: `admin`)

Super Admin adalah pengelola platform DesaMart secara keseluruhan. Memiliki akses penuh ke semua fitur.

### Fitur yang Sudah Ada

| Fitur | Status | Nilai Bisnis |
|-------|--------|-------------|
| Dashboard admin dengan KPI platform | ✅ | Pantau kesehatan platform |
| Manajemen merchant (CRUD, approve/reject) | ✅ | Kontrol kualitas penjual |
| Manajemen order lintas merchant | ✅ | Resolusi sengketa |
| Manajemen verifikator & assignment desa | ✅ | Governance desa |
| Manajemen kurir & tracking order | ✅ | Kontrol logistik |
| Paket berlangganan POS SaaS | ✅ | Revenue model |
| Laporan keuangan platform | ✅ | Monetisasi |
| Manajemen review & rating | ✅ | Kualitas platform |
| Manajemen kategori & konten | ✅ | Kurasi marketplace |
| Notifikasi sistem | ✅ | Operasional |

### Fitur yang Direkomendasikan (Belum Ada)

| Fitur | Prioritas | Alasan |
|-------|-----------|--------|
| **Dashboard analitik real-time** (GMV, transaksi/jam, funnel konversi) | 🔴 Tinggi | Pengambilan keputusan strategis |
| **Manajemen komisi & fee** per kategori / merchant | 🔴 Tinggi | Model revenue fleksibel |
| **Sistem broadcast notifikasi** ke semua user / segment | 🔴 Tinggi | Komunikasi platform |
| **Audit log platform** (siapa ubah apa, kapan) | 🟡 Sedang | Keamanan & compliance |
| **Manajemen banner & promosi platform** | 🟡 Sedang | Marketing platform |
| **Laporan pendapatan POS SaaS** per tenant | 🟡 Sedang | Monitoring SaaS revenue |
| **Export laporan ke PDF/Excel** | 🟡 Sedang | Pelaporan manajemen |
| **Manajemen API key** untuk integrasi third-party | 🟢 Rendah | Ekosistem terbuka |
| **A/B testing konfigurasi** fee & promosi | 🟢 Rendah | Optimasi growth |

---

## 2. ADMIN DESA (Role: `admin_desa`)

Admin Desa mengelola identitas desa, pariwisata desa, dan hubungan dengan merchant lokal. Bertugas sebagai koordinator ekosistem UMKM di desa.

### Fitur yang Sudah Ada

| Fitur | Status | Nilai Bisnis |
|-------|--------|-------------|
| Dashboard desa | ✅ | Ringkasan aktivitas desa |
| Manajemen destinasi wisata desa | ✅ | Promosi pariwisata |
| Profil desa (nama, foto, deskripsi) | ✅ | Branding desa |
| Lihat merchant yang terdaftar di desa | ✅ | Monitoring UMKM |

### Fitur yang Direkomendasikan (Belum Ada)

| Fitur | Prioritas | Alasan |
|-------|-----------|--------|
| **Laporan ekonomi desa** (total omzet UMKM, jumlah transaksi, pertumbuhan) | 🔴 Tinggi | Laporan ke pemerintah daerah |
| **Manajemen event desa** (pasar malam, festival, pameran produk) | 🔴 Tinggi | Aktivasi komunitas & pengunjung |
| **Keanggotaan UMKM** (daftar, verifikasi, sertifikat digital) | 🔴 Tinggi | Legitimasi usaha |
| **Halal/sertifikasi produk** di tingkat desa | 🟡 Sedang | Kepercayaan pembeli |
| **Peta interaktif** lokasi merchant & wisata di desa | 🟡 Sedang | Panduan wisatawan |
| **Manajemen kurir desa** (ojek desa, penugasan) | 🟡 Sedang | Logistik lokal |
| **Broadcast pengumuman** ke semua merchant desa | 🟡 Sedang | Koordinasi komunitas |
| **Laporan kunjungan wisatawan** (traffic, waktu kunjungan, rating) | 🟡 Sedang | Evaluasi pariwisata |
| **Integrasi kalender event** nasional & desa | 🟢 Rendah | Perencanaan promosi |
| **Akses read-only ke data POS** merchant di desanya | 🟢 Rendah | Transparansi UMKM |

---

## 3. MERCHANT / PEMILIK TOKO (Role: `merchant`)

Merchant adalah pengelola toko di marketplace DesaMart. Dapat juga berlangganan POS SaaS untuk mengelola toko fisiknya.

### Fitur Marketplace yang Sudah Ada

| Fitur | Status | Nilai Bisnis |
|-------|--------|-------------|
| Manajemen produk (CRUD, foto, varian) | ✅ | Katalog toko online |
| Manajemen order (terima, proses, kirim) | ✅ | Operasional penjualan |
| Laporan penjualan dasar | ✅ | Evaluasi performa |
| Pengaturan toko (slug, banner, deskripsi) | ✅ | Branding toko |
| Chat dengan pembeli | ✅ | Layanan pelanggan |
| Review & rating produk | ✅ | Reputasi toko |
| Voucher & promosi toko | ✅ | Strategi marketing |
| Manajemen kurir/ekspedisi | ✅ | Pengiriman fleksibel |
| Statistik pengunjung toko | ✅ | Analytics basic |
| Iuran & paket berlangganan | ✅ | Revenue stream |

### Fitur POS SaaS yang Sudah Ada (Phase 1–6)

| Fitur | Status | Nilai Bisnis |
|-------|--------|-------------|
| Kasir digital dengan barcode scanner | ✅ | Efisiensi kasir |
| Multi-metode pembayaran | ✅ | Fleksibilitas transaksi |
| Manajemen stok real-time | ✅ | Kontrol inventory |
| Purchase Order ke supplier | ✅ | Manajemen pengadaan |
| Laporan laba rugi | ✅ | Kesehatan finansial |
| Multi-outlet & transfer stok | ✅ | Ekspansi usaha |
| Audit trail aktivitas | ✅ | Kontrol tim |
| Promosi & voucher | ✅ (Phase 5) | Retensi pelanggan |
| Program loyalty poin | ✅ (Phase 5) | Loyalitas pelanggan |
| Integrasi marketplace ↔ POS | ✅ (Phase 6) | Omnichannel |

### Fitur yang Direkomendasikan (Belum Ada)

| Fitur | Prioritas | Alasan |
|-------|-----------|--------|
| **Laporan cashflow** bulanan otomatis (arus kas masuk/keluar) | 🔴 Tinggi | Kesehatan finansial UMKM |
| **Notifikasi WhatsApp** ke pelanggan (struk digital, promo, poin) | 🔴 Tinggi | Engagement pelanggan |
| **Integrasi akuntansi** (export ke format jurnal umum) | 🔴 Tinggi | Kemudahan laporan pajak |
| **Aplikasi mobile kasir** (PWA offline-capable) | 🔴 Tinggi | Fleksibilitas operasional |
| **Printer thermal** (ESC/POS via Web Serial API) | 🔴 Tinggi | Kebutuhan toko fisik |
| **Auto-reorder point** (notifikasi saat stok < threshold) | 🟡 Sedang | Efisiensi pengadaan |
| **Analitik produk** (slow-moving, dead stock, turnover rate) | 🟡 Sedang | Optimasi inventory |
| **Split payment** (bayar sebagian tunai, sebagian QRIS) | 🟡 Sedang | Fleksibilitas pembayaran |
| **Cetak label produk** dengan barcode dari dalam POS | 🟡 Sedang | Labeling produk |
| **Kartu member digital** (QR code member untuk di-scan kasir) | 🟡 Sedang | Pengalaman member |
| **Dashboard multi-toko** (jika punya beberapa brand/toko) | 🟢 Rendah | Manajemen portofolio |
| **Mode kiosk** (self-checkout untuk event/pameran) | 🟢 Rendah | Use case khusus |

---

## 4. KURIR (Role: `courier`)

Kurir bertugas mengantarkan pesanan dari merchant ke pembeli, termasuk layanan Ojek Desa (ride-hailing lokal).

### Fitur yang Sudah Ada

| Fitur | Status | Nilai Bisnis |
|-------|--------|-------------|
| Dashboard kurir | ✅ | Ringkasan pengiriman |
| Daftar order yang perlu diantarkan | ✅ | Task management |
| Update status pengiriman | ✅ | Tracking real-time |
| Riwayat pengiriman & pendapatan | ✅ | Laporan penghasilan |
| Ojek Desa — ride hailing lokal | ✅ | Diversifikasi layanan |
| Notifikasi order baru | ✅ | Responsivitas |
| Auto-assign kurir terdekat (Edge Function) | ✅ | Efisiensi dispatch |

### Fitur yang Direkomendasikan (Belum Ada)

| Fitur | Prioritas | Alasan |
|-------|-----------|--------|
| **Navigasi GPS terintegrasi** (buka Google Maps / Waze langsung dari order) | 🔴 Tinggi | Efisiensi pengiriman |
| **Bukti kirim foto** (upload foto saat selesai antar) | 🔴 Tinggi | Konfirmasi pengiriman |
| **Sistem rating kurir** oleh pembeli | 🔴 Tinggi | Kualitas layanan |
| **Rekap pendapatan harian/mingguan** dengan breakdown per order | 🔴 Tinggi | Transparansi penghasilan |
| **Status online/offline** kurir (toggle availability) | 🟡 Sedang | Manajemen kapasitas |
| **Chat dengan pembeli** saat pengiriman | 🟡 Sedang | Koordinasi pengiriman |
| **Laporan performa** (tepat waktu %, km tempuh, order selesai) | 🟡 Sedang | Self-improvement |
| **Multi-order batching** (ambil beberapa order sekaligus) | 🟡 Sedang | Efisiensi operasional |
| **Zona layanan** (kurir bisa set radius layanan) | 🟢 Rendah | Kontrol beban kerja |
| **Insentif & bonus** target pengiriman | 🟢 Rendah | Motivasi kurir |

---

## 5. PEMBELI / BUYER (Role: `buyer`)

Pembeli adalah pengguna akhir yang berbelanja produk UMKM di marketplace DesaMart.

### Fitur yang Sudah Ada

| Fitur | Status | Nilai Bisnis |
|-------|--------|-------------|
| Beranda dengan produk & toko rekomendasi | ✅ | Penemuan produk |
| Pencarian produk, toko, kategori | ✅ | Navigasi |
| Halaman detail produk + foto + deskripsi | ✅ | Informasi pembelian |
| Keranjang belanja | ✅ | Pengalaman belanja |
| Checkout dengan berbagai metode bayar | ✅ | Konversi pembelian |
| Riwayat pesanan & status tracking | ✅ | Kepercayaan |
| Review & rating produk + toko | ✅ | Community trust |
| Wishlist / Favorit produk | ✅ | Retensi |
| Profil & manajemen alamat | ✅ | Kemudahan checkout |
| Notifikasi status pesanan | ✅ | Informasi real-time |
| Chat dengan merchant | ✅ | Pre-purchase support |
| Jelajahi desa wisata | ✅ | Pariwisata & lokal |

### Fitur yang Direkomendasikan (Belum Ada)

| Fitur | Prioritas | Alasan |
|-------|-----------|--------|
| **Program loyalitas pembeli** (poin belanja, tier VIP) | 🔴 Tinggi | Retensi & repeat order |
| **Kupon & voucher marketplace** (kode diskon dari platform) | 🔴 Tinggi | Konversi & akuisisi |
| **Flash sale & limited-time deals** | 🔴 Tinggi | Impulse buying |
| **Rekomendasi produk personal** (based on history, "Orang juga membeli") | 🔴 Tinggi | Upsell & cross-sell |
| **Cashback & reward** dari pembelian | 🟡 Sedang | Diferensiasi dari kompetitor |
| **Bundling produk** (beli set hemat) | 🟡 Sedang | AOV (Average Order Value) |
| **Notifikasi restok** (notif saat produk favorit tersedia lagi) | 🟡 Sedang | Konversi tertunda |
| **Lacak kurir live** (real-time GPS tracking) | 🟡 Sedang | Trust & transparansi |
| **Pembayaran cicilan** (via BNPL/Pay Later) | 🟡 Sedang | Akses pembelian lebih luas |
| **Perbandingan produk** (bandingkan 2-3 produk berdampingan) | 🟡 Sedang | Keputusan pembelian |
| **Struk digital** dari merchant (QR atau link) | 🟢 Rendah | Paperless experience |
| **Afiliasi / referral** (kode unik, komisi untuk ajak teman) | 🟢 Rendah | Viral growth |
| **Layanan langganan** (berlangganan produk rutin, misal sembako bulanan) | 🟢 Rendah | Recurring revenue |

---

## Ringkasan Prioritas Pengembangan Berikutnya

### Quick Wins (implementasi cepat, dampak tinggi)

| Fitur | Role Penerima Manfaat | Kategori |
|-------|----------------------|----------|
| WhatsApp notification (struk, poin, promo) | Merchant + Pembeli | Engagement |
| GPS navigation (buka Maps dari order) | Kurir | Operasional |
| Bukti kirim foto | Kurir + Pembeli | Trust |
| Program poin pembeli di marketplace | Pembeli | Retensi |
| Flash sale / promosi waktu terbatas | Merchant + Pembeli | Revenue |
| Export laporan ke PDF | Merchant + Admin | Produktivitas |

### Fitur Strategis Jangka Menengah

| Fitur | Role Penerima Manfaat | Kategori |
|-------|----------------------|----------|
| Printer thermal (Web Serial API) | Merchant | Operasional toko fisik |
| Laporan cashflow otomatis | Merchant | Finansial UMKM |
| Rekomendasi produk personal | Pembeli | Konversi |
| Peta interaktif desa | Admin Desa + Pembeli | Pariwisata |
| Dashboard GMV real-time | Super Admin | Monitoring platform |
| Laporan ekonomi desa | Admin Desa | Pelaporan pemerintah |

### Fitur Jangka Panjang (Ekosistem)

| Fitur | Dampak |
|-------|--------|
| Aplikasi mobile native (React Native / Expo) | Pengalaman mobile first |
| Integrasi akuntansi (Jurnal, MYOB, Accurate) | UMKM lebih bankable |
| Open API publik untuk third-party | Ekosistem developer |
| Program afiliasi & referral | Viral growth |
| BNPL / Pay Later | Inklusi keuangan |
| Mode offline PWA + IndexedDB sync | Reliabilitas di daerah |

---

## Matriks Kepuasan per Role

| Dimensi | Super Admin | Admin Desa | Merchant | Kurir | Pembeli |
|---------|:-----------:|:----------:|:--------:|:-----:|:-------:|
| **Kematangan Fitur** | 🟡 70% | 🟡 60% | 🟢 85% | 🟡 65% | 🟢 80% |
| **Kebutuhan Kritis Terpenuhi** | 🟢 Baik | 🟡 Cukup | 🟢 Baik | 🟡 Cukup | 🟢 Baik |
| **Gap Terbesar** | Analitik platform | Laporan & event | Mobile & printer | GPS & bukti kirim | Loyalty & personalisasi |

---

*Laporan ini dibuat otomatis berdasarkan analisis fitur yang telah diimplementasikan pada sistem DesaMart.*
