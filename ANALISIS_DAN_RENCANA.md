# DesaMart — Panduan Pengerjaan Sprint 3

> Stack: React 18 + Vite + Express + PostgreSQL (Replit)
> Update terakhir: Sprint 2 selesai — Sprint 3 sedang dikerjakan
> **File ini adalah panduan implementasi, bukan dokumen analisis.**

---

## PROGRESS SPRINT

| Sprint | Selesai | Item |
|---|---|---|
| ✅ Sprint 1 | 6 item | S1, S2, S5, S10, B5, B7 |
| ✅ Sprint 2 | 5 item | S3, S4, S6, S7, S8 |
| 🔄 Sprint 3 (sekarang) | 0/5 | **B1, B2, O5, S9, O1** |

---

## SPRINT 3 — URUTAN PENGERJAAN

```
B1 → B2 → O5 → S9 → O1
```

Estimasi total: **~10 jam** (1–2 hari kerja)

---

## B1 — POS Dashboard: Ganti 13 DB Call dengan 1 Endpoint Agregat

**Estimasi:** 3 jam
**Status:** ⬜ Belum

### Masalah Saat Ini

File `src/pages/pos/POSDashboardPage.tsx`, fungsi `fetchDashboardStats()`:

```
6 query paralel (today/week/month sales, products, customers, stock)
+
7 query SEQUENTIAL di dalam for-loop (chart 7 hari)
= 13 DB calls per render dashboard
```

Loop yang bermasalah (baris 56–63):
```ts
for (let i = 6; i >= 0; i--) {
  const day = subDays(now, i);
  const { data } = await supabase.from('pos_sales').select('total')
    .eq('tenant_id', tenantId).eq('outlet_id', outletId)
    .gte('created_at', start).lte('created_at', end);
  // → 7 round-trip ke DB, satu per hari
}
```

### Solusi: Endpoint Server `/api/pos/dashboard-stats`

#### Langkah 1 — Buat file `server/routes/pos.ts`

```ts
import { Router, Request, Response } from "express";
import { pool } from "../db";
import { getSessionUser } from "../auth";

const router = Router();

router.get("/dashboard-stats", async (req: Request, res: Response) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { tenant_id, outlet_id } = req.query as {
    tenant_id: string;
    outlet_id: string;
  };

  if (!tenant_id || !outlet_id) {
    return res.status(400).json({ error: "tenant_id dan outlet_id wajib diisi" });
  }

  const client = await pool.connect();
  try {
    // Satu query untuk semua statistik sales (today, week, month, chart 7 hari)
    const salesQuery = `
      WITH sales_base AS (
        SELECT
          total::numeric,
          created_at
        FROM pos_sales
        WHERE tenant_id = $1
          AND outlet_id = $2
          AND status = 'completed'
          AND created_at >= NOW() - INTERVAL '35 days'
      ),
      today_stats AS (
        SELECT
          COALESCE(SUM(total), 0) AS today_sales,
          COUNT(*) AS today_transactions
        FROM sales_base
        WHERE created_at >= DATE_TRUNC('day', NOW())
          AND created_at < DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
      ),
      week_stats AS (
        SELECT COALESCE(SUM(total), 0) AS week_sales
        FROM sales_base
        WHERE created_at >= DATE_TRUNC('week', NOW())
          AND created_at < DATE_TRUNC('week', NOW()) + INTERVAL '7 days'
      ),
      month_stats AS (
        SELECT COALESCE(SUM(total), 0) AS month_sales
        FROM sales_base
        WHERE created_at >= DATE_TRUNC('month', NOW())
          AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      ),
      chart_data AS (
        SELECT
          DATE_TRUNC('day', created_at)::date AS day,
          COALESCE(SUM(total), 0) AS total
        FROM sales_base
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY 1
        ORDER BY 1
      )
      SELECT
        t.today_sales,
        t.today_transactions,
        w.week_sales,
        m.month_sales,
        JSON_AGG(
          JSON_BUILD_OBJECT('day', c.day, 'total', c.total)
          ORDER BY c.day
        ) AS chart_raw
      FROM today_stats t, week_stats w, month_stats m, chart_data c
      GROUP BY t.today_sales, t.today_transactions, w.week_sales, m.month_sales
    `;

    // Query paralel: sales agregat + products + customers + stock
    const [salesResult, productsResult, customersResult, stockResult] =
      await Promise.all([
        client.query(salesQuery, [tenant_id, outlet_id]),
        client.query(
          `SELECT COUNT(*) AS total FROM pos_products WHERE tenant_id = $1 AND is_active = true`,
          [tenant_id]
        ),
        client.query(
          `SELECT COUNT(*) AS total FROM pos_customers WHERE tenant_id = $1`,
          [tenant_id]
        ),
        client.query(
          `SELECT quantity, min_stock FROM pos_stock WHERE outlet_id = $1`,
          [outlet_id]
        ),
      ]);

    const s = salesResult.rows[0] || {};
    const chartRaw: { day: string; total: number }[] = s.chart_raw || [];

    // Isi hari yang tidak ada transaksi dengan 0
    const salesChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const found = chartRaw.find((r) => r.day.slice(0, 10) === iso);
      const labels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
      salesChart.push({
        label: labels[d.getDay()],
        total: found ? Number(found.total) : 0,
      });
    }

    const stockRows = stockResult.rows;
    const lowStockCount = stockRows.filter(
      (r: any) => Number(r.quantity) <= Number(r.min_stock || 5)
    ).length;

    return res.json({
      todaySales: Number(s.today_sales || 0),
      todayTransactions: Number(s.today_transactions || 0),
      weekSales: Number(s.week_sales || 0),
      monthSales: Number(s.month_sales || 0),
      totalProducts: Number(productsResult.rows[0]?.total || 0),
      totalCustomers: Number(customersResult.rows[0]?.total || 0),
      lowStockCount,
      topProducts: [],
      salesChart,
    });
  } finally {
    client.release();
  }
});

export default router;
```

#### Langkah 2 — Daftarkan route di `server/routes/index.ts`

```ts
// Tambahkan import
import posRouter from "./pos";

// Tambahkan setelah route lain
router.use("/pos", posRouter);
```

#### Langkah 3 — Ubah `src/pages/pos/POSDashboardPage.tsx`

Ganti seluruh fungsi `fetchDashboardStats` dengan:

```ts
async function fetchDashboardStats(tenantId: string, outletId: string): Promise<DashboardStats> {
  const res = await fetch(
    `/api/pos/dashboard-stats?tenant_id=${tenantId}&outlet_id=${outletId}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Gagal memuat statistik dashboard");
  return res.json();
}
```

Hapus semua import yang tidak lagi dipakai setelah refactor:
```ts
// Hapus: supabase, format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays
// Pertahankan: format (untuk tanggal di JSX), idLocale
```

#### Hasil yang Diharapkan

| Sebelum | Sesudah |
|---|---|
| 13 round-trip ke DB | 4 query paralel (1 CTE besar + 3 COUNT) |
| ~800ms+ load time | ~100–150ms |
| Supabase client langsung dari frontend | Semua query di server (aman) |

#### Verifikasi

1. Buka `/pos/dashboard` di browser
2. Buka DevTools → Network → pastikan hanya ada 1 request ke `/api/pos/dashboard-stats`
3. Periksa semua angka (omzet hari ini, chart 7 hari, stok menipis) tampil benar

---

## B2 — useMerchantQuota: Ganti Loop Sequential dengan Promise.all

**Estimasi:** 2 jam
**Status:** ⬜ Belum
**File:** `src/hooks/useMerchantQuota.ts`

### Masalah Saat Ini

Fungsi `checkQuotas()` (baris 41–124):

```ts
for (const merchantId of merchantIds) {
  // Call 1: GET merchant info
  const { data: merchant } = await supabase.from('merchants')...
  // Call 2: GET subscriptions
  const { data: subscriptions } = await supabase.from('merchant_subscriptions')...
  // Call 3: COUNT orders bulan ini
  const { count: ordersCount } = await supabase.from('orders')...
}
// 3 merchant = 9 call sequential → checkout lambat
```

### Solusi: Promise.all per Merchant + Endpoint Server

#### Opsi A — Quick fix: parallelkan loop yang ada (tanpa ubah endpoint)

Ganti isi fungsi `checkQuotas` di `useMerchantQuota.ts`:

```ts
const checkQuotas = useCallback(async () => {
  if (merchantIds.length === 0) {
    setLoading(false);
    return;
  }

  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthISO = startOfMonth.toISOString();

    // Jalankan semua merchant SECARA PARALEL
    const results = await Promise.all(
      merchantIds.map(async (merchantId) => {
        // Tiga query tiap merchant juga paralel
        const [merchantRes, subscriptionsRes, ordersRes] = await Promise.all([
          supabase
            .from('merchants')
            .select('id, name')
            .eq('id', merchantId)
            .maybeSingle(),
          supabase
            .from('merchant_subscriptions')
            .select(`transaction_quota, used_quota, expired_at, status, package:transaction_packages(name)`)
            .eq('merchant_id', merchantId)
            .eq('status', 'ACTIVE')
            .gte('expired_at', new Date().toISOString())
            .order('expired_at', { ascending: true }),
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .gte('created_at', startOfMonthISO),
        ]);

        const merchant = merchantRes.data;
        if (!merchant) return null;

        const subscriptions = subscriptionsRes.data || [];
        const currentUsage = ordersRes.count || 0;

        let status: MerchantQuotaStatus;

        if (subscriptions.length > 0) {
          const totalQuota = subscriptions.reduce((sum, sub) => sum + sub.transaction_quota, 0);
          const usedQuota = subscriptions.reduce((sum, sub) => sum + sub.used_quota, 0);
          const remaining = totalQuota - usedQuota;
          const firstSub = subscriptions[0];
          const pkg = firstSub.package as { name: string } | null;

          status = {
            merchantId,
            merchantName: merchant.name,
            canTransact: remaining > 0,
            remainingQuota: remaining,
            totalQuota,
            usedQuota,
            expiresAt: firstSub.expired_at,
            packageName:
              subscriptions.length > 1
                ? `${pkg?.name} (+${subscriptions.length - 1} paket)`
                : pkg?.name || null,
            type: 'premium',
          };
        } else {
          const freeLimit = await getFreeTierLimit();
          const remaining = Math.max(0, freeLimit - currentUsage);
          status = {
            merchantId,
            merchantName: merchant.name,
            canTransact: remaining > 0,
            remainingQuota: remaining,
            totalQuota: freeLimit,
            usedQuota: currentUsage,
            expiresAt: null,
            packageName: 'Free Tier',
            type: 'free',
          };
        }

        return status;
      })
    );

    const statuses: Record<string, MerchantQuotaStatus> = {};
    const blocked: MerchantQuotaStatus[] = [];

    for (const status of results) {
      if (!status) continue;
      statuses[status.merchantId] = status;
      if (!status.canTransact) blocked.push(status);
    }

    setQuotaStatuses(statuses);
    setBlockedMerchants(blocked);
  } catch (error) {
    console.error('Error checking merchant quotas:', error);
  } finally {
    setLoading(false);
  }
}, [merchantIds]);
```

#### Opsi B — Solusi optimal: Endpoint server `/api/pos/merchant-quotas` (direkomendasikan)

Tambahkan ke `server/routes/pos.ts`:

```ts
router.post("/merchant-quotas", async (req: Request, res: Response) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { merchant_ids } = req.body as { merchant_ids: string[] };
  if (!Array.isArray(merchant_ids) || merchant_ids.length === 0) {
    return res.status(400).json({ error: "merchant_ids harus berupa array" });
  }

  const client = await pool.connect();
  try {
    const placeholders = merchant_ids.map((_, i) => `$${i + 1}`).join(", ");
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Satu query untuk semua merchant sekaligus
    const [merchantsResult, subscriptionsResult, ordersResult, settingsResult] =
      await Promise.all([
        client.query(
          `SELECT id, name FROM merchants WHERE id IN (${placeholders})`,
          merchant_ids
        ),
        client.query(
          `SELECT
             ms.merchant_id,
             ms.transaction_quota,
             ms.used_quota,
             ms.expired_at,
             tp.name AS package_name
           FROM merchant_subscriptions ms
           LEFT JOIN transaction_packages tp ON ms.package_id = tp.id
           WHERE ms.merchant_id IN (${placeholders})
             AND ms.status = 'ACTIVE'
             AND ms.expired_at >= NOW()
           ORDER BY ms.expired_at ASC`,
          merchant_ids
        ),
        client.query(
          `SELECT merchant_id, COUNT(*) AS order_count
           FROM orders
           WHERE merchant_id IN (${placeholders})
             AND created_at >= $${merchant_ids.length + 1}
           GROUP BY merchant_id`,
          [...merchant_ids, startOfMonth.toISOString()]
        ),
        client.query(
          `SELECT value FROM app_settings WHERE key = 'free_tier_quota' LIMIT 1`
        ),
      ]);

    const freeTierLimit =
      (settingsResult.rows[0]?.value as { limit?: number })?.limit ?? 100;

    const subscriptionsByMerchant: Record<string, any[]> = {};
    for (const row of subscriptionsResult.rows) {
      if (!subscriptionsByMerchant[row.merchant_id]) {
        subscriptionsByMerchant[row.merchant_id] = [];
      }
      subscriptionsByMerchant[row.merchant_id].push(row);
    }

    const ordersByMerchant: Record<string, number> = {};
    for (const row of ordersResult.rows) {
      ordersByMerchant[row.merchant_id] = Number(row.order_count);
    }

    const statuses: Record<string, MerchantQuotaStatus> = {};
    for (const merchant of merchantsResult.rows) {
      const subs = subscriptionsByMerchant[merchant.id] || [];
      const currentUsage = ordersByMerchant[merchant.id] || 0;

      if (subs.length > 0) {
        const totalQuota = subs.reduce((s, r) => s + Number(r.transaction_quota), 0);
        const usedQuota = subs.reduce((s, r) => s + Number(r.used_quota), 0);
        const remaining = totalQuota - usedQuota;
        statuses[merchant.id] = {
          merchantId: merchant.id,
          merchantName: merchant.name,
          canTransact: remaining > 0,
          remainingQuota: remaining,
          totalQuota,
          usedQuota,
          expiresAt: subs[0].expired_at,
          packageName:
            subs.length > 1
              ? `${subs[0].package_name} (+${subs.length - 1} paket)`
              : subs[0].package_name || null,
          type: "premium",
        };
      } else {
        const remaining = Math.max(0, freeTierLimit - currentUsage);
        statuses[merchant.id] = {
          merchantId: merchant.id,
          merchantName: merchant.name,
          canTransact: remaining > 0,
          remainingQuota: remaining,
          totalQuota: freeTierLimit,
          usedQuota: currentUsage,
          expiresAt: null,
          packageName: "Free Tier",
          type: "free",
        };
      }
    }

    return res.json(statuses);
  } finally {
    client.release();
  }
});
```

Kemudian update `useMerchantQuota.ts` untuk pakai endpoint ini:

```ts
const checkQuotas = useCallback(async () => {
  if (merchantIds.length === 0) { setLoading(false); return; }
  try {
    const res = await fetch('/api/pos/merchant-quotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ merchant_ids: merchantIds }),
    });
    if (!res.ok) throw new Error('Gagal cek kuota merchant');
    const statuses: Record<string, MerchantQuotaStatus> = await res.json();
    const blocked = Object.values(statuses).filter(s => !s.canTransact);
    setQuotaStatuses(statuses);
    setBlockedMerchants(blocked);
  } catch (error) {
    console.error('Error checking merchant quotas:', error);
  } finally {
    setLoading(false);
  }
}, [merchantIds]);
```

Hapus juga `supabase.channel('quota-changes')` — ganti dengan polling atau SSE dari server.

#### Hasil yang Diharapkan

| Skenario | Sebelum | Sesudah (Opsi A) | Sesudah (Opsi B) |
|---|---|---|---|
| 1 merchant | 3 call sequential | 3 call paralel | 1 request server |
| 3 merchant | 9 call sequential | 3×3 call paralel | 1 request server |
| 5 merchant | 15 call sequential | 5×3 call paralel | 1 request server |

#### Verifikasi

1. Buka halaman checkout dengan 2–3 merchant berbeda di cart
2. DevTools → Network: hitung request ke Supabase/API
3. Pastikan `canProceedCheckout` muncul dalam < 300ms

---

## O5 — SSE Heartbeat: Tambah Max Connection Timeout

**Estimasi:** 1 jam
**Status:** ⬜ Belum
**File:** `server/routes/sse.ts`

### Masalah

Setiap koneksi SSE buat `setInterval(25s)` tapi jika `req.on('close')` tidak terpanggil akibat network drop, interval bocor memory (memory leak per koneksi zombie).

### Solusi

Temukan blok koneksi SSE di `server/routes/sse.ts` dan tambahkan max timeout:

```ts
// Setelah setup SSE headers dan heartbeat interval, tambahkan:
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 menit

const connectionTimeout = setTimeout(() => {
  res.end();
}, MAX_DURATION_MS);

req.on("close", () => {
  clearInterval(heartbeat);        // nama variable interval yang sudah ada
  clearTimeout(connectionTimeout);
  // hapus dari sseManager jika ada
});
```

---

## S9 — Validasi Magic Bytes File Upload

**Estimasi:** 2 jam
**Status:** ⬜ Belum
**File:** `server/routes/storage.ts`

### Masalah

Upload gambar hanya mengecek ekstensi nama file (bisa ditipu). Tidak ada pengecekan konten file sesungguhnya.

### Solusi

#### Langkah 1 — Install package

```bash
npm install file-type
```

#### Langkah 2 — Tambahkan validasi di `server/routes/storage.ts`

```ts
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Di dalam handler upload, setelah dapat buffer:
if (buffer.length > MAX_SIZE_BYTES) {
  return res.status(400).json({ error: "Ukuran file melebihi 5MB" });
}

const fileType = await fileTypeFromBuffer(buffer);
if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
  return res.status(400).json({
    error: `Tipe file tidak diizinkan. Hanya JPG, PNG, WebP, GIF yang diperbolehkan.`
  });
}
```

---

## O1 — Pecah POSKasirPage.tsx (1525 baris)

**Estimasi:** 1 hari
**Status:** ⬜ Belum
**File:** `src/pages/pos/POSKasirPage.tsx`

### Masalah

Satu file 1525+ baris mengandung: cart logic, payment dialog, loyalty section, barcode scanner, held bills, promo — semua state jadi satu, re-render berlebihan.

### Rencana Pecah Komponen

```
src/
  pages/pos/
    POSKasirPage.tsx          ← hanya orchestrator (200 baris)
  components/pos/kasir/
    POSCart.tsx               ← daftar item + qty editor
    POSCartItem.tsx           ← satu row item cart
    POSPaymentDialog.tsx      ← pilih metode + proses bayar
    POSLoyaltySection.tsx     ← input poin + cashback
    POSHeldBills.tsx          ← list bill yang ditahan
    POSBarcodeScanner.tsx     ← scanner kamera
    POSPromoInput.tsx         ← input kode promo
```

### Langkah Pengerjaan

1. Buat folder `src/components/pos/kasir/`
2. Identifikasi state yang dipakai tiap section (baca file dulu)
3. Pindahkan JSX + state lokal ke komponen masing-masing
4. Gunakan props untuk data yang dibagi antar komponen
5. Gunakan context (`POSKasirContext`) jika terlalu banyak prop drilling
6. Test: semua fitur kasir tetap berjalan (bayar, hold bill, scan barcode, loyalty)

---

## STATUS ITEM LENGKAP

| ID | Judul | Sprint | Status |
|---|---|---|---|
| S1 | Auth di INSERT/UPDATE/DELETE | 1 | ✅ Selesai |
| S2 | Guard DELETE/UPDATE tanpa filter | 1 | ✅ Selesai |
| S3 | SSE broadcast per-user | 2 | ✅ Selesai |
| S4 | Token di URL → exchange code | 2 | ✅ Selesai |
| S5 | Push subscribe verifikasi user | 1 | ✅ Selesai |
| S6 | CORS restrict origin | 2 | ✅ Selesai |
| S7 | Rate limit di server | 2 | ✅ Selesai |
| S8 | Session persistent di DB | 2 | ✅ Selesai |
| S9 | Validasi magic bytes file upload | 3 | ⬜ Sprint 3 |
| S10 | Validasi kekuatan password | 1 | ✅ Selesai |
| B1 | POS Dashboard N+1 queries | 3 | ⬜ Sprint 3 |
| B2 | useMerchantQuota sequential | 3 | ⬜ Sprint 3 |
| B3 | File upload tidak persistent | 4 | ⬜ Sprint 4 (lihat F2) |
| B4 | Refactor AuthContext dari shim | 4 | ⬜ Sprint 4 |
| B5 | React Router future flags | 1 | ✅ Selesai |
| B6 | Email reset password | 4 | ⬜ Sprint 4 (lihat F1) |
| B7 | Xendit webhook signature | 1 | ✅ Selesai |
| B8 | Scheduled jobs tidak ada | 4 | ⬜ Sprint 4 (lihat F3) |
| B9 | Cashback auto-credit | 4 | ⬜ Sprint 4 (lihat F7) |
| B10 | Refund saldo transfer | 4 | ⬜ Sprint 4 (lihat F4) |
| O1 | Pecah POSKasirPage.tsx | 3 | ⬜ Sprint 3 |
| O2 | Upload multipart bukan base64 | 4 | ⬜ Sprint 4 |
| O3 | staleTime per query | 4 | ⬜ Sprint 4 |
| O4 | DB join efficiency | 4 | ⬜ Sprint 4 |
| O5 | SSE connection max timeout | 3 | ⬜ Sprint 3 |
| O6 | useMerchantQuota paralel | 3 | ⬜ Sprint 3 (= B2) |
| O7 | Suspense fallback konsisten | 4 | ⬜ Sprint 4 |
| O8 | Cart localStorage size limit | 4 | ⬜ Sprint 4 |
| F1 | Email notifikasi (SMTP) | 4 | ⬜ Sprint 4 |
| F2 | Object storage persistent | 4 | ⬜ Sprint 4 |
| F3 | Cron job / scheduler | 4 | ⬜ Sprint 4 |
| F4 | Refund processing otomatis | 4 | ⬜ Sprint 4 |
| F5 | Halaman dispute/komplain buyer | 4 | ⬜ Sprint 4 |
| F6 | Export laporan PDF/CSV | 4 | ⬜ Sprint 4 |
| F7 | Cashback auto-credit server | 4 | ⬜ Sprint 4 |
| F8 | Status verifikasi merchant | 4 | ⬜ Sprint 4 |
| F9 | Analytics merchant richer | 4 | ⬜ Sprint 4 |
