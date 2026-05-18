/**
 * SellerOrdersPage — Satıcı Sipariş Yönetimi
 * Route: /seller/orders (SellerRoute ile korumalı)
 */

import { useEffect, useState } from 'react'
import api from '../services/api'
import Layout from '../components/shared/Layout'

const fmt = (n) =>
  Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_MAP = {
  processing: { label: 'Hazırlanıyor', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  shipped:    { label: 'Kargoda',      color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400'   },
  delivered:  { label: 'Teslim Edildi',color: 'bg-green-100 text-green-700',   dot: 'bg-green-500'  },
  cancelled:  { label: 'İptal Edildi', color: 'bg-red-100 text-red-600',       dot: 'bg-red-400'    },
  refunded:   { label: 'İade Edildi',  color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400'   },
}

// Statü geçiş akışı: hangi statüden hangi statülere geçilebilir
const TRANSITIONS = {
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered', 'cancelled'],
  delivered:  [],
  cancelled:  ['refunded'],
  refunded:   [],
}

const TRANSITION_LABELS = {
  shipped:   { label: '🚚 Kargoya Ver',     style: 'bg-blue-500 hover:bg-blue-600 text-white'  },
  delivered: { label: '✅ Teslim Edildi',   style: 'bg-green-500 hover:bg-green-600 text-white' },
  cancelled: { label: '✕ İptal Et',        style: 'bg-red-100 hover:bg-red-200 text-red-600'  },
  refunded:  { label: '↩ İade Et',         style: 'bg-gray-100 hover:bg-gray-200 text-gray-600'},
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

const FILTER_OPTIONS = [
  { key: 'all',        label: 'Tümü'          },
  { key: 'processing', label: 'Hazırlanıyor'  },
  { key: 'shipped',    label: 'Kargoda'       },
  { key: 'delivered',  label: 'Teslim Edildi' },
  { key: 'cancelled',  label: 'İptal'         },
  { key: 'refunded',   label: 'İade'          },
]

export default function SellerOrdersPage() {
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('all')
  const [updating, setUpdating] = useState({})   // order_id → true/false

  useEffect(() => {
    api.get('/orders/seller')
      .then(r => setOrders(r.data || []))
      .catch(() => setError('Siparişler yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [])

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdating(u => ({ ...u, [orderId]: true }))
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus })
      setOrders(prev =>
        prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
      )
    } catch (e) {
      alert(e?.response?.data?.detail || 'Statü güncellenemedi.')
    } finally {
      setUpdating(u => ({ ...u, [orderId]: false }))
    }
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  // Özet sayaçlar
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Başlık */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Siparişler</h1>
            <p className="text-sm text-gray-400 mt-0.5">{orders.length} toplam sipariş</p>
          </div>
        </div>

        {/* Özet kartlar */}
        {!loading && orders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { key: 'processing', label: 'Hazırlanıyor', icon: '⏳', color: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
              { key: 'shipped',    label: 'Kargoda',      icon: '🚚', color: 'border-blue-200 bg-blue-50 text-blue-700'       },
              { key: 'delivered',  label: 'Teslim',       icon: '✅', color: 'border-green-200 bg-green-50 text-green-700'    },
              { key: 'cancelled',  label: 'İptal/İade',   icon: '✕',  color: 'border-red-200 bg-red-50 text-red-600'          },
            ].map(card => (
              <button
                key={card.key}
                onClick={() => setFilter(card.key === filter ? 'all' : card.key)}
                className={`border rounded-xl p-3 text-left transition-all ${card.color}
                  ${filter === card.key ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-80'}`}
              >
                <div className="text-xl mb-1">{card.icon}</div>
                <div className="text-2xl font-bold">{counts[card.key] || 0}</div>
                <div className="text-xs font-medium opacity-80">{card.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Filtre tab'ları */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
                ${filter === opt.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {opt.label}
              {opt.key !== 'all' && counts[opt.key] > 0 && (
                <span className="ml-1.5 bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {counts[opt.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* İçerik */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p className="text-sm">Siparişler yükleniyor…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4 opacity-20">📭</div>
            <p className="text-sm">
              {filter === 'all' ? 'Henüz sipariş yok.' : 'Bu kategoride sipariş yok.'}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(order => {
              const listing     = order.listings || {}
              const cargo       = (order.cargo_price ?? 0) > 0 ? order.cargo_price : 0
              const total       = order.sale_price * order.quantity + cargo
              const nextSteps   = TRANSITIONS[order.status] || []
              const isUpdating  = updating[order.id]

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="p-4 flex gap-4">
                    {/* Ürün görseli */}
                    <div
                      className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-100"
                      style={{
                        backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                        backgroundSize: '10px 10px',
                      }}
                    >
                      {listing.clean_image_url ? (
                        <img src={listing.clean_image_url} alt={listing.title}
                          className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-2xl opacity-20">🛍️</span>
                      )}
                    </div>

                    {/* Sipariş bilgisi */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">
                          {listing.title || '—'}
                        </p>
                        <StatusBadge status={order.status} />
                      </div>

                      {listing.category && (
                        <p className="text-xs text-orange-500 font-medium mb-1">{listing.category}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                        <span>{order.quantity} adet × {fmt(order.sale_price)} ₺</span>
                        <span>Toplam: <span className="font-semibold text-gray-700">{fmt(total)} ₺</span></span>
                        {order.net_revenue != null && (
                          <span>Net kâr: <span className="font-semibold text-green-600">{fmt(order.net_revenue)} ₺</span></span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {new Date(order.order_date || order.created_at).toLocaleDateString('tr-TR')}
                        <span className="ml-2 font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
                        {!order.buyer_id && (
                          <span className="ml-2 text-gray-300">· Misafir müşteri</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Statü güncelleme aksiyonları */}
                  {nextSteps.length > 0 && (
                    <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/60 flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 mr-1">Güncelle:</span>
                      {nextSteps.map(next => {
                        const t = TRANSITION_LABELS[next]
                        return (
                          <button
                            key={next}
                            onClick={() => handleStatusUpdate(order.id, next)}
                            disabled={isUpdating}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${t.style}`}
                          >
                            {isUpdating ? '⏳' : t.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
