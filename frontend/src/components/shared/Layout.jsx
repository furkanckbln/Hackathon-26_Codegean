import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAlerts } from '../../context/AlertContext'

const salesMenuItems = [
  { to: '/dashboard',       icon: '📋', label: 'İlanlarım'         },
  { to: '/new-listing',     icon: '✨', label: 'Yeni İlan Oluştur' },
  { to: '/sales-assistant', icon: '🤖', label: 'Satış Asistanı'    },
  { to: '/competitor',      icon: '🔍', label: 'Rakip İlanları'    },
]

const financeMenuItems = [
  { to: '/finance',              icon: '📊', label: 'Genel Bakış'         },
  { to: '/finance/transactions', icon: '💸', label: 'Gelir & Giderler'    },
  { to: '/finance/reports',      icon: '📈', label: 'Raporlar'            },
  { to: '/finance/assistant',    icon: '🤖', label: 'Finans Asistanı'     },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const { hasCritical, unreadCount } = useAlerts()

  const isFinance = location.pathname.startsWith('/finance')

  const handleLogout = async () => {
    await logout()
    window.location.href = '/store'   // tam sayfa yenile → React state (sepet vb.) sıfırlanır
  }

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar */}
      <aside className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
          {!collapsed && <span className="text-xl font-bold text-blue-600">SellerAI</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors ml-auto"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Menü */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {(isFinance ? financeMenuItems : salesMenuItems).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`
              }
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Alt — kullanıcı & çıkış */}
        <div className="border-t border-gray-100 p-3">
          {!collapsed && (
            <div className="px-2 py-2 mb-1">
              <p className="text-xs text-gray-400">Giriş yapıldı</p>
              <p className="text-sm text-gray-700 font-medium truncate">
                {user?.user_metadata?.store_name || user?.email}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <span className="text-lg flex-shrink-0">🚪</span>
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Ana içerik */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          {/* Panel seçici */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${!isFinance
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              🛍️ Satış Paneli
            </button>
            <button
              onClick={() => navigate('/finance')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${isFinance
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              💰 Finans Paneli
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Anomali Bildirimi Zili */}
            <button
              onClick={() => navigate('/alerts')}
              className={`relative p-2 rounded-xl transition-colors
                ${hasCritical
                  ? 'bg-red-100 hover:bg-red-200 text-red-600 animate-pulse'
                  : unreadCount > 0
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-600'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500'}`}
              title={hasCritical ? 'Kritik uyarı var!' : unreadCount > 0 ? `${unreadCount} uyarı` : 'Anomali Uyarıları'}
            >
              <span className="text-lg leading-none">🔔</span>
              {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center
                  text-[10px] font-bold text-white rounded-full px-1
                  ${hasCritical ? 'bg-red-500' : 'bg-orange-500'}`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Mağazaya Git */}
            <button
              onClick={() => navigate('/store')}
              className="flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              title="Müşteri mağazasına git"
            >
              <span>🛒</span>
              <span>Mağazaya Git</span>
            </button>

            {/* Mağaza adı */}
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <span>🏪</span>
              <span>{user?.user_metadata?.store_name || user?.email}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
