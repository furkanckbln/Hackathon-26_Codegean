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

/** Yıldız seçici */
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none focus:outline-none transition-transform hover:scale-110"
        >
          <span className={(hovered || value) >= star ? 'text-yellow-400' : 'text-gray-200'}>
            ★
          </span>
        </button>
      ))}
    </div>
  )
}

/** Readonly yıldız gösterimi */
function StarDisplay({ value }) {
  return (
    <span className="text-base">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={value >= s ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

/** Tek sipariş kartı */
function OrderCard({ order, onRefund }) {
  const listing    = order.listings || {}
  const cargoLabel = (order.cargo_price ?? 0) > 0
    ? `${fmt(order.cargo_price)} ₺ kargo`
    : 'Ücretsiz kargo'
  const total = (order.sale_price * order.quantity) +
                (order.cargo_price > 0 ? order.cargo_price : 0)

  const isDelivered = order.status === 'delivered'

  const [review,       setReview]       = useState(undefined)
  const [reviewLoaded, setReviewLoaded] = useState(false)
  const [formOpen,     setFormOpen]     = useState(false)
  const [rating,       setRating]       = useState(0)
  const [comment,      setComment]      = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitErr,    setSubmitErr]    = useState('')

  const [refunding,    setRefunding]    = useState(false)
  const [refundErr,    setRefundErr]    = useState('')
  const [confirmOpen,  setConfirmOpen]  = useState(false)

  // Teslim edilmiş siparişler için mevcut yorumu çek
  useEffect(() => {
    if (!isDelivered) return
    api.get(`/reviews/order/${order.id}`)
      .then(r => { setReview(r.data); setReviewLoaded(true) })
      .catch(() => { setReview(null); setReviewLoaded(true) })
  }, [order.id, isDelivered])

  const handleRefund = async () => {
    setRefunding(true)
    setRefundErr('')
    try {
      await api.patch(`/orders/${order.id}/refund`)
      setConfirmOpen(false)
      onRefund(order.id)   // üst bileşene haber ver → local state güncelle
    } catch (e) {
      setRefundErr(e?.response?.data?.detail || 'İade işlemi başarısız.')
      setConfirmOpen(false)
    } finally {
      setRefunding(false)
    }
  }

  const handleSubmit = async () => {
    if (rating === 0) { setSubmitErr('Lütfen bir puan seç.'); return }
    setSubmitErr('')
    setSubmitting(true)
    try {
      await api.post('/reviews/', {
        order_id: order.id,
        rating,
        comment: comment.trim() || null,
      })
      setReview({ rating, comment: comment.trim(), created_at: new Date().toISOString() })
      setFormOpen(false)
    } catch (e) {
      setSubmitErr(e?.response?.data?.detail || 'Yorum kaydedilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Sipariş özeti */}
      <div className="p-4 flex gap-4">
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

      {/* ── İade butonu (yalnızca teslim edilmiş) ───────────────────────── */}
      {isDelivered && (
        <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/40 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">Ürünü iade etmek istiyor musunuz?</span>
          {refundErr && <p className="text-xs text-red-500">{refundErr}</p>}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={refunding}
            className="text-xs font-semibold text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            ↩ İade Et
          </button>
        </div>
      )}

      {/* Onay dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-2xl mb-3">↩</div>
            <h3 className="text-base font-bold text-gray-800 mb-1">İade Talebi</h3>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-700">{listing.title}</span> ürününü iade etmek
              istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 text-sm border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={handleRefund}
                disabled={refunding}
                className="flex-1 text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-xl py-2.5 transition-colors"
              >
                {refunding ? '⏳ İşleniyor…' : 'Evet, İade Et'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Yorum bölgesi (yalnızca teslim edilmiş) ──────────────────────── */}
      {isDelivered && reviewLoaded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">

          {review ? (
            /* Mevcut yorum */
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <StarDisplay value={review.rating} />
                <span className="text-[11px] text-gray-400">
                  {new Date(review.created_at).toLocaleDateString('tr-TR')} tarihinde yorumlandı
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{review.comment}</p>
              )}
            </div>
          ) : !formOpen ? (
            /* Yorum yapılmamış → buton */
            <button
              onClick={() => setFormOpen(true)}
              className="text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1"
            >
              <span className="text-base leading-none">★</span> Puan ver &amp; yorum yap
            </button>
          ) : (
            /* Yorum formu */
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Puanın:</p>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Ürün hakkında bir şeyler yaz… (opsiyonel)"
                rows={3}
                maxLength={1000}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none bg-white"
              />

              {submitErr && (
                <p className="text-xs text-red-500">{submitErr}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFormOpen(false)
                    setRating(0)
                    setComment('')
                    setSubmitErr('')
                  }}
                  className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-100 transition-colors bg-white"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl py-2 transition-colors"
                >
                  {submitting ? '⏳ Kaydediliyor…' : 'Gönder'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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

  // Kart iade edilince local state'i güncelle → yeniden fetch gerekmiyor
  const handleRefund = (orderId) => {
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: 'refunded' } : o)
    )
  }

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
              D
            </div>
            <span className="font-bold text-gray-800">
              Dijital<span className="text-orange-500">Esnaf</span>
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
            {orders.map(order => (
              <OrderCard key={order.id} order={order} onRefund={handleRefund} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
