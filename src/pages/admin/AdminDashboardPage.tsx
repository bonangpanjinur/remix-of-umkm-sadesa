import { useState, useEffect } from 'react';
import { Store, MapPin, Bike, ShoppingBag, Receipt, Megaphone, Clock } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { StatsCard } from '@/components/admin/StatsCard';
import { ApprovalCard } from '@/components/admin/ApprovalCard';
import { fetchAdminStats, fetchPendingMerchants, fetchPendingVillages, fetchPendingCouriers, approveMerchant, rejectMerchant, approveVillage, rejectVillage, approveCourier, rejectCourier } from '@/lib/adminApi';
import type { AdminStats, Courier } from '@/types/admin';
import type { Village, Merchant } from '@/types';
import { toast } from 'sonner';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingMerchants, setPendingMerchants] = useState<Merchant[]>([]);
  const [pendingVillages, setPendingVillages] = useState<Village[]>([]);
  const [pendingCouriers, setPendingCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsData, merchants, villages, couriers] = await Promise.all([
        fetchAdminStats(),
        fetchPendingMerchants(),
        fetchPendingVillages(),
        fetchPendingCouriers(),
      ]);
      setStats(statsData);
      setPendingMerchants(merchants);
      setPendingVillages(villages);
      setPendingCouriers(couriers);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveMerchant = async (id: string) => {
    const success = await approveMerchant(id);
    if (success) {
      toast.success('Merchant berhasil disetujui');
      loadData();
    } else {
      toast.error('Gagal menyetujui merchant');
    }
  };

  const handleRejectMerchant = async (id: string, reason: string) => {
    const success = await rejectMerchant(id, reason);
    if (success) {
      toast.success('Merchant ditolak');
      loadData();
    } else {
      toast.error('Gagal menolak merchant');
    }
  };

  const handleApproveVillage = async (id: string) => {
    const success = await approveVillage(id);
    if (success) {
      toast.success('Desa wisata berhasil disetujui');
      loadData();
    } else {
      toast.error('Gagal menyetujui desa wisata');
    }
  };

  const handleRejectVillage = async (id: string, reason: string) => {
    const success = await rejectVillage(id, reason);
    if (success) {
      toast.success('Desa wisata ditolak');
      loadData();
    } else {
      toast.error('Gagal menolak desa wisata');
    }
  };

  const handleApproveCourier = async (id: string) => {
    const success = await approveCourier(id);
    if (success) {
      toast.success('Kurir berhasil disetujui');
      loadData();
    } else {
      toast.error('Gagal menyetujui kurir');
    }
  };

  const handleRejectCourier = async (id: string, reason: string) => {
    const success = await rejectCourier(id, reason);
    if (success) {
      toast.success('Kurir ditolak');
      loadData();
    } else {
      toast.error('Gagal menolak kurir');
    }
  };

  const totalPending = pendingMerchants.length + pendingVillages.length + pendingCouriers.length;

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar 
        pendingMerchants={pendingMerchants.length}
        pendingVillages={pendingVillages.length}
        pendingCouriers={pendingCouriers.length}
      />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Kelola dan pantau aktivitas aplikasi</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <StatsCard
                  title="Total Merchant"
                  value={stats?.totalMerchants || 0}
                  icon={<Store className="h-5 w-5" />}
                  description={`${stats?.pendingMerchants || 0} menunggu`}
                />
                <StatsCard
                  title="Total Desa"
                  value={stats?.totalVillages || 0}
                  icon={<MapPin className="h-5 w-5" />}
                  description={`${stats?.pendingVillages || 0} menunggu`}
                />
                <StatsCard
                  title="Total Kurir"
                  value={stats?.totalCouriers || 0}
                  icon={<Bike className="h-5 w-5" />}
                  description={`${stats?.pendingCouriers || 0} menunggu`}
                />
                <StatsCard
                  title="Total Produk"
                  value={stats?.totalProducts || 0}
                  icon={<ShoppingBag className="h-5 w-5" />}
                />
                <StatsCard
                  title="Total Pesanan"
                  value={stats?.totalOrders || 0}
                  icon={<Receipt className="h-5 w-5" />}
                />
                <StatsCard
                  title="Total Promosi"
                  value={stats?.totalPromotions || 0}
                  icon={<Megaphone className="h-5 w-5" />}
                />
              </div>

              {/* Pending Approvals */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Menunggu Persetujuan</h2>
                  {totalPending > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                      {totalPending}
                    </span>
                  )}
                </div>

                {totalPending === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <p className="text-muted-foreground">Tidak ada pendaftaran yang menunggu persetujuan</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Pending Merchants */}
                    {pendingMerchants.map((merchant) => (
                      <ApprovalCard
                        key={merchant.id}
                        type="merchant"
                        id={merchant.id}
                        name={merchant.name}
                        subtitle={merchant.businessCategory}
                        details={{
                          phone: merchant.phone,
                          location: `${merchant.district}, ${merchant.city}`,
                        }}
                        registeredAt={merchant.registeredAt}
                        onApprove={handleApproveMerchant}
                        onReject={handleRejectMerchant}
                      />
                    ))}

                    {/* Pending Villages */}
                    {pendingVillages.map((village) => (
                      <ApprovalCard
                        key={village.id}
                        type="village"
                        id={village.id}
                        name={village.name}
                        subtitle={`${village.district}, ${village.regency}`}
                        details={{
                          phone: village.contactPhone,
                          email: village.contactEmail,
                        }}
                        registeredAt={village.registeredAt}
                        onApprove={handleApproveVillage}
                        onReject={handleRejectVillage}
                      />
                    ))}

                    {/* Pending Couriers */}
                    {pendingCouriers.map((courier) => (
                      <ApprovalCard
                        key={courier.id}
                        type="courier"
                        id={courier.id}
                        name={courier.name}
                        subtitle={`${courier.vehicleType} - ${courier.vehiclePlate || 'Belum ada plat'}`}
                        details={{
                          phone: courier.phone,
                          email: courier.email,
                          location: `${courier.district}, ${courier.city}`,
                        }}
                        imageUrl={courier.photoUrl}
                        registeredAt={courier.registeredAt}
                        onApprove={handleApproveCourier}
                        onReject={handleRejectCourier}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
