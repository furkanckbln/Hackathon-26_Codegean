import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AlertProvider } from './context/AlertContext'
import { CartProvider }  from './context/CartContext'
import ErrorBoundary from './components/shared/ErrorBoundary'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import DashboardPage  from './pages/DashboardPage'
import NewListingPage from './pages/NewListingPage'
import FinancePage             from './pages/FinancePage'
import FinanceTransactionsPage from './pages/FinanceTransactionsPage'
import FinanceReportsPage      from './pages/FinanceReportsPage'
import FinanceAssistantPage    from './pages/FinanceAssistantPage'
import CompetitorPage          from './pages/CompetitorPage'
import ListingDetailPage       from './pages/ListingDetailPage'
import SalesAssistantPage      from './pages/SalesAssistantPage'
import AlertsPage              from './pages/AlertsPage'
import StorePage              from './pages/StorePage'
import StoreProductPage       from './pages/StoreProductPage'
import CustomerLoginPage      from './pages/CustomerLoginPage'
import CustomerRegisterPage   from './pages/CustomerRegisterPage'

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center text-gray-400">Yükleniyor...</div>
)

/** Satıcı sayfaları — login gerekli + user_type='seller' */
function SellerRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (user.user_metadata?.user_type === 'customer') return <Navigate to="/store" replace />
  return children
}

/** Müşteri sayfaları — login gerekli + user_type='customer' */
function CustomerRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/customer/login" replace />
  if (user.user_metadata?.user_type === 'seller') return <Navigate to="/dashboard" replace />
  return children
}

/** Satıcı giriş/kayıt sayfaları — giriş yapmışsa yönlendir */
function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return children
  const type = user.user_metadata?.user_type
  return <Navigate to={type === 'customer' ? '/store' : '/dashboard'} replace />
}

/** Müşteri giriş/kayıt sayfaları — giriş yapmışsa yönlendir */
function CustomerGuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return children
  const type = user.user_metadata?.user_type
  return <Navigate to={type === 'seller' ? '/dashboard' : '/store'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"            element={<Navigate to="/store" replace />} />
      <Route path="/login"       element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register"    element={<GuestRoute><RegisterPage /></GuestRoute>} />
      {/* ── Satıcı Paneli (SellerRoute) ─────────────────────────────────── */}
      <Route path="/dashboard"              element={<SellerRoute><DashboardPage /></SellerRoute>} />
      <Route path="/new-listing"            element={<SellerRoute><NewListingPage /></SellerRoute>} />
      <Route path="/finance"                element={<SellerRoute><FinancePage /></SellerRoute>} />
      <Route path="/finance/transactions"   element={<SellerRoute><FinanceTransactionsPage /></SellerRoute>} />
      <Route path="/finance/reports"        element={<SellerRoute><FinanceReportsPage /></SellerRoute>} />
      <Route path="/finance/assistant"      element={<SellerRoute><FinanceAssistantPage /></SellerRoute>} />
      <Route path="/competitor"             element={<SellerRoute><CompetitorPage /></SellerRoute>} />
      <Route path="/listings/:id"           element={<SellerRoute><ListingDetailPage /></SellerRoute>} />
      <Route path="/sales-assistant"        element={<SellerRoute><SalesAssistantPage /></SellerRoute>} />
      <Route path="/alerts"                 element={<SellerRoute><ErrorBoundary><AlertsPage /></ErrorBoundary></SellerRoute>} />

      {/* ── Müşteri Vitrini (Public) ─────────────────────────────────────── */}
      <Route path="/store"                  element={<StorePage />} />
      <Route path="/store/:id"              element={<StoreProductPage />} />

      {/* ── Müşteri Auth ─────────────────────────────────────────────────── */}
      <Route path="/customer/login"         element={<CustomerGuestRoute><CustomerLoginPage /></CustomerGuestRoute>} />
      <Route path="/customer/register"      element={<CustomerGuestRoute><CustomerRegisterPage /></CustomerGuestRoute>} />
      {/* /customer — ileride CustomerDashboardPage gelecek */}
      <Route path="/customer"               element={<CustomerRoute><Navigate to="/store" replace /></CustomerRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
