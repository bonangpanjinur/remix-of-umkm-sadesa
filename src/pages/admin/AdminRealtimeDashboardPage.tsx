/**
 * FASE P4 — Super Admin Realtime Dashboard
 * - Grafik transaksi live per menit (SSE, update tiap 10 detik)
 * - Grafik per jam 24 jam terakhir
 * - User aktif saat ini
 * - Alert otomatis jika ada spike transaksi
 * - Feed pesanan terbaru real-time
 */
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatRupiah(value: number) {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  delta?: { value: number; label: string };
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={cn("p-2.5 rounded-xl", color)}>{icon}</div>
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1">
          {delta.value >= 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              delta.value >= 0 ? "text-emerald-500" : "text-destructive"
            )}
          >
            {Math.abs(delta.value)}% {delta.label}
          </span>
        </div>
      )}
    </div>
  );
}

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-orange-100 text-orange-700",
  SENT: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-teal-100 text-teal-700",
  DONE: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AdminRealtimeDashboardPage() {
  const {
    snapshot,
    hourly,
    minutely,
    alerts,
    isConnected,
    loading,
    dismissAlert,
    refresh,
  } = useAdminRealtime();

  const [activeTab, setActiveTab] = useState<"live" | "hourly">("live");

  const activeAlerts = alerts.filter((a) => !a.dismissed);

  const hourlyDelta =
    snapshot && snapshot.prevHourOrders > 0
      ? Math.round(
          ((snapshot.thisHourOrders - snapshot.prevHourOrders) /
            snapshot.prevHourOrders) *
            100
        )
      : null;

  return (
    <AdminLayout title="Dashboard Realtime" subtitle="Monitor aktivitas platform secara langsung">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Dashboard Realtime
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoring platform live — update otomatis setiap 10 detik
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border",
                isConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <Wifi className="h-3.5 w-3.5" />
                  Terhubung
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Memulai ulang...
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Spike Alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <Zap className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-800 text-sm">
                    ⚡ Spike Transaksi Terdeteksi
                  </p>
                  <p className="text-amber-700 text-sm mt-0.5">{alert.message}</p>
                  <p className="text-amber-500 text-xs mt-1">
                    {formatDistanceToNow(alert.detectedAt, {
                      addSuffix: true,
                      locale: idLocale,
                    })}
                  </p>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-5 animate-pulse"
              >
                <div className="h-4 w-24 bg-muted rounded mb-3" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Pesanan Hari Ini"
              value={snapshot?.todayOrders ?? 0}
              icon={<ShoppingBag className="h-5 w-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <StatCard
              label="Pendapatan Hari Ini"
              value={formatRupiah(snapshot?.todayRevenue ?? 0)}
              icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
              color="bg-emerald-50"
            />
            <StatCard
              label="Pesanan Jam Ini"
              value={snapshot?.thisHourOrders ?? 0}
              sub={`Jam sebelumnya: ${snapshot?.prevHourOrders ?? 0}`}
              icon={<Clock className="h-5 w-5 text-orange-600" />}
              color="bg-orange-50"
              delta={
                hourlyDelta !== null
                  ? { value: hourlyDelta, label: "vs jam lalu" }
                  : undefined
              }
            />
            <StatCard
              label="Pengguna Aktif"
              value={snapshot?.activeUsers ?? 0}
              sub="sesi aktif saat ini"
              icon={<Users className="h-5 w-5 text-violet-600" />}
              color="bg-violet-50"
            />
          </div>
        )}

        {/* Chart + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Grafik */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Grafik Transaksi Live
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab("live")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                    activeTab === "live"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  60 Menit
                </button>
                <button
                  onClick={() => setActiveTab("hourly")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                    activeTab === "hourly"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  24 Jam
                </button>
              </div>
            </div>

            {activeTab === "live" ? (
              minutely.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Belum ada data transaksi dalam 60 menit terakhir
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={minutely}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === "revenue"
                          ? [formatRupiah(v), "Pendapatan"]
                          : [v, "Pesanan"]
                      }
                      labelFormatter={(l) => `Pukul ${l}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      name="Pesanan"
                      stroke="#10b981"
                      fill="url(#colorOrders)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            ) : hourly.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Belum ada data transaksi dalam 24 jam terakhir
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      if (name === "revenue") return [formatRupiah(v), "Pendapatan"];
                      if (name === "orders") return [v, "Total Pesanan"];
                      if (name === "completed") return [v, "Selesai"];
                      if (name === "cancelled") return [v, "Dibatalkan"];
                      return [v, name];
                    }}
                    labelFormatter={(l) => `Pukul ${l}`}
                  />
                  <Legend />
                  <Bar dataKey="orders" name="Pesanan" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Selesai" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelled" name="Dibatalkan" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Feed Pesanan Terbaru */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Pesanan Terbaru (5 menit)
            </h2>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-24 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !snapshot?.recentOrders?.length ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <CheckCircle className="h-8 w-8 opacity-30" />
                <p className="text-sm">Tidak ada pesanan baru dalam 5 menit</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px] pr-2">
                <div className="space-y-3">
                  {snapshot.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRupiah(order.total)}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "text-xs shrink-0",
                          statusColors[order.status] ||
                            "bg-gray-100 text-gray-700"
                        )}
                      >
                        {order.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Spike indicator card */}
        {snapshot && (
          <div
            className={cn(
              "rounded-xl p-5 border flex items-center gap-4 transition-colors",
              snapshot.isSpike
                ? "bg-amber-50 border-amber-200"
                : "bg-card border-border"
            )}
          >
            <div
              className={cn(
                "p-3 rounded-xl",
                snapshot.isSpike ? "bg-amber-100" : "bg-muted"
              )}
            >
              <Zap
                className={cn(
                  "h-6 w-6",
                  snapshot.isSpike ? "text-amber-600" : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <p className="font-semibold">
                {snapshot.isSpike
                  ? `⚡ Spike Aktif — Rasio ${snapshot.spikeRatio.toFixed(1)}x`
                  : "Status Normal — Tidak Ada Spike"}
              </p>
              <p className="text-sm text-muted-foreground">
                {snapshot.thisHourOrders} pesanan jam ini vs{" "}
                {snapshot.prevHourOrders} jam sebelumnya
              </p>
            </div>
            {snapshot.isSpike && (
              <div className="ml-auto">
                <Badge className="bg-amber-500 text-white animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Spike Terdeteksi
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Last updated */}
        {snapshot && (
          <p className="text-xs text-muted-foreground text-center">
            Data terakhir:{" "}
            {formatDistanceToNow(new Date(snapshot.ts), {
              addSuffix: true,
              locale: idLocale,
            })}
            {" · "}Update otomatis setiap 10 detik
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
