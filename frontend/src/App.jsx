import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import DashboardPage  from './pages/DashboardPage'
import NewListingPage from './pages/NewListingPage'
import FinancePage    from './pages/FinancePage'
import CompetitorPage    from './pages/CompetitorPage'
import ListingDetailPage    from './pages/ListingDetailPage'
import SalesAssistantPage  from './pages/SalesAssistantPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Yükleniyor...</div>
  return user ? children : <Navigate to="/login" replace />
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Yükleniyor...</div>
  return !user ? children : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"            element={<Navigate to="/login" replace />} />
      <Route path="/login"       element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register"    element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/dashboard"   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/new-listing" element={<ProtectedRoute><NewListingPage /></ProtectedRoute>} />
      <Route path="/finance"     element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
      <Route path="/competitor"  element={<ProtectedRoute><CompetitorPage /></ProtectedRoute>} />
      <Route path="/listings/:id"      element={<ProtectedRoute><ListingDetailPage /></ProtectedRoute>} />
      <Route path="/sales-assistant"  element={<ProtectedRoute><SalesAssistantPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
