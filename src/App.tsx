import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import ProductsPage from "./pages/ProductsPage";
import ProductDetail from "./pages/ProductDetail";
import TourismPage from "./pages/TourismPage";
import TourismDetail from "./pages/TourismDetail";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import ExplorePage from "./pages/ExplorePage";
import SearchResultsPage from "./pages/SearchResultsPage";
import OrdersPage from "./pages/OrdersPage";
import AccountPage from "./pages/AccountPage";
import AuthPage from "./pages/AuthPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterVillagePage from "./pages/RegisterVillagePage";
import RegisterMerchantPage from "./pages/RegisterMerchantPage";
import RegisterCourierPage from "./pages/RegisterCourierPage";
import NotFound from "./pages/NotFound";
import CourierDashboardPage from "./pages/CourierDashboardPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";

// Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminMerchantsPage from "./pages/admin/AdminMerchantsPage";
import AdminVillagesPage from "./pages/admin/AdminVillagesPage";
import AdminCouriersPage from "./pages/admin/AdminCouriersPage";
import AdminPromotionsPage from "./pages/admin/AdminPromotionsPage";
import AdminCodesPage from "./pages/admin/AdminCodesPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";

// Verifikator Pages
import VerifikatorDashboardPage from "./pages/verifikator/VerifikatorDashboardPage";
import VerifikatorCodesPage from "./pages/verifikator/VerifikatorCodesPage";
import VerifikatorMerchantsPage from "./pages/verifikator/VerifikatorMerchantsPage";

// Merchant Pages
import MerchantDashboardPage from "./pages/merchant/MerchantDashboardPage";
import MerchantProductsPage from "./pages/merchant/MerchantProductsPage";
import MerchantOrdersPage from "./pages/merchant/MerchantOrdersPage";
import MerchantSettingsPage from "./pages/merchant/MerchantSettingsPage";

// Desa Pages
import DesaDashboardPage from "./pages/desa/DesaDashboardPage";
import DesaTourismPage from "./pages/desa/DesaTourismPage";
import DesaMerchantsPage from "./pages/desa/DesaMerchantsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/tourism" element={<TourismPage />} />
              <Route path="/tourism/:id" element={<TourismDetail />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/village" element={<RegisterVillagePage />} />
              <Route path="/register/merchant" element={<RegisterMerchantPage />} />
              <Route path="/register/courier" element={<RegisterCourierPage />} />
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

              {/* Courier routes */}
              <Route path="/courier" element={
                <ProtectedRoute allowedRoles={['courier', 'admin']}>
                  <CourierDashboardPage />
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
              <Route path="/admin/villages" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminVillagesPage />
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

              {/* Verifikator routes */}
              <Route path="/verifikator" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/codes" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorCodesPage />
                </ProtectedRoute>
              } />
              <Route path="/verifikator/merchants" element={
                <ProtectedRoute allowedRoles={['verifikator', 'admin']}>
                  <VerifikatorMerchantsPage />
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

              {/* Admin Desa routes */}
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
              <Route path="/desa/merchants" element={
                <ProtectedRoute allowedRoles={['admin_desa', 'admin']}>
                  <DesaMerchantsPage />
                </ProtectedRoute>
              } />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
