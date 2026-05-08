/**
 * P4-01: POS Offline Sync Hook
 * Monitors online/offline status, caches POS products, syncs pending sales.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  cacheProducts,
  getCachedProducts,
  savePendingSale,
  syncPendingSales,
  getPendingSaleCount,
  type OfflineProduct,
  type PendingSale,
} from "@/lib/posOfflineDB";

interface UsePOSOfflineSyncOptions {
  outletId: string | null;
  tenantId: string | null;
  autoSyncOnReconnect?: boolean;
}

export function usePOSOfflineSync({
  outletId,
  tenantId,
  autoSyncOnReconnect = true,
}: UsePOSOfflineSyncOptions) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cachedProducts, setCachedProducts] = useState<OfflineProduct[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autoSyncOnReconnect) {
        triggerSync();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [autoSyncOnReconnect, outletId]);

  // Load cached products & pending count on mount
  useEffect(() => {
    loadCachedProducts();
    refreshPendingCount();
  }, [outletId]);

  const loadCachedProducts = async () => {
    try {
      const products = await getCachedProducts();
      setCachedProducts(products);
    } catch (err) {
      console.error("Failed to load cached products:", err);
    }
  };

  const refreshPendingCount = async () => {
    try {
      const count = await getPendingSaleCount();
      setPendingCount(count);
    } catch {}
  };

  // Fetch fresh products from API and cache them
  const refreshProductCache = useCallback(async () => {
    if (!outletId || !tenantId) return;
    try {
      const res = await fetch(
        `/api/db/query?table=pos_products&outlet_id=${outletId}`,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) return;
      const { data } = await res.json();
      if (Array.isArray(data)) {
        const mapped: OfflineProduct[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          price: p.price,
          cost_price: p.cost_price ?? 0,
          unit: p.unit ?? "pcs",
          tax_rate: p.tax_rate ?? 0,
          is_stock_tracked: p.is_stock_tracked ?? false,
          image_url: p.image_url,
          is_active: p.is_active ?? true,
          category_name: p.pos_categories?.name,
          stock_qty: p.pos_stock?.[0]?.quantity,
          cached_at: Date.now(),
        }));
        await cacheProducts(mapped);
        setCachedProducts(mapped);
        setLastSync(new Date());
      }
    } catch (err) {
      console.error("Failed to refresh product cache:", err);
    }
  }, [outletId, tenantId]);

  // Save a sale offline when disconnected
  const saveOfflineSale = useCallback(
    async (sale: Omit<PendingSale, "synced">) => {
      await savePendingSale(sale);
      await refreshPendingCount();
    },
    []
  );

  // Sync pending sales to backend
  const triggerSync = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const result = await syncPendingSales(async (sale) => {
        const res = await fetch("/api/db/pos-sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outlet_id: sale.outlet_id,
            tenant_id: sale.tenant_id,
            cashier_id: sale.cashier_id,
            items: sale.items,
            subtotal: sale.subtotal,
            discount_amount: sale.discount_amount,
            tax_amount: sale.tax_amount,
            total: sale.total,
            payment_method: sale.payment_method,
            customer_id: sale.customer_id,
            customer_name: sale.customer_name,
            notes: sale.notes,
            offline_id: sale.id,
            created_at: sale.created_at,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, error: err.error || "HTTP " + res.status };
        }
        return { success: true };
      });

      await refreshPendingCount();
      setLastSync(new Date());
      return result;
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    cachedProducts,
    lastSync,
    refreshProductCache,
    saveOfflineSale,
    triggerSync,
    loadCachedProducts,
  };
}
