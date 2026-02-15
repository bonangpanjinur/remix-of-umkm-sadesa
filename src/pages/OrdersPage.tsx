import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { Package, Clock, Truck, CheckCircle, XCircle, ShoppingBag, Store, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

const OrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
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
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "confirmed": case "processing": return "bg-blue-100 text-blue-800";
      case "shipped": case "ready_for_pickup": case "out_for_delivery": return "bg-indigo-100 text-indigo-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": case "returned": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: "Menunggu Pembayaran", confirmed: "Dikonfirmasi", processing: "Sedang Diproses",
      shipped: "Dalam Pengiriman", out_for_delivery: "Kurir Menuju Lokasi", ready_for_pickup: "Siap Diambil",
      completed: "Selesai", cancelled: "Dibatalkan", returned: "Dikembalikan",
    };
    return map[status] || status;
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return order.status === "pending";
    if (activeTab === "processing") return ["processing", "confirmed"].includes(order.status);
    if (activeTab === "shipped") return ["shipped", "ready_for_pickup", "out_for_delivery"].includes(order.status);
    if (activeTab === "completed") return order.status === "completed";
    if (activeTab === "cancelled") return ["cancelled", "returned"].includes(order.status);
    return order.status === activeTab;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <PageHeader title="Pesanan Saya" showBack={false} />
        <div className="container max-w-md mx-auto p-4 pt-20 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <LogIn className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">Belum Login</h3>
          <p className="text-sm text-muted-foreground mb-6">Silakan login untuk melihat pesanan Anda</p>
          <Button onClick={() => navigate("/auth")}>Login Sekarang</Button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Pesanan Saya" showBack={false} />
      <div className="container max-w-md mx-auto p-4 pt-20">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto bg-transparent h-auto p-0 mb-4 gap-2 no-scrollbar">
            {[
              { value: "all", label: "Semua" },
              { value: "pending", label: "Belum Bayar", icon: Clock },
              { value: "processing", label: "Diproses", icon: Package },
              { value: "shipped", label: "Dikirim", icon: Truck },
              { value: "completed", label: "Selesai", icon: CheckCircle },
              { value: "cancelled", label: "Dibatalkan", icon: XCircle },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0">
                {tab.icon && <tab.icon className="w-3 h-3 mr-1.5" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="space-y-4 min-h-[50vh]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-none shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3 border-b flex justify-between items-center"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-24 rounded-full" /></div>
                    <div className="p-3 flex gap-3"><Skeleton className="w-16 h-16 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-4 w-1/3" /></div></div>
                  </CardContent>
                </Card>
              ))
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const firstItem = order.order_items?.[0];
                const imageUrl = firstItem?.products?.image_url;
                const productName = firstItem?.products?.name || firstItem?.product_name || "Produk";
                return (
                  <Card key={order.id} className="overflow-hidden border-none shadow-sm cursor-pointer active:scale-[0.99] transition-transform" onClick={() => navigate(`/order-tracking/${order.id}`)}>
                    <CardContent className="p-0">
                      <div className="p-3 border-b flex justify-between items-center bg-white">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Store className="w-4 h-4" />
                          <span className="font-medium truncate max-w-[150px]">{order.merchants?.name || "Toko"}</span>
                        </div>
                        <Badge variant="outline" className={`${getStatusColor(order.status)} border-0 px-2 py-0.5 text-xs`}>{getStatusLabel(order.status)}</Badge>
                      </div>
                      <div className="p-3 flex gap-3 bg-white">
                        <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                          {imageUrl ? <img src={imageUrl} alt={productName} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><ShoppingBag className="w-8 h-8" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{productName}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.order_items.length > 1 ? `+ ${order.order_items.length - 1} produk lainnya` : `${firstItem?.quantity || 1} barang`}
                          </p>
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">Total Belanja</p>
                            <p className="text-sm font-bold text-primary">{formatPrice(order.total)}</p>
                          </div>
                        </div>
                      </div>
                      {order.status === "pending" && (
                        <div className="p-3 border-t bg-gray-50 flex justify-end">
                          <Button size="sm" className="text-xs h-8" onClick={(e) => { e.stopPropagation(); navigate(`/payment/${order.id}`); }}>Bayar Sekarang</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-gray-100 p-4 rounded-full mb-4"><ShoppingBag className="w-10 h-10 text-gray-400" /></div>
                <h3 className="text-lg font-medium mb-1">Belum ada pesanan</h3>
                <p className="text-muted-foreground text-sm max-w-[200px]">
                  {activeTab === "all" ? "Kamu belum pernah membuat pesanan apapun" : `Tidak ada pesanan "${getStatusLabel(activeTab)}"`}
                </p>
                <Button className="mt-6" variant="outline" onClick={() => navigate("/explore")}>Mulai Belanja</Button>
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
