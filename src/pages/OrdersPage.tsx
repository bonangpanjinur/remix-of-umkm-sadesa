import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { formatCurrency } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import BottomNav from "@/components/layout/BottomNav";
import { Package, Clock, Truck, CheckCircle, XCircle, ShoppingBag, ChevronRight, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const OrdersPage = () => {
  const { orders, loading } = useRealtimeOrders();
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "confirmed":
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "shipped":
      case "ready_for_pickup":
      case "out_for_delivery":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
      case "returned":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Menunggu Pembayaran";
      case "confirmed":
        return "Dikonfirmasi";
      case "processing":
        return "Sedang Diproses";
      case "shipped":
        return "Dalam Pengiriman";
      case "out_for_delivery":
        return "Kurir Menuju Lokasi";
      case "ready_for_pickup":
        return "Siap Diambil";
      case "completed":
        return "Selesai";
      case "cancelled":
        return "Dibatalkan";
      case "returned":
        return "Dikembalikan";
      default:
        return status;
    }
  };

  // Filter orders based on active tab with IMPROVED grouping logic
  const filteredOrders = orders?.filter((order) => {
    if (activeTab === "all") return true;
    
    // Grouping status logic to match BottomNav count
    if (activeTab === "pending") {
      return order.status === "pending";
    }
    
    if (activeTab === "processing") {
      // Include both 'processing' and 'confirmed' in this tab
      return ["processing", "confirmed"].includes(order.status);
    }
    
    if (activeTab === "shipped") {
      // Include all shipping related statuses
      return ["shipped", "ready_for_pickup", "out_for_delivery"].includes(order.status);
    }
    
    if (activeTab === "completed") {
      return order.status === "completed";
    }
    
    if (activeTab === "cancelled") {
      return ["cancelled", "returned"].includes(order.status);
    }
    
    return order.status === activeTab;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Pesanan Saya" showBack={false} />
      
      <div className="container max-w-md mx-auto p-4 pt-20">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto bg-transparent h-auto p-0 mb-4 gap-2 no-scrollbar">
            <TabsTrigger 
              value="all" 
              className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0"
            >
              Semua
            </TabsTrigger>
            <TabsTrigger 
              value="pending" 
              className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0"
            >
              <Clock className="w-3 h-3 mr-1.5" />
              Belum Bayar
            </TabsTrigger>
            <TabsTrigger 
              value="processing" 
              className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0"
            >
              <Package className="w-3 h-3 mr-1.5" />
              Diproses
            </TabsTrigger>
            <TabsTrigger 
              value="shipped" 
              className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0"
            >
              <Truck className="w-3 h-3 mr-1.5" />
              Dikirim
            </TabsTrigger>
            <TabsTrigger 
              value="completed" 
              className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0"
            >
              <CheckCircle className="w-3 h-3 mr-1.5" />
              Selesai
            </TabsTrigger>
            <TabsTrigger 
              value="cancelled" 
              className="rounded-full border bg-white data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 h-auto flex-shrink-0"
            >
              <XCircle className="w-3 h-3 mr-1.5" />
              Dibatalkan
            </TabsTrigger>
          </TabsList>

          <div className="space-y-4 min-h-[50vh]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-gray-500 text-sm">Memuat pesanan...</p>
              </div>
            ) : filteredOrders && filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className="overflow-hidden border-none shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(`/order-tracking/${order.id}`)}
                >
                  <CardContent className="p-0">
                    {/* Header Card */}
                    <div className="p-3 border-b flex justify-between items-center bg-white">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Store className="w-4 h-4" />
                        <span className="font-medium truncate max-w-[150px]">
                          {order.merchant?.name || "Toko Warung Raya"}
                        </span>
                      </div>
                      <Badge variant="outline" className={`${getStatusColor(order.status)} border-0 px-2 py-0.5 text-xs`}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>

                    {/* Body Card */}
                    <div className="p-3 flex gap-3 bg-white">
                      <div className="w-16 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden">
                        {order.items && order.items.length > 0 && order.items[0].product?.image_url ? (
                          <img 
                            src={order.items[0].product.image_url} 
                            alt={order.items[0].product.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <ShoppingBag className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {order.items && order.items.length > 0 
                            ? order.items[0].product?.name 
                            : "Produk tidak tersedia"}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {order.items && order.items.length > 1 
                            ? `+ ${order.items.length - 1} produk lainnya` 
                            : `${order.items?.[0]?.quantity || 1} barang`}
                        </p>
                        <div className="flex justify-between items-end mt-2">
                          <div>
                            <p className="text-xs text-gray-500">Total Belanja</p>
                            <p className="text-sm font-bold text-primary">
                              {formatCurrency(order.total_amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Card - Actions */}
                    {order.status === "pending" && (
                      <div className="p-3 border-t bg-gray-50 flex justify-end">
                        <Button 
                          size="sm" 
                          className="bg-primary text-white hover:bg-primary/90 text-xs h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/payment/${order.id}`);
                          }}
                        >
                          Bayar Sekarang
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                  <ShoppingBag className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  Belum ada pesanan
                </h3>
                <p className="text-gray-500 text-sm max-w-[200px]">
                  {activeTab === "all" 
                    ? "Kamu belum pernah membuat pesanan apapun" 
                    : `Tidak ada pesanan dengan status "${getStatusLabel(activeTab)}"`}
                </p>
                <Button 
                  className="mt-6" 
                  variant="outline"
                  onClick={() => navigate('/explore')}
                >
                  Mulai Belanja
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
