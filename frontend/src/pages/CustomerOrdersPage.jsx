/**
 * CustomerOrdersPage — Müşteri Siparişlerim
 * Route: /customer/orders (CustomerRoute ile korumalı)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const fmt = (n) =>
  Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_MAP = {
  processing: { label: 'Hazırlanıyor',  color: 'bg-yellow-100 text-yellow-700' },
  shipped:    { label: 'Kargoda',        color: 'bg-blue-100 text-blue-700'   },
  delivered:  { label: 'Teslim Edildi',  color: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'İptal Edildi',   color: 'bg-red-100 text-red-600'     },
  refunded:   { label: 'İade Edildi',    color: 'bg-gray-100 text-gray-600'   },
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>
      {s.label}
    </span>
  )
}

export default function CustomerOrdersPage() {
  const navigate = useNavigate()
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get('/orders/my')
      .then(r => setOrders(r.data || []))
      .catch(() => setError('Siparişler yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/store')}
            className="flex items-center gap-2 text-sm hover:text-orange-600 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-bold text-gray-800">
              Seller<span className="text-orange-500">AI</span>
            </span>
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600 font-medium">Siparişlerim</span>

          <div className="flex-1" />
          <button
            onClick={() => navigate('/store')}
            className="text-xs text-orange-500 hover:underline"
          >
            ← Mağazaya Dön
          </button>
        </div>
      </header>

      {/* İçerik */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Siparişlerim</h1>

        {loading && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p className="text-sm">Siparişler yükleniyor…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4 opacity-30">🛍️</div>
            <p className="text-sm font-medium">Henüz siparişin yok.</p>
            <button
              onClick={() => navigate('/store')}
              className="mt-4 text-sm text-orange-500 hover:underline"
            >
              Alışverişe Başla →
            </button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map(order => {
              const listing    = order.listings || {}
              const cargoLabel = (order.cargo_price ?? 0) > 0
                ? `${fmt(order.cargo_price)} ₺ kargo`
                : 'Ücretsiz kargo'
              const total = (order.sale_price * order.quantity) +
                            (order.cargo_price > 0 ? order.cargo_price : 0)

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4"
                >
                  {/* Ürün görseli */}
                  <div
                    className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100"
                    style={{
                      backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                      backgroundSize: '12px 12px',
                    }}
                  >
                    {listing.clean_image_url ? (
                      <img
                        src={listing.clean_image_url}
                        alt={listing.title}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-3xl opacity-20">🛍️</span>
                    )}
                  </div>

                  {/* Sipariş bilgisi */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">
                        {listing.title || 'Ürün bilgisi yüklenemedi'}
                      </p>
                      <StatusBadge status={order.status} />
                    </div>

                    {listing.category && (
                      <p className="text-xs text-orange-500 font-medium mb-1">{listing.category}</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      <span>{order.quantity} adet × {fmt(order.sale_price)} ₺</span>
                      <span>{cargoLabel}</span>
                      <span className="font-semibold text-gray-700">Toplam: {fmt(total)} ₺</span>
                    </div>

                    <p className="text-[11px] text-gray-400 mt-2">
                      Sipariş tarihi: {new Date(order.order_date || order.created_at).toLocaleDateString('tr-TR')}
                      <span className="ml-3 font-mono text-[10px]">#{order.id.slice(0, 8).toUpperCase()}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
