import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const menuItems = [
  { to: '/dashboard',        icon: '📋', label: 'İlanlarım'         },
  { to: '/new-listing',      icon: '✨', label: 'Yeni İlan Oluştur' },
  { to: '/sales-assistant',  icon: '🤖', label: 'Satış Asistanı'    },
  { to: '/finance',          icon: '💰', label: 'Finans Paneli'     },
  { to: '/competitor',       icon: '🔍', label: 'Rakip İlanları'    },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
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
          {menuItems.map((item) => (
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
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">Satıcı Paneli</h1>
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
            <span>🏪</span>
            <span>{user?.user_metadata?.store_name || user?.email}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
