import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, ShoppingBag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useQROrderNotifications, type QRIncomingOrder } from "@/hooks/useQROrderNotifications";
import { usePOS } from "@/contexts/POSContext";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function OrderCard({
  order,
  onRead,
  onDismiss,
}: {
  order: QRIncomingOrder;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "relative p-3 rounded-lg border text-sm transition-colors",
        order.read
          ? "border-border bg-background"
          : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
      )}
    >
      {!order.read && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
      )}
      <div className="flex items-start justify-between gap-2 pr-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-emerald-700 truncate">
              {order.order_number}
            </span>
          </div>
          <p className="font-medium truncate">{order.table_name}</p>
          <p className="text-muted-foreground text-xs truncate">
            {order.customer_name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(order.created_at)}
          </span>
          <span className="font-semibold text-xs text-emerald-700">
            {formatRupiah(order.subtotal)}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-0.5">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate mr-2">
              {item.qty}× {item.product_name}
              {item.notes ? <em className="ml-1">({item.notes})</em> : null}
            </span>
            <span className="shrink-0">{formatRupiah(item.subtotal)}</span>
          </div>
        ))}
        {order.notes && (
          <p className="text-xs italic text-amber-600 mt-1">Catatan: {order.notes}</p>
        )}
      </div>

      <div className="flex gap-2 mt-2">
        {!order.read && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={() => onRead(order.order_id)}
          >
            Tandai Dibaca
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => onDismiss(order.order_id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function QROrderNotificationBell() {
  const { tenant } = usePOS();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { orders, unreadCount, markAllRead, markRead, dismissOrder, clearAll } =
    useQROrderNotifications(tenant?.id);

  // Tutup panel kalau klik di luar
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={handleOpen}
        title="Notifikasi Pesanan QR"
      >
        <Bell className={cn("h-4 w-4", unreadCount > 0 && "text-emerald-600")} />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-red-500 hover:bg-red-500 border-0 flex items-center justify-center"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-background shadow-xl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-sm">Pesanan QR Masuk</span>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">
                  {unreadCount} baru
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground gap-1"
                  onClick={markAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Baca Semua
                </Button>
              )}
              {orders.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearAll}
                >
                  Hapus
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-[420px]">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Belum ada pesanan QR masuk</p>
                <p className="text-xs opacity-70">Pesanan dari pelanggan akan muncul di sini</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {orders.map((order) => (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    onRead={markRead}
                    onDismiss={dismissOrder}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
