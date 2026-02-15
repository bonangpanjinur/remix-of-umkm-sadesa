import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { BottomNav } from "@/components/layout/BottomNav";
import {
  Package, Clock, Truck, CheckCircle, XCircle, ShoppingBag,
  Store, LogIn, MapPin, Star, RefreshCw, ChevronRight, CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface BuyerOrderItem {
  id: string;
  quantity: number;
  product_name: string;
  product_price: number;
  products: { name: string; image_url: string | null } | null;
}

interface BuyerOrder {
  id: string;
  status: string;
  total: number;
  created_at: string;
  merchants: { name: string } | null;
  order_items: BuyerOrderItem[];
}

// Database-aligned status config
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  NEW: { label: "Pesanan Baru", icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_PAYMENT: { label: "Menunggu Pembayaran", icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_CONFIRMATION: { label: "Menunggu Konfirmasi", icon: Clock, color: "bg-orange-50 text-orange-700 border-orange-200" },
  CONFIRMED: { label: "Dikonfirmasi", icon: CheckCircle, color: "bg-sky-50 text-sky-700 border-sky-200" },
  PROCESSED: { label: "Sedang Diproses", icon: Package, color: "bg-blue-50 text-blue-700 border-blue-200" },
  SENT: { label: "Dalam Pengiriman", icon: Truck, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  DELIVERED: { label: "Sudah Diantar", icon: MapPin, color: "bg-violet-50 text-violet-700 border-violet-200" },
  DONE: { label: "Selesai", icon: CheckCircle, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Dibatalkan", icon: XCircle, color: "bg-red-50 text-red-700 border-red-200" },
  CANCELED: { label: "Dibatalkan", icon: XCircle, color: "bg-red-50 text-red-700 border-red-200" },
};

const PENDING_STATUSES = ["NEW", "PENDING_PAYMENT", "PENDING_CONFIRMATION"];
const PROCESSING_STATUSES = ["CONFIRMED", "PROCESSED"];
const SHIPPING_STATUSES = ["SENT", "DELIVERED"];
const DONE_STATUSES = ["DONE"];
const CANCELLED_STATUSES = ["CANCELLED", "CANCELED"];

const TAB_FILTERS = [
  { value: "all", label: "Semua", icon: ShoppingBag },
  { value: "pending", label: "Belum Bayar", icon: Clock },
  { value: "processing", label: "Diproses", icon: Package },
  { value: "shipped", label: "Dikirim", icon: Truck },
  { value: "completed", label: "Selesai", icon: CheckCircle },
  { value: "cancelled", label: "Dibatalkan", icon: XCircle },
];

const getStatusGroup = (status: string): string => {
  if (PENDING_STATUSES.includes(status)) return "pending";
  if (PROCESSING_STATUSES.includes(status)) return "processing";
  if (SHIPPING_STATUSES.includes(status)) return "shipped";
  if (DONE_STATUSES.includes(status)) return "completed";
  if (CANCELLED_STATUSES.includes(status)) return "cancelled";
  return "all";
};

const OrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (!user) { setLoading(false); return; }
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, created_at, merchants(name), order_items(id, quantity, product_name, product_price, products(name, image_url))")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders((data as unknown as BuyerOrder[]) || []);
    } catch (e) {
      console.error("Error fetching buyer orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") return true;
    return getStatusGroup(order.status) === activeTab;
  });

  const getTabCount = (tabValue: string) => {
    if (tabValue === "all") return orders.length;
    return orders.filter((order) => getStatusGroup(order.status) === tabValue).length;
  };

  const activeOrderCount = orders.filter(o => !["DONE", "CANCELLED", "CANCELED"].includes(o.status)).length;

  // Not logged in state
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-primary px-5 pt-12 pb-8">
          <h1 className="text-xl font-bold text-primary-foreground">Pesanan Saya</h1>
        </div>
        <div className="container max-w-md mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <LogIn className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Belum Login</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">
            Silakan login untuk melihat dan melacak pesanan Anda
          </p>
          <Button onClick={() => navigate("/auth")} className="rounded-full px-8">
            <LogIn className="w-4 h-4 mr-2" /> Login Sekarang
          </Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-primary-foreground">Pesanan Saya</h1>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-primary-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        {activeOrderCount > 0 && (
          <p className="text-primary-foreground/80 text-sm">
            {activeOrderCount} pesanan aktif
          </p>
        )}
      </div>

      <div className="container max-w-md mx-auto px-4 -mt-3">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <div className="bg-card rounded-xl shadow-sm p-1.5 mb-4">
            <TabsList className="w-full justify-start overflow-x-auto bg-transparent h-auto p-0 gap-1 no-scrollbar">
              {TAB_FILTERS.map((tab) => {
                const count = getTabCount(tab.value);
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg border-0 bg-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-2 h-auto flex-shrink-0 text-xs font-medium gap-1.5 transition-all"
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-current/10 text-[10px] font-bold flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Orders list */}
          <div className="space-y-3 min-h-[50vh]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-4 border-b flex justify-between items-center">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <div className="p-4 flex gap-4">
                      <Skeleton className="w-20 h-20 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-5 w-1/3 mt-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const firstItem = order.order_items?.[0];
                const imageUrl = firstItem?.products?.image_url;
                const productName = firstItem?.products?.name || firstItem?.product_name || "Produk";
                const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.NEW;
                const StatusIcon = statusConf.icon;
                const formattedDate = format(new Date(order.created_at), "dd MMM yyyy", { locale: idLocale });
                const shortId = order.id.substring(0, 8).toUpperCase();

                return (
                  <Card
                    key={order.id}
                    className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                    onClick={() => navigate(`/orders/${order.id}/tracking`)}
                  >
                    <CardContent className="p-0">
                      {/* Card header */}
                      <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                            <CalendarDays className="w-3 h-3" />
                            <span>{formattedDate}</span>
                            <span className="text-border">•</span>
                            <span className="font-mono">#{shortId}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Store className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium truncate max-w-[160px]">{order.merchants?.name || "Toko"}</span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${statusConf.color} border px-2.5 py-1 text-[11px] font-medium gap-1 flex-shrink-0`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConf.label}
                        </Badge>
                      </div>

                      {/* Product info */}
                      <div className="p-4 flex gap-4">
                        <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                          {imageUrl ? (
                            <img src={imageUrl} alt={productName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <ShoppingBag className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <h4 className="font-medium text-sm truncate text-foreground">{productName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.order_items.length > 1
                                ? `+${order.order_items.length - 1} produk lainnya`
                                : `${firstItem?.quantity || 1} barang`}
                            </p>
                          </div>
                          <div className="flex items-end justify-between mt-2">
                            <div>
                              <p className="text-[11px] text-muted-foreground">Total Belanja</p>
                              <p className="text-sm font-bold text-primary">{formatPrice(order.total)}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>

                      {/* Contextual actions */}
                      {(PENDING_STATUSES.includes(order.status) || SHIPPING_STATUSES.includes(order.status) || order.status === "DONE" || CANCELLED_STATUSES.includes(order.status)) && (
                        <div className="px-4 py-3 border-t border-border/50 bg-muted/30 flex justify-end gap-2">
                          {PENDING_STATUSES.includes(order.status) && (
                            <Button
                              size="sm"
                              className="text-xs h-8 rounded-full px-4"
                              onClick={(e) => { e.stopPropagation(); navigate(`/payment/${order.id}`); }}
                            >
                              Bayar Sekarang
                            </Button>
                          )}
                          {SHIPPING_STATUSES.includes(order.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 rounded-full px-4"
                              onClick={(e) => { e.stopPropagation(); navigate(`/orders/${order.id}/tracking`); }}
                            >
                              <MapPin className="w-3 h-3 mr-1" /> Lacak Pesanan
                            </Button>
                          )}
                          {order.status === "DONE" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 rounded-full px-4"
                                onClick={(e) => { e.stopPropagation(); navigate(`/orders/${order.id}/tracking`); }}
                              >
                                <Star className="w-3 h-3 mr-1" /> Beri Ulasan
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-8 rounded-full px-4"
                                onClick={(e) => { e.stopPropagation(); navigate("/explore"); }}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Pesan Lagi
                              </Button>
                            </>
                          )}
                          {CANCELLED_STATUSES.includes(order.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-8 rounded-full px-4"
                              onClick={(e) => { e.stopPropagation(); navigate("/explore"); }}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Pesan Lagi
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-5">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Belum ada pesanan</h3>
                <p className="text-muted-foreground text-sm max-w-[220px] mb-6">
                  {activeTab === "all"
                    ? "Yuk mulai belanja dan temukan produk terbaik!"
                    : `Tidak ada pesanan dengan status "${TAB_FILTERS.find(t => t.value === activeTab)?.label || activeTab}"`}
                </p>
                <Button className="rounded-full px-6" onClick={() => navigate("/explore")}>
                  <ShoppingBag className="w-4 h-4 mr-2" /> Mulai Belanja
                </Button>
              </div>
            )}
          </div>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default OrdersPage;
