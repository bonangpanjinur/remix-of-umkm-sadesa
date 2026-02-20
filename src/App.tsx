import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WhitelabelProvider } from "@/contexts/WhitelabelContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { SEO } from "@/components/SEO";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

// Pages
import Index from "./pages/Index";
import ProductsPage from "./pages/ProductsPage";
import ProductDetail from "./pages/ProductDetail";
import TourismPage from "./pages/TourismPage";
import TourismDetail from "./pages/TourismDetail";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentConfirmationPage from "./pages/PaymentConfirmationPage";
import ExplorePage from "./pages/ExplorePage";
import SearchResultsPage from "./pages/SearchResultsPage";
import OrdersPage from "./pages/OrdersPage";
import AccountPage from "./pages/AccountPage";
import SettingsPage from "./pages/SettingsPage";
import SavedAddressesPage from "./pages/SavedAddressesPage";
import AuthPage from "./pages/AuthPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterVillagePage from "./pages/RegisterVillagePage";
import RegisterMerchantPage from "./pages/RegisterMerchantPage";
import RegisterCourierPage from "./pages/RegisterCourierPage";
import NotFound from "./pages/NotFound";
import CourierDashboardPage from "./pages/CourierDashboardPage";
import CourierEarningsPage from "./pages/courier/CourierEarningsPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import VillageDetailPage from "./pages/VillageDetailPage";
// MerchantProfilePage is rendered via MerchantSlugResolver
import MerchantSlugResolver from "./pages/MerchantSlugResolver";
import ShopsPage from "./pages/ShopsPage";
import InstallPage from "./pages/InstallPage";
import HelpPage from "./pages/HelpPage";
import RecentlyViewedPage from "./pages/buyer/RecentlyViewedPage";
import AdminSystemHealthPage from "./pages/admin/AdminSystemHealthPage";

// Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminMerchantDetailPage from "./pages/admin/AdminMerchantDetailPage";
import AdminMerchantsPage from "./pages/admin/AdminMerchantsPage";
import AdminVillagesPage from "./pages/admin/AdminVillagesPage";
import AdminVillageDetailPage from "./pages/admin/AdminVillageDetailPage";
import AdminCouriersPage from "./pages/admin/AdminCouriersPage";
import AdminPromotionsPage from "./pages/admin/AdminPromotionsPage";
import AdminCodesPage from "./pages/admin/AdminCodesPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminRefundsPage from "./pages/admin/AdminRefundsPage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminHalalManagementPage from "./pages/admin/AdminHalalManagementPage";
import AdminHalalRegulationPage from "./pages/admin/AdminHalalRegulationPage";

import AdminTransactionQuotaPage from "./pages/admin/AdminTransactionQuotaPage";
import AdminVerifikatorCommissionsPage from "./pages/admin/AdminVerifikatorCommissionsPage";
import AdminFinancePage from "./pages/admin/AdminFinancePage";
import AdminBannersPage from "./pages/admin/AdminBannersPage";
import AdminBroadcastPage from "./pages/admin/AdminBroadcastPage";
import AdminRolesPage from "./pages/admin/AdminRolesPage";
import AdminBackupPage from "./pages/admin/AdminBackupPage";
// AdminScheduledBackupPage is now merged into AdminBackupPage
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminVerifikatorWithdrawalsPage from "./pages/admin/AdminVerifikatorWithdrawalsPage";
import AdminPOSPage from "./pages/admin/AdminPOSPage";
import CourierHistoryPage from "./pages/courier/CourierHistoryPage";
import CourierWithdrawalPage from "./pages/courier/CourierWithdrawalPage";
import CourierChatPage from "./pages/courier/CourierChatPage";

// Verifikator Pages
import VerifikatorDashboardPage from "./pages/verifikator/VerifikatorDashboardPage";
import VerifikatorMerchantsPage from "./pages/verifikator/VerifikatorMerchantsPage";
import VerifikatorEarningsPage from "./pages/verifikator/VerifikatorEarningsPage";
import VerifikatorKasReportPage from "./pages/verifikator/VerifikatorKasReportPage";

// Merchant Pages
import MerchantDashboardPage from "./pages/merchant/MerchantDashboardPage";
import MerchantProductsPage from "./pages/merchant/MerchantProductsPage";
import MerchantProductDetailPage from "./pages/merchant/MerchantProductDetailPage";
import MerchantOrdersPage from "./pages/merchant/MerchantOrdersPage";
import MerchantSettingsPage from "./pages/merchant/MerchantSettingsPage";
import MerchantAnalyticsPage from "./pages/merchant/MerchantAnalyticsPage";
import MerchantReviewsPage from "./pages/merchant/MerchantReviewsPage";
import MerchantPromoPage from "./pages/merchant/MerchantPromoPage";
import MerchantWithdrawalPage from "./pages/merchant/MerchantWithdrawalPage";
import MerchantSubscriptionPage from "./pages/merchant/MerchantSubscriptionPage";
import MerchantFlashSalePage from "./pages/merchant/MerchantFlashSalePage";
import MerchantVouchersPage from "./pages/merchant/MerchantVouchersPage";
import MerchantScheduledPromoPage from "./pages/merchant/MerchantScheduledPromoPage";
import MerchantVisitorStatsPage from "./pages/merchant/MerchantVisitorStatsPage";
import MerchantChatPage from "./pages/merchant/MerchantChatPage";
import MerchantRefundsPage from "./pages/merchant/MerchantRefundsPage";
import MerchantPOSPage from "./pages/merchant/MerchantPOSPage";
import MerchantPOSSubscribePage from "./pages/merchant/MerchantPOSSubscribePage";
import MerchantPOSSettingsPage from "./pages/merchant/MerchantPOSSettingsPage";
import MerchantDuesPage from "./pages/merchant/MerchantDuesPage";

// Desa Pages
import DesaDashboardPage from "./pages/desa/DesaDashboardPage";
import DesaTourismPage from "./pages/desa/DesaTourismPage";

// Buyer Pages
import ReviewsPage from "./pages/buyer/ReviewsPage";
import WishlistPage from "./pages/buyer/WishlistPage";
import MyReviewsPage from "./pages/buyer/MyReviewsPage";
import BuyerChatPage from "./pages/buyer/BuyerChatPage";

// Notifications
import NotificationsPage from "./pages/NotificationsPage";

const queryClient = new QueryClient();

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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WhitelabelProvider>
            <CartProvider>
              <Toaster />
              <Sonner />
              <OfflineIndicator />
              <BrowserRouter>
                <RedirectHandler />
                <SEO />
                <InstallBanner />
                <UpdatePrompt />
              <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/tourism" element={<TourismPage />} />
              <Route path="/tourism/:id" element={<TourismDetail />} />
              <Route path="/village/:id" element={<VillageDetailPage />} />
              <Route path="/merchant/:slugOrId" element={<MerchantSlugResolver />} />
              <Route path="/shops" element={<ShopsPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/auth" element={<AuthPage />} />
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

              {/* Courier routes */}
              <Route path="/courier" element={
                <ProtectedRoute allowedRoles={['courier', 'admin']}>
                  <CourierDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/earnings" element={
                <ProtectedRoute allowedRoles={['courier', 'admin']}>
                  <CourierEarningsPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/history" element={
                <ProtectedRoute allowedRoles={['courier', 'admin']}>
                  <CourierHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/withdrawal" element={
                <ProtectedRoute allowedRoles={['courier', 'admin']}>
                  <CourierWithdrawalPage />
                </ProtectedRoute>
              } />
              <Route path="/courier/chat" element={
                <ProtectedRoute allowedRoles={['courier', 'admin']}>
                  <CourierChatPage />
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
              <Route path="/admin/packages" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTransactionQuotaPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/quota-settings" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTransactionQuotaPage />
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
              <Route path="/admin/system-health" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSystemHealthPage />
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

              {/* Merchant routes */}
              <Route path="/merchant" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/products" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantProductsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/products/:productId" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantProductDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/orders" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantOrdersPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/settings" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantSettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/analytics" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantAnalyticsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/reviews" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantReviewsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/promo" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantPromoPage />
                </ProtectedRoute>
              } />              <Route path="/merchant/withdrawal" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantWithdrawalPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/refunds" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantRefundsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/subscription" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantSubscriptionPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/flash-sale" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantFlashSalePage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/vouchers" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantVouchersPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/scheduled-promo" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantScheduledPromoPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/visitor-stats" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantVisitorStatsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/chat" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantChatPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pos/subscribe" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantPOSSubscribePage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pos/settings" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantPOSSettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/pos" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantPOSPage />
                </ProtectedRoute>
              } />
              <Route path="/merchant/dues" element={
                <ProtectedRoute allowedRoles={['merchant', 'admin']}>
                  <MerchantDuesPage />
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

              {/* Notifications */}
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } />

              {/* Custom store link - must be before catch-all */}
              <Route path="/s/:slug" element={<MerchantSlugResolver />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </WhitelabelProvider>
    </AuthProvider>
  </TooltipProvider>
</QueryClientProvider>
  </ErrorBoundary>
);

export default App;
