/**
 * P4-01: Offline POS — IndexedDB wrapper
 * Caches products and pending transactions locally.
 * Auto-syncs pending transactions when connection is restored.
 */

const DB_NAME = "desamart_pos_offline";
const DB_VERSION = 1;

const STORES = {
  PRODUCTS: "pos_products",
  PENDING_SALES: "pending_sales",
  SYNC_LOG: "sync_log",
} as const;

export interface OfflineProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost_price: number;
  unit: string;
  tax_rate: number;
  is_stock_tracked: boolean;
  image_url: string | null;
  is_active: boolean;
  category_name?: string;
  stock_qty?: number;
  cached_at: number;
}

export interface PendingSale {
  id: string;
  outlet_id: string;
  tenant_id: string;
  cashier_id: string;
  items: Array<{
    product_id: string;
    name: string;
    qty: number;
    price: number;
    discount: number;
    tax_rate: number;
  }>;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_method: string;
  customer_id?: string | null;
  customer_name?: string | null;
  notes?: string;
  created_at: string;
  synced: boolean;
  sync_error?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: "id" });
        productStore.createIndex("barcode", "barcode", { unique: false });
        productStore.createIndex("cached_at", "cached_at", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PENDING_SALES)) {
        const salesStore = db.createObjectStore(STORES.PENDING_SALES, { keyPath: "id" });
        salesStore.createIndex("synced", "synced", { unique: false });
        salesStore.createIndex("outlet_id", "outlet_id", { unique: false });
        salesStore.createIndex("created_at", "created_at", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
        db.createObjectStore(STORES.SYNC_LOG, { keyPath: "id", autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Products Cache ───────────────────────────────────────────────────────────

export async function cacheProducts(products: OfflineProduct[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PRODUCTS, "readwrite");
  const store = tx.objectStore(STORES.PRODUCTS);
  const now = Date.now();

  for (const product of products) {
    store.put({ ...product, cached_at: now });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProducts(): Promise<OfflineProduct[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.PRODUCTS, "readonly");
  const store = tx.objectStore(STORES.PRODUCTS);

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function findProductByBarcode(barcode: string): Promise<OfflineProduct | null> {
  const db = await openDB();
  const tx = db.transaction(STORES.PRODUCTS, "readonly");
  const store = tx.objectStore(STORES.PRODUCTS);
  const idx = store.index("barcode");

  return new Promise((resolve, reject) => {
    const req = idx.get(barcode);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearProductCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PRODUCTS, "readwrite");
  tx.objectStore(STORES.PRODUCTS).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Pending Sales ────────────────────────────────────────────────────────────

export async function savePendingSale(sale: Omit<PendingSale, "synced">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PENDING_SALES, "readwrite");
  tx.objectStore(STORES.PENDING_SALES).put({ ...sale, synced: false });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.PENDING_SALES, "readonly");
  const store = tx.objectStore(STORES.PENDING_SALES);
  const idx = store.index("synced");

  return new Promise((resolve, reject) => {
    const req = idx.getAll(IDBKeyRange.only(false));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function markSaleSynced(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PENDING_SALES, "readwrite");
  const store = tx.objectStore(STORES.PENDING_SALES);

  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        store.put({ ...record, synced: true });
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markSaleSyncError(id: string, error: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PENDING_SALES, "readwrite");
  const store = tx.objectStore(STORES.PENDING_SALES);

  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        store.put({ ...record, sync_error: error });
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSaleCount(): Promise<number> {
  const pending = await getPendingSales();
  return pending.length;
}

// ─── Auto-sync on reconnect ───────────────────────────────────────────────────

export async function syncPendingSales(
  syncFn: (sale: PendingSale) => Promise<{ success: boolean; error?: string }>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const result = await syncFn(sale);
      if (result.success) {
        await markSaleSynced(sale.id);
        synced++;
      } else {
        await markSaleSyncError(sale.id, result.error || "Unknown error");
        failed++;
      }
    } catch (err) {
      await markSaleSyncError(sale.id, err instanceof Error ? err.message : "Sync failed");
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Hook: usePOSOfflineSync ──────────────────────────────────────────────────
// Exported separately in src/hooks/usePOSOfflineSync.ts
