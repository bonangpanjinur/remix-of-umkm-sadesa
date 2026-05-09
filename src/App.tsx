import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useRestockNotification } from "@/hooks/useRestockNotification";
import { WhitelabelProvider } from "@/contexts/WhitelabelContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { SEO } from "@/components/SEO";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { POSProvider } from "./contexts/POSContext";

// Lazy-load semua halaman agar bundle awal kecil (P2-02)
// Pages
const Index = lazy(() => import("./pages/Index"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const TourismPage = lazy(() => import("./pages/TourismPage"));
const TourismDetail = lazy(() => import("./pages/TourismDetail"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PaymentConfirmationPage = lazy(() => import("./pages/PaymentConfirmationPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SavedAddressesPage = lazy(() => import("./pages/SavedAddressesPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const RegisterVillagePage = lazy(() => import("./pages/RegisterVillagePage"));
const RegisterMerchantPage = lazy(() => import("./pages/RegisterMerchantPage"));
const RegisterCourierPage = lazy(() => import("./pages/RegisterCourierPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CourierDashboardPage = lazy(() => import("./pages/CourierDashboardPage"));
const CourierEarningsPage = lazy(() => import("./pages/courier/CourierEarningsPage"));
const CourierDepositPage = lazy(() => import("./pages/courier/CourierDepositPage"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const UnauthorizedPage = lazy(() => import("./pages/UnauthorizedPage"));
const VillageDetailPage = lazy(() => import("./pages/VillageDetailPage"));
const MerchantSlugResolver = lazy(() => import("./pages/MerchantSlugResolver"));
const ShopsPage = lazy(() => import("./pages/ShopsPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const EmailConfirmationPage = lazy(() => import("./pages/EmailConfirmationPage"));
const RecentlyViewedPage = lazy(() => import("./pages/buyer/RecentlyViewedPage"));
const AdminSystemHealthPage = lazy(() => import("./pages/admin/AdminSystemHealthPage"));

// Admin Pages
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminMerchantDetailPage = lazy(() => import("./pages/admin/AdminMerchantDetailPage"));
const AdminMerchantsPage = lazy(() => import("./pages/admin/AdminMerchantsPage"));
const AdminVillagesPage = lazy(() => import("./pages/admin/AdminVillagesPage"));
const AdminVillageDetailPage = lazy(() => import("./pages/admin/AdminVillageDetailPage"));
const AdminCouriersPage = lazy(() => import("./pages/admin/AdminCouriersPage"));
const AdminPromotionsPage = lazy(() => import("./pages/admin/AdminPromotionsPage"));
const AdminCodesPage = lazy(() => import("./pages/admin/AdminCodesPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));
const AdminLogsPage = lazy(() => import("./pages/admin/AdminLogsPage"));
const AdminWithdrawalsPage = lazy(() => import("./pages/admin/AdminWithdrawalsPage"));
const AdminHalalManagementPage = lazy(() => import("./pages/admin/AdminHalalManagementPage"));
const AdminHalalRegulationPage = lazy(() => import("./pages/admin/AdminHalalRegulationPage"));
const AdminTransactionQuotaPage = lazy(() => import("./pages/admin/AdminTransactionQuotaPage"));
const AdminVerifikatorCommissionsPage = lazy(() => import("./pages/admin/AdminVerifikatorCommissionsPage"));
const AdminFinancePage = lazy(() => import("./pages/admin/AdminFinancePage"));
const AdminBannersPage = lazy(() => import("./pages/admin/AdminBannersPage"));
const AdminBroadcastPage = lazy(() => import("./pages/admin/AdminBroadcastPage"));
const AdminRolesPage = lazy(() => import("./pages/admin/AdminRolesPage"));
const AdminBackupPage = lazy(() => import("./pages/admin/AdminBackupPage"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminVerifikatorWithdrawalsPage = lazy(() => import("./pages/admin/AdminVerifikatorWithdrawalsPage"));
const AdminPOSPage = lazy(() => import("./pages/admin/AdminPOSPage"));
const AdminRidesPage = lazy(() => import("./pages/admin/AdminRidesPage"));
const AdminKomisiPage = lazy(() => import("./pages/admin/AdminKomisiPage"));
const AdminAuditLogPage = lazy(() => import("./pages/admin/AdminAuditLogPage"));
const AdminWhatsAppPage = lazy(() => import("./pages/admin/AdminWhatsAppPage"));
const AdminApiKeysPage = lazy(() => import("./pages/admin/AdminApiKeysPage"));
const AdminPushNotificationPage = lazy(() => import("./pages/admin/AdminPushNotificationPage"));
const AdminCashbackPage = lazy(() => import("./pages/admin/AdminCashbackPage"));
const AdminIklanPage = lazy(() => import("./pages/admin/AdminIklanPage"));
const AdminRealtimeDashboardPage = lazy(() => import("./pages/admin/AdminRealtimeDashboardPage"));
const AdminSupportTicketsPage = lazy(() => import("./pages/admin/AdminSupportTicketsPage"));
const AdminSEOPage = lazy(() => import("./pages/admin/AdminSEOPage"));
const BuyerSupportPage = lazy(() => import("./pages/buyer/BuyerSupportPage"));

// Courier Pages
const CourierHistoryPage = lazy(() => import("./pages/courier/CourierHistoryPage"));
const CourierWithdrawalPage = lazy(() => import("./pages/courier/CourierWithdrawalPage"));
const CourierChatPage = lazy(() => import("./pages/courier/CourierChatPage"));
const CourierRidesPage = lazy(() => import("./pages/courier/CourierRidesPage"));
const CourierPerformaPage = lazy(() => import("./pages/courier/CourierPerformaPage"));
const CourierSlipPage = lazy(() => import("./pages/courier/CourierSlipPage"));

// Ride Pages
const RideBookingPage = lazy(() => import("./pages/ride/RideBookingPage"));
const RideTrackingPage = lazy(() => import("./pages/ride/RideTrackingPage"));
const RideHistoryPage = lazy(() => import("./pages/ride/RideHistoryPage"));

// Verifikator Pages
const VerifikatorDashboardPage = lazy(() => import("./pages/verifikator/VerifikatorDashboardPage"));
const VerifikatorMerchantsPage = lazy(() => import("./pages/verifikator/VerifikatorMerchantsPage"));
const VerifikatorEarningsPage = lazy(() => import("./pages/verifikator/VerifikatorEarningsPage"));
const VerifikatorKasReportPage = lazy(() => import("./pages/verifikator/VerifikatorKasReportPage"));
const VerifikatorEkonomiPage = lazy(() => import("./pages/verifikator/VerifikatorEkonomiPage"));
const VerifikatorEventPage = lazy(() => import("./pages/verifikator/VerifikatorEventPage"));

// Merchant Pages
const MerchantDashboardPage = lazy(() => import("./pages/merchant/MerchantDashboardPage"));
const MerchantProductsPage = lazy(() => import("./pages/merchant/MerchantProductsPage"));
const MerchantProductDetailPage = lazy(() => import("./pages/merchant/MerchantProductDetailPage"));
const MerchantOrdersPage = lazy(() => import("./pages/merchant/MerchantOrdersPage"));
const MerchantSettingsPage = lazy(() => import("./pages/merchant/MerchantSettingsPage"));
const MerchantAnalyticsPage = lazy(() => import("./pages/merchant/MerchantAnalyticsPage"));
const MerchantReviewsPage = lazy(() => import("./pages/merchant/MerchantReviewsPage"));
const MerchantPromoPage = lazy(() => import("./pages/merchant/MerchantPromoPage"));
const MerchantWithdrawalPage = lazy(() => import("./pages/merchant/MerchantWithdrawalPage"));
const MerchantSubscriptionPage = lazy(() => import("./pages/merchant/MerchantSubscriptionPage"));
const MerchantFlashSalePage = lazy(() => import("./pages/merchant/MerchantFlashSalePage"));
const MerchantVouchersPage = lazy(() => import("./pages/merchant/MerchantVouchersPage"));
const MerchantScheduledPromoPage = lazy(() => import("./pages/merchant/MerchantScheduledPromoPage"));
const MerchantVisitorStatsPage = lazy(() => import("./pages/merchant/MerchantVisitorStatsPage"));
const MerchantChatPage = lazy(() => import("./pages/merchant/MerchantChatPage"));
const MerchantRefundsPage = lazy(() => import("./pages/merchant/MerchantRefundsPage"));
const MerchantPOSPage = lazy(() => import("./pages/merchant/MerchantPOSPage"));
const MerchantPOSSubscribePage = lazy(() => import("./pages/merchant/MerchantPOSSubscribePage"));
const MerchantPOSSettingsPage = lazy(() => import("./pages/merchant/MerchantPOSSettingsPage"));
const MerchantDuesPage = lazy(() => import("./pages/merchant/MerchantDuesPage"));
const MerchantNotifikasiWAPage = lazy(() => import("./pages/merchant/MerchantNotifikasiWAPage"));
const MerchantImportExportPage = lazy(() => import("./pages/merchant/MerchantImportExportPage"));
const MerchantInsightPage = lazy(() => import("./pages/merchant/MerchantInsightPage"));
const MerchantIklanPage = lazy(() => import("./pages/merchant/MerchantIklanPage"));
const MerchantGalleryPage = lazy(() => import("./pages/merchant/MerchantGalleryPage"));
const MerchantFinancePage = lazy(() => import("./pages/merchant/MerchantFinancePage"));
const MerchantStockPage = lazy(() => import("./pages/merchant/MerchantStockPage"));
const MerchantBundlePage = lazy(() => import("./pages/merchant/MerchantBundlePage"));
const MerchantPreOrderPage = lazy(() => import("./pages/merchant/MerchantPreOrderPage"));
const MerchantGrosirPage = lazy(() => import("./pages/merchant/MerchantGrosirPage"));
const MerchantPajakPage = lazy(() => import("./pages/merchant/MerchantPajakPage"));
const DesaDonasiPage = lazy(() => import("./pages/desa/DesaDonasiPage"));

// POS SaaS Pages
const POSSetupPage = lazy(() => import("./pages/pos/POSSetupPage"));
const POSDashboardPage = lazy(() => import("./pages/pos/POSDashboardPage"));
const POSKasirPage = lazy(() => import("./pages/pos/POSKasirPage"));
const POSTransaksiPage = lazy(() => import("./pages/pos/POSTransaksiPage"));
const POSProdukPage = lazy(() => import("./pages/pos/POSProdukPage"));
const POSKategoriPage = lazy(() => import("./pages/pos/POSKategoriPage"));
const POSCustomerPage = lazy(() => import("./pages/pos/POSCustomerPage"));
const POSSupplierPage = lazy(() => import("./pages/pos/POSSupplierPage"));
const POSStokPage = lazy(() => import("./pages/pos/POSStokPage"));
const POSLaporanPage = lazy(() => import("./pages/pos/POSLaporanPage"));
const POSPenggunaPage = lazy(() => import("./pages/pos/POSPenggunaPage"));
const POSPengaturanPage = lazy(() => import("./pages/pos/POSPengaturanPage"));
const POSReturPage = lazy(() => import("./pages/pos/POSReturPage"));
const POSPembelianPage = lazy(() => import("./pages/pos/POSPembelianPage"));
const POSKasPage = lazy(() => import("./pages/pos/POSKasPage"));
const POSLaporanLabaRugiPage = lazy(() => import("./pages/pos/POSLaporanLabaRugiPage"));
const POSLaporanKasirPage = lazy(() => import("./pages/pos/POSLaporanKasirPage"));
const POSLaporanStokPage = lazy(() => import("./pages/pos/POSLaporanStokPage"));
const POSLaporanCashflowPage = lazy(() => import("./pages/pos/POSLaporanCashflowPage"));
const POSAnalitikPage = lazy(() => import("./pages/pos/POSAnalitikPage"));
const POSAnalitikProdukPage = lazy(() => import("./pages/pos/POSAnalitikProdukPage"));
const POSKioskPage = lazy(() => import("./pages/pos/POSKioskPage"));
const POSAkuntansiPage = lazy(() => import("./pages/pos/POSAkuntansiPage"));
const POSTransferStokPage = lazy(() => import("./pages/pos/POSTransferStokPage"));
const POSLaporanOutletPage = lazy(() => import("./pages/pos/POSLaporanOutletPage"));
const POSAuditPage = lazy(() => import("./pages/pos/POSAuditPage"));
const POSAksesPage = lazy(() => import("./pages/pos/POSAksesPage"));
const POSPromosiPage = lazy(() => import("./pages/pos/POSPromosiPage"));
const POSLoyaltyPage = lazy(() => import("./pages/pos/POSLoyaltyPage"));
const POSIntegrasiPage = lazy(() => import("./pages/pos/POSIntegrasiPage"));
const POSBahanBakuPage = lazy(() => import("./pages/pos/POSBahanBakuPage"));
const POSResepPage = lazy(() => import("./pages/pos/POSResepPage"));
const POSMejaPage = lazy(() => import("./pages/pos/POSMejaPage"));
const POSKDSPage = lazy(() => import("./pages/pos/POSKDSPage"));
const POSJadwalPage = lazy(() => import("./pages/pos/POSJadwalPage"));
const POSAbsensiPage = lazy(() => import("./pages/pos/POSAbsensiPage"));
const POSPenggajianPage = lazy(() => import("./pages/pos/POSPenggajianPage"));
const POSHutangPiutangPage = lazy(() => import("./pages/pos/POSHutangPiutangPage"));
const POSTargetOmzetPage = lazy(() => import("./pages/pos/POSTargetOmzetPage"));
const POSHargaPage = lazy(() => import("./pages/pos/POSHargaPage"));

// Desa Pages
const DesaDashboardPage = lazy(() => import("./pages/desa/DesaDashboardPage"));
const DesaMerchantPage = lazy(() => import("./pages/desa/DesaMerchantPage"));
const DesaTourismPage = lazy(() => import("./pages/desa/DesaTourismPage"));
const DesaEkonomiPage = lazy(() => import("./pages/desa/DesaEkonomiPage"));
const DesaEventPage = lazy(() => import("./pages/desa/DesaEventPage"));
const DesaKeanggotaanPage = lazy(() => import("./pages/desa/DesaKeanggotaanPage"));
const DesaBroadcastPage = lazy(() => import("./pages/desa/DesaBroadcastPage"));
const DesaPetaPage = lazy(() => import("./pages/desa/DesaPetaPage"));
const DesaLaporanWisataPage = lazy(() => import("./pages/desa/DesaLaporanWisataPage"));
// P3: Admin Desa & Ekosistem Wisata
const DesaProfilPage = lazy(() => import("./pages/desa/DesaProfilPage"));
const DesaPaketWisataPage = lazy(() => import("./pages/desa/DesaPaketWisataPage"));
const DesaPemanduPage = lazy(() => import("./pages/desa/DesaPemanduPage"));
const DesaLaporanKeuanganPage = lazy(() => import("./pages/desa/DesaLaporanKeuanganPage"));

// P3: Buyer Tourism Booking
const TourismBookingPage = lazy(() => import("./pages/buyer/TourismBookingPage"));

// Buyer Pages
const CashbackPage = lazy(() => import("./pages/buyer/CashbackPage"));
const ReferralPage = lazy(() => import("./pages/buyer/ReferralPage"));
const SubscriptionPage = lazy(() => import("./pages/buyer/SubscriptionPage"));
const ReviewsPage = lazy(() => import("./pages/buyer/ReviewsPage"));
const WishlistPage = lazy(() => import("./pages/buyer/WishlistPage"));
const MyReviewsPage = lazy(() => import("./pages/buyer/MyReviewsPage"));
const BuyerChatPage = lazy(() => import("./pages/buyer/BuyerChatPage"));
const FlashSalePage = lazy(() => import("./pages/buyer/FlashSalePage"));
const ProductComparePage = lazy(() => import("./pages/buyer/ProductComparePage"));
const LoyaltyPage = lazy(() => import("./pages/buyer/LoyaltyPage"));
const VoucherPage = lazy(() => import("./pages/buyer/VoucherPage"));
const RekomendasisPage = lazy(() => import("./pages/buyer/RekomendasisPage"));
const DisputePage = lazy(() => import("./pages/buyer/DisputePage"));
const InvoicePage = lazy(() => import("./pages/InvoicePage"));

// Notifications
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

// QueryClient dengan konfigurasi cache optimal (P3-02)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Fallback loading saat lazy load
const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
  </div>
);

// Handle 404 redirect from hosting fallback
function RedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirectPath = params.get('redirect');
    if (redirectPath) {
      navigate(decodeURIComponent(redirectPath), { replace: true });
    }
  }, [location.search, navigate]);
  
  return null;
}

// S3-05: Restok wishlist notification (inside auth context)
function RestockNotificationHandler() {
  useRestockNotification();
  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WhitelabelProvider>
            <POSProvider>
            <CartProvider>
              <Toaster />
              <Sonner />
              <OfflineIndicator />
              <RestockNotificationHandler />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <RedirectHandler />
                <SEO />
                <InstallBanner />
                <UpdatePrompt />
              <Suspense fallback={<PageLoading />}>
              <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/tourism" element={<TourismPage />} />
              <Route path="/tourism/:id" element={<TourismDetail />} />
              <Route path="/tourism/booking/:packageId" element={
                <ProtectedRoute>
                  <TourismBookingPage />
                </ProtectedRoute>
              } />
              <Route path="/village/:id" element={<VillageDetailPage />} />
              <Route path="/merchant/:slugOrId" element={<MerchantSlugResolver />} />
              <Route path="/shops" element={<ShopsPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/auth" element={<AuthPage />} />
              {/* T-04: Redirect alias URL login yang umum */}
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/auth/login" element={<Navigate to="/auth" replace />} />
              <Route path="/masuk" element={<Navigate to="/auth" replace />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/register" element={
                <ProtectedRoute>
                  <RegisterPage />
                </ProtectedRoute>
              } />
              <Route path="/register/village" element={
                <ProtectedRoute>
                  <RegisterVillagePage />
                </ProtectedRoute>
              } />
              <Route path="/register/merchant" element={
                <ProtectedRoute>
                  <RegisterMerchantPage />
                </ProtectedRoute>
              } />
              <Route path="/register/courier" element={
                <ProtectedRoute>
                  <RegisterCourierPage />
                </ProtectedRoute>
              } />
              <Route path="/install" element={<InstallPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/email-confirmation" element={<EmailConfirmationPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected buyer routes */}
              <Route path="/cart" element={
                <ProtectedRoute>
                  <CartPage />
                </ProtectedRoute>
              } />
              <Route path="/checkout" element={
                <ProtectedRoute>
                  <CheckoutPage />
              </ProtectedRoute>
              } />
              <Route path="/payment/:orderId" element={
                <ProtectedRoute>
                  <PaymentConfirmationPage />
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              } />
              <Route path="/orders/:orderId/tracking" element={
                <ProtectedRoute>
                  <OrderTrackingPage />
                </ProtectedRoute>
              } />
              <Route path="/account" element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/addresses" element={
                <ProtectedRoute>
                  <SavedAddressesPage />
                </ProtectedRoute>
              } />

              {/* Courier routes - no allowedRoles, page handles registration status */}
              <Route path="/courier" element={
                <ProtectedRoute>
                  <CourierDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/earnings" element={
                <ProtectedRoute>
                  <CourierEarningsPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/history" element={
                <ProtectedRoute>
                  <CourierHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/withdrawal" element={
                <ProtectedRoute>
                  <CourierWithdrawalPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/performa" element={
                <ProtectedRoute>
                  <CourierPerformaPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/deposit" element={
                <ProtectedRoute>
                  <CourierDepositPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/chat" element={
                <ProtectedRoute>
                  <CourierChatPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/rides" element={
                <ProtectedRoute>
                  <CourierRidesPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/slip" element={
                <ProtectedRoute>
                  <CourierSlipPage />
                </ProtectedRoute>
              } />
              
              {/* Ride routes */}
              <Route path="/ride" element={
                <ProtectedRoute>
                  <RideBookingPage />
                </ProtectedRoute>
              } />
              <Route path="/ride/history" element={
                <ProtectedRoute>
                  <RideHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/ride/:id" element={
                <ProtectedRoute>
                  <RideTrackingPage />
                </ProtectedRoute>
              } />
              <Route path="/orders/:orderId/review" element={
                <ProtectedRoute>
                  <ReviewsPage />
                </ProtectedRoute>
              } />
              <Route path="/wishlist" element={
                <ProtectedRoute>
                  <WishlistPage />
                </ProtectedRoute>
              } />
              <Route path="/reviews/mine" element={
                <ProtectedRoute>
                  <MyReviewsPage />
                </ProtectedRoute>
              } />
              <Route path="/recently-viewed" element={
                <ProtectedRoute>
                  <RecentlyViewedPage />
                </ProtectedRoute>
              } />
              <Route path="/buyer/chat" element={
                <ProtectedRoute>
                  <BuyerChatPage />
                </ProtectedRoute>
              } />
              <Route path="/flash-sale" element={<FlashSalePage />} />
              <Route path="/compare" element={<ProductComparePage />} />
              <Route path="/loyalty" element={<ProtectedRoute><LoyaltyPage /></ProtectedRoute>} />
              <Route path="/vouchers" element={<VoucherPage />} />
              <Route path="/rekomendasi" element={<RekomendasisPage />} />
              <Route path="/cashback" element={<ProtectedRoute><CashbackPage /></ProtectedRoute>} />
              <Route path="/referral" element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute><BuyerSupportPage /></ProtectedRoute>} />
              <Route path="/langganan" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
              <Route path="/orders/:orderId/dispute" element={
                <ProtectedRoute>
                  <DisputePage />
                </ProtectedRoute>
              } />
              <Route path="/orders/:orderId/invoice" element={
                <ProtectedRoute>
                  <InvoicePage />
                </ProtectedRoute>
              } />
              {/* Admin routes */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              } />
                <Route path="/admin/merchants" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminMerchantsPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/halal" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminHalalManagementPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/halal-regulation" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminHalalRegulationPage />
                  </ProtectedRoute>
                } />
              <Route path="/admin/merchants/:id" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminMerchantDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/villages" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminVillagesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/villages/:id" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminVillageDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/couriers" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCouriersPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/promotions" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPromotionsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/codes" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCodesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/orders" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminOrdersPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsersPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/refunds" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminRefundsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/logs" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLogsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/withdrawals" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminWithdrawalsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/transaction-quota" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTransactionQuotaPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/verifikator-commissions" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminVerifikatorCommissionsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/finance" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminFinancePage />
                </ProtectedRoute>
              } />
              <Route path="/admin/banners" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBannersPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/broadcast" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBroadcastPage />
                </ProtectedRoute>
              } />

              <Route path="/admin/roles" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminRolesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/backup" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBackupPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/categories" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCategoriesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/scheduled-backup" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminBackupPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/verifikator-withdrawals" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminVerifikatorWithdrawalsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/pos" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPOSPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/komisi" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminKomisiPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/audit-log" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAuditLogPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/rides" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminRidesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/realtime" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminRealtimeDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/system-health" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSystemHealthPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/whatsapp" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminWhatsAppPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/api-keys" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminApiKeysPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/push-notification" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPushNotificationPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/cashback" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCashbackPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/iklan" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminIklanPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/support-tickets" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSupportTicketsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/seo" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSEOPage />
                </ProtectedRoute>
              } />

              {/* Verifikator routes */}
              <Route path="/verifikator" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/merchants" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorMerchantsPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/ekonomi" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorEkonomiPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/event-desa" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorEventPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/kas-report" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorKasReportPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/earnings" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorEarningsPage />
                </ProtectedRoute>
              } />

              {/* Merchant routes - no allowedRoles, page handles registration status */}
              <Route path="/merchant" element={
                <ProtectedRoute>
                  <MerchantDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/products" element={
                <ProtectedRoute>
                  <MerchantProductsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/products/:productId" element={
                <ProtectedRoute>
                  <MerchantProductDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/orders" element={
                <ProtectedRoute>
                  <MerchantOrdersPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/settings" element={
                <ProtectedRoute>
                  <MerchantSettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/analytics" element={
                <ProtectedRoute>
                  <MerchantAnalyticsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/reviews" element={
                <ProtectedRoute>
                  <MerchantReviewsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/promo" element={
                <ProtectedRoute>
                  <MerchantPromoPage />
                </ProtectedRoute>
              } />              <Route path="/merchant/withdrawal" element={
                <ProtectedRoute>
                  <MerchantWithdrawalPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/refunds" element={
                <ProtectedRoute>
                  <MerchantRefundsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/gallery" element={
                <ProtectedRoute>
                  <MerchantGalleryPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/finance" element={
                <ProtectedRoute>
                  <MerchantFinancePage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/stock" element={
                <ProtectedRoute>
                  <MerchantStockPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/subscription" element={
                <ProtectedRoute>
                  <MerchantSubscriptionPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/flash-sale" element={
                <ProtectedRoute>
                  <MerchantFlashSalePage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/vouchers" element={
                <ProtectedRoute>
                  <MerchantVouchersPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/scheduled-promo" element={
                <ProtectedRoute>
                  <MerchantScheduledPromoPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/visitor-stats" element={
                <ProtectedRoute>
                  <MerchantVisitorStatsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/chat" element={
                <ProtectedRoute>
                  <MerchantChatPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pos/subscribe" element={
                <ProtectedRoute>
                  <MerchantPOSSubscribePage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pos/settings" element={
                <ProtectedRoute>
                  <MerchantPOSSettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pos" element={
                <ProtectedRoute>
                  <MerchantPOSPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/dues" element={
                <ProtectedRoute>
                  <MerchantDuesPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/notifikasi-wa" element={
                <ProtectedRoute>
                  <MerchantNotifikasiWAPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/import-export" element={
                <ProtectedRoute>
                  <MerchantImportExportPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/insight" element={
                <ProtectedRoute>
                  <MerchantInsightPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/iklan" element={
                <ProtectedRoute>
                  <MerchantIklanPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/bundle" element={
                <ProtectedRoute>
                  <MerchantBundlePage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/preorder" element={
                <ProtectedRoute>
                  <MerchantPreOrderPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/grosir" element={
                <ProtectedRoute>
                  <MerchantGrosirPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pajak" element={
                <ProtectedRoute>
                  <MerchantPajakPage />
                </ProtectedRoute>
              } />

              {/* Admin Desa routes - only tourism, no merchants */}
              <Route path="/desa" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/tourism" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaTourismPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/ekonomi" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaEkonomiPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/event" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaEventPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/keanggotaan" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaKeanggotaanPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/broadcast" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaBroadcastPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/peta" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaPetaPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/laporan-wisata" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaLaporanWisataPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/donasi" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaDonasiPage />
                </ProtectedRoute>
              } />
              {/* P1.4: Verifikasi merchant oleh admin desa */}
              <Route path="/desa/merchants" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaMerchantPage />
                </ProtectedRoute>
              } />
              {/* P3: Admin Desa & Ekosistem Wisata */}
              <Route path="/desa/profil" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaProfilPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/paket-wisata" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaPaketWisataPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/pemandu" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaPemanduPage />
                </ProtectedRoute>
              } />
              <Route path="/desa/laporan-keuangan" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaLaporanKeuanganPage />
                </ProtectedRoute>
              } />

              {/* Notifications */}
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } />

              {/* Custom store link - must be before catch-all */}
              <Route path="/s/:slug" element={<MerchantSlugResolver />} />

              {/* POS SaaS Routes */}
              <Route path="/pos/setup" element={<ProtectedRoute><POSSetupPage /></ProtectedRoute>} />
              <Route path="/pos" element={<ProtectedRoute><POSDashboardPage /></ProtectedRoute>} />
              <Route path="/pos/kasir" element={<ProtectedRoute><POSKasirPage /></ProtectedRoute>} />
              <Route path="/pos/transaksi" element={<ProtectedRoute><POSTransaksiPage /></ProtectedRoute>} />
              <Route path="/pos/retur" element={<ProtectedRoute><POSReturPage /></ProtectedRoute>} />
              <Route path="/pos/produk" element={<ProtectedRoute><POSProdukPage /></ProtectedRoute>} />
              <Route path="/pos/kategori" element={<ProtectedRoute><POSKategoriPage /></ProtectedRoute>} />
              <Route path="/pos/customer" element={<ProtectedRoute><POSCustomerPage /></ProtectedRoute>} />
              <Route path="/pos/supplier" element={<ProtectedRoute><POSSupplierPage /></ProtectedRoute>} />
              <Route path="/pos/stok" element={<ProtectedRoute><POSStokPage /></ProtectedRoute>} />
              <Route path="/pos/laporan" element={<ProtectedRoute><POSLaporanPage /></ProtectedRoute>} />
              <Route path="/pos/pengguna" element={<ProtectedRoute><POSPenggunaPage /></ProtectedRoute>} />
              <Route path="/pos/pengaturan" element={<ProtectedRoute><POSPengaturanPage /></ProtectedRoute>} />
              <Route path="/pos/pembelian" element={<ProtectedRoute><POSPembelianPage /></ProtectedRoute>} />
              <Route path="/pos/kas" element={<ProtectedRoute><POSKasPage /></ProtectedRoute>} />
              <Route path="/pos/laporan/laba-rugi" element={<ProtectedRoute><POSLaporanLabaRugiPage /></ProtectedRoute>} />
              <Route path="/pos/laporan/kasir" element={<ProtectedRoute><POSLaporanKasirPage /></ProtectedRoute>} />
              <Route path="/pos/laporan/stok" element={<ProtectedRoute><POSLaporanStokPage /></ProtectedRoute>} />
              <Route path="/pos/laporan/cashflow" element={<ProtectedRoute><POSLaporanCashflowPage /></ProtectedRoute>} />
              <Route path="/pos/analitik" element={<ProtectedRoute><POSAnalitikPage /></ProtectedRoute>} />
              <Route path="/pos/transfer-stok" element={<ProtectedRoute><POSTransferStokPage /></ProtectedRoute>} />
              <Route path="/pos/laporan/outlet" element={<ProtectedRoute><POSLaporanOutletPage /></ProtectedRoute>} />
              <Route path="/pos/audit" element={<ProtectedRoute><POSAuditPage /></ProtectedRoute>} />
              <Route path="/pos/akses" element={<ProtectedRoute><POSAksesPage /></ProtectedRoute>} />
              <Route path="/pos/promosi" element={<ProtectedRoute><POSPromosiPage /></ProtectedRoute>} />
              <Route path="/pos/loyalty" element={<ProtectedRoute><POSLoyaltyPage /></ProtectedRoute>} />
              <Route path="/pos/integrasi" element={<ProtectedRoute><POSIntegrasiPage /></ProtectedRoute>} />
              <Route path="/pos/analitik-produk" element={<ProtectedRoute><POSAnalitikProdukPage /></ProtectedRoute>} />
              <Route path="/pos/kiosk" element={<ProtectedRoute><POSKioskPage /></ProtectedRoute>} />
              <Route path="/pos/akuntansi" element={<ProtectedRoute><POSAkuntansiPage /></ProtectedRoute>} />
              <Route path="/pos/bahan-baku" element={<ProtectedRoute><POSBahanBakuPage /></ProtectedRoute>} />
              <Route path="/pos/resep" element={<ProtectedRoute><POSResepPage /></ProtectedRoute>} />
              <Route path="/pos/meja" element={<ProtectedRoute><POSMejaPage /></ProtectedRoute>} />
              <Route path="/pos/kds" element={<ProtectedRoute><POSKDSPage /></ProtectedRoute>} />
              <Route path="/pos/jadwal" element={<ProtectedRoute><POSJadwalPage /></ProtectedRoute>} />
              <Route path="/pos/absensi" element={<ProtectedRoute><POSAbsensiPage /></ProtectedRoute>} />
              <Route path="/pos/penggajian" element={<ProtectedRoute><POSPenggajianPage /></ProtectedRoute>} />
              <Route path="/pos/hutang-piutang" element={<ProtectedRoute><POSHutangPiutangPage /></ProtectedRoute>} />
              <Route path="/pos/target-omzet" element={<ProtectedRoute><POSTargetOmzetPage /></ProtectedRoute>} />
              <Route path="/pos/harga" element={<POSHargaPage />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
            </POSProvider>
      </WhitelabelProvider>
    </AuthProvider>
  </TooltipProvider>
</QueryClientProvider>
  </ErrorBoundary>
);

export default App;
