/**
 * StoreProductPage — Müşteri Ürün Detay + Satın Al (Public)
 *
 * Auth gerektirmez.
 * POST /orders ile sipariş oluşturur.
 * Sipariş başarılıysa Supabase trigger stoku otomatik düşürür.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useCart } from '../context/CartContext'

const fmt = (n) =>
  Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function StarRating({ rating }) {
  if (!rating) return <span className="text-sm text-gray-400">Değerlendirme yok</span>
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-yellow-400 text-base">
        {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(empty)}
      </span>
      <span className="text-sm text-gray-500">{rating} / 5</span>
    </div>
  )
}

// ── Sipariş Başarı Ekranı ─────────────────────────────────────────────────────
function OrderSuccess({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mx-auto mb-4">
          ✅
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Siparişiniz Alındı!</h2>
        <p className="text-sm text-gray-500 mb-5">{order.message}</p>

        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400">Sipariş No</span>
            <span className="font-mono text-gray-700 text-xs truncate max-w-[160px]">{order.order_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Ürün</span>
            <span className="text-gray-700 text-right max-w-[160px] line-clamp-1">{order.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Adet</span>
            <span className="text-gray-700">{order.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Kargo</span>
            <span className="text-gray-700">{fmt(order.cargo_price)} ₺</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-gray-200 pt-2 mt-2">
            <span className="text-gray-700">Toplam</span>
            <span className="text-orange-600 text-base">{fmt(order.total)} ₺</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Alışverişe Devam Et
        </button>
      </div>
    </div>
  )
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function StoreProductPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { addItem, totalItems } = useCart()

  const [listing,   setListing]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [quantity,  setQuantity]  = useState(1)
  const [ordering,  setOrdering]  = useState(false)
  const [orderErr,  setOrderErr]  = useState('')
  const [orderOk,   setOrderOk]   = useState(null)   // başarılı sipariş datası
  const [addedToCart, setAddedToCart] = useState(false)

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(r => setListing(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleAddToCart = () => {
    if (!listing) return
    addItem(listing, quantity)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handleOrder = async () => {
    if (ordering) return
    setOrderErr('')
    setOrdering(true)
    try {
      const res = await api.post('/orders/', {
        listing_id: id,
        quantity,
      })
      // Stok güncel göstermek için listing'i güncelle
      setListing(prev => ({
        ...prev,
        stock: Math.max((prev.stock ?? 0) - quantity, 0),
      }))
      setOrderOk(res.data)
    } catch (e) {
      setOrderErr(e?.response?.data?.detail || 'Sipariş oluşturulamadı, tekrar dene.')
    } finally {
      setOrdering(false)
    }
  }

  const featureList = listing?.features
    ? Array.isArray(listing.features)
      ? listing.features
      : listing.features.split('\n').filter(Boolean)
    : []

  const seoList = listing?.seo_tags
    ? Array.isArray(listing.seo_tags)
      ? listing.seo_tags
      : listing.seo_tags.split(',').map(t => t.trim()).filter(Boolean)
    : []

  const inStock      = (listing?.stock ?? 0) > 0
  const maxQty       = Math.min(listing?.stock ?? 0, 10)
  const cargoPrice   = listing?.cargo_price ?? 29.90          // listing'den oku
  const customerCargo = cargoPrice > 0 ? cargoPrice : 0      // müşteri öder mi?
  const total        = ((listing?.price ?? 0) * quantity + customerCargo).toFixed(2)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🛍️</div>
        <p className="text-gray-400 text-sm">Ürün yükleniyor…</p>
      </div>
    </div>
  )

  if (!listing) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Ürün bulunamadı.</p>
        <button onClick={() => navigate('/store')} className="text-orange-500 hover:underline text-sm">
          ← Mağazaya dön
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Başarı Modal */}
      {orderOk && (
        <OrderSuccess
          order={orderOk}
          onClose={() => { setOrderOk(null); navigate('/store') }}
        />
      )}

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/store')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-bold text-gray-800">
              Seller<span className="text-orange-500">AI</span>
            </span>
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0 flex-1">
            <button onClick={() => navigate('/store')} className="hover:text-orange-500 flex-shrink-0">Mağaza</button>
            <span>/</span>
            {listing.category && (
              <><span className="truncate">{listing.category}</span><span>/</span></>
            )}
            <span className="text-gray-600 truncate">{listing.title}</span>
          </div>

          {/* Sepet Butonu */}
          <button
            onClick={() => navigate('/store')}
            className="relative flex items-center gap-1.5 text-gray-600 hover:text-orange-600 transition-colors"
            title="Sepete dön"
          >
            <span className="text-xl">🛒</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Ürün Detayı ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row">

            {/* Görsel */}
            <div className="md:w-2/5 flex-shrink-0 border-r border-gray-100">
              <div
                className="aspect-square flex items-center justify-center p-8"
                style={{
                  backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              >
                {listing.clean_image_url ? (
                  <img
                    src={listing.clean_image_url}
                    alt={listing.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-7xl opacity-20">🛍️</span>
                )}
              </div>
              <p className="text-center text-xs text-gray-400 pb-3">
                🤖 Görsel AI ile işlenmiştir
              </p>
            </div>

            {/* Bilgiler + Satın Al */}
            <div className="flex-1 p-6 flex flex-col gap-4">

              {/* Kategori + başlık */}
              {listing.category && (
                <span className="text-xs text-orange-500 font-medium uppercase tracking-wide">
                  {listing.category}
                </span>
              )}
              <h1 className="text-xl font-bold text-gray-900 leading-snug">{listing.title}</h1>

              {/* Puan */}
              <StarRating rating={listing.rating} />

              {/* Kısa açıklama */}
              {listing.short_desc && (
                <p className="text-sm text-gray-500 leading-relaxed border-b border-gray-100 pb-3">
                  {listing.short_desc}
                </p>
              )}

              {/* Fiyat kutusu */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 mb-0.5">Satış Fiyatı</p>
                <p className="text-3xl font-bold text-orange-600">
                  {listing.price ? `${fmt(listing.price)} ₺` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">KDV Dahil</p>
              </div>

              {/* Stok + Kargo */}
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Stok</p>
                  <p className={`text-sm font-semibold ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                    {inStock ? `${listing.stock} Adet Mevcut` : 'Tükendi'}
                  </p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">Kargo</p>
                  {cargoPrice > 0 ? (
                    <p className="text-sm font-semibold text-gray-700">{fmt(cargoPrice)} ₺ · Hızlı</p>
                  ) : (
                    <p className="text-sm font-semibold text-green-600">Ücretsiz Kargo 🎁</p>
                  )}
                </div>
              </div>

              {/* Öne çıkan özellikler */}
              {featureList.length > 0 && (
                <ul className="space-y-1.5">
                  {featureList.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-orange-400 flex-shrink-0 mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Miktar seçici */}
              {inStock && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-600 font-medium">Adet:</p>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-semibold text-gray-800">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                      className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors font-medium"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">(max {maxQty})</span>
                </div>
              )}

              {/* Toplam + Butonlar */}
              {inStock && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-3">
                    <span>
                      Toplam ({quantity} ürün
                      {customerCargo > 0 ? ` + ${fmt(customerCargo)} ₺ kargo` : ' · ücretsiz kargo'})
                    </span>
                    <span className="font-bold text-gray-800">{fmt(total)} ₺</span>
                  </div>

                  {orderErr && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-600">
                      ⚠️ {orderErr}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {/* Sepete Ekle */}
                    <button
                      onClick={handleAddToCart}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border-2
                        ${addedToCart
                          ? 'border-green-500 bg-green-50 text-green-600'
                          : 'border-orange-500 bg-white text-orange-600 hover:bg-orange-50'}`}
                    >
                      {addedToCart ? '✓ Sepete Eklendi' : '🛒 Sepete Ekle'}
                    </button>
                    {/* Hemen Satın Al */}
                    <button
                      onClick={handleOrder}
                      disabled={ordering}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
                        ${ordering
                          ? 'bg-orange-300 text-white cursor-wait'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md'}`}
                    >
                      {ordering ? '⏳ İşleniyor…' : '⚡ Hemen Al'}
                    </button>
                  </div>
                </div>
              )}

              {!inStock && (
                <div className="bg-gray-100 rounded-xl p-4 text-center text-gray-400 text-sm font-medium">
                  Bu ürün şu an stokta yok.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Detay Tabları ─────────────────────────────────────────────────── */}
        {(listing.long_desc || featureList.length > 0 || seoList.length > 0) && (
          <DetailTabs listing={listing} featureList={featureList} seoList={seoList} />
        )}

        {/* Geri */}
        <div className="mt-4 pb-6">
          <button
            onClick={() => navigate('/store')}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Mağazaya dön
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detay Tabları bileşeni ────────────────────────────────────────────────────
function DetailTabs({ listing, featureList, seoList }) {
  const [tab, setTab] = useState('desc')

  const tabs = [
    { key: 'desc',     label: 'Ürün Açıklaması' },
    { key: 'features', label: `Özellikler (${featureList.length})` },
    { key: 'tags',     label: 'Etiketler' },
  ].filter(t => {
    if (t.key === 'features') return featureList.length > 0
    if (t.key === 'tags')     return seoList.length > 0
    return true
  })

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === 'desc' && (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {listing.long_desc || <span className="text-gray-400">Açıklama eklenmemiş.</span>}
          </div>
        )}
        {tab === 'features' && (
          <table className="w-full text-sm">
            <tbody>
              {featureList.map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2.5 px-4 text-gray-400 w-8 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-4 text-gray-700">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'tags' && (
          <div className="flex flex-wrap gap-2">
            {seoList.map((tag, i) => (
              <span key={i} className="bg-orange-50 text-orange-600 text-xs font-medium px-3 py-1.5 rounded-full border border-orange-100">
                # {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
