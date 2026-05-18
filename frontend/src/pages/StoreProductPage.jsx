/**
 * StoreProductPage — Müşteri Ürün Detay (Public)
 *
 * Ürünü gösterir, sepete ekleme sağlar.
 * Sipariş yalnızca sepet üzerinden verilebilir.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useCart } from '../context/CartContext'

const fmt = (n) =>
  Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Tam/yarım yıldız gösterimi */
function StarRating({ rating, count }) {
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
      {count != null && (
        <span className="text-xs text-gray-400">({count} değerlendirme)</span>
      )}
    </div>
  )
}

/** Küçük readonly yıldız */
function StarDisplay({ value }) {
  return (
    <span>
      {[1,2,3,4,5].map(s => (
        <span key={s} className={value >= s ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function StoreProductPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { addItem, totalItems } = useCart()

  const [listing,     setListing]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [quantity,    setQuantity]    = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const [reviews,     setReviews]     = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(r => setListing(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    api.get(`/reviews/listing/${id}`)
      .then(r => setReviews(r.data || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false))
  }, [id])

  const handleAddToCart = () => {
    if (!listing) return
    addItem(listing, quantity)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
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

  const inStock       = (listing?.stock ?? 0) > 0
  const maxQty        = Math.min(listing?.stock ?? 0, 10)
  const cargoPrice    = listing?.cargo_price ?? 29.90
  const customerCargo = cargoPrice > 0 ? cargoPrice : 0
  const total         = ((listing?.price ?? 0) * quantity + customerCargo).toFixed(2)

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

              {/* Puan + yorum sayısı */}
              <StarRating rating={listing.rating} count={reviewsLoading ? null : reviews.length} />

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

              {/* Toplam + Sepete Ekle */}
              {inStock && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-3">
                    <span>
                      Toplam ({quantity} ürün
                      {customerCargo > 0 ? ` + ${fmt(customerCargo)} ₺ kargo` : ' · ücretsiz kargo'})
                    </span>
                    <span className="font-bold text-gray-800">{fmt(total)} ₺</span>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all border-2
                      ${addedToCart
                        ? 'border-green-500 bg-green-50 text-green-600'
                        : 'border-orange-500 bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md'}`}
                  >
                    {addedToCart ? '✓ Sepete Eklendi' : '🛒 Sepete Ekle'}
                  </button>
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

        {/* ── Müşteri Yorumları ──────────────────────────────────────────────── */}
        <ReviewsSection reviews={reviews} loading={reviewsLoading} />

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

// ── Müşteri Yorumları Bölümü ──────────────────────────────────────────────────
function ReviewsSection({ reviews, loading }) {
  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Başlık */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">
          Müşteri Yorumları
          {!loading && reviews.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({reviews.length} yorum)
            </span>
          )}
        </h2>
        {!loading && reviews.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 text-sm">
              {'★'.repeat(Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length))}
            </span>
            <span className="text-xs text-gray-500 font-medium">
              {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} ort.
            </span>
          </div>
        )}
      </div>

      {/* İçerik */}
      <div className="p-6">
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-orange-400 rounded-full animate-spin" />
            Yorumlar yükleniyor…
          </div>
        )}

        {!loading && reviews.length === 0 && (
          <div className="text-center py-6">
            <div className="text-3xl mb-2 opacity-20">💬</div>
            <p className="text-sm text-gray-400">Henüz yorum yapılmamış. İlk yorumu sen yap!</p>
          </div>
        )}

        {!loading && reviews.length > 0 && (
          <div className="space-y-5">
            {reviews.map((r) => (
              <div key={r.id} className="flex gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-orange-500 text-xs font-bold">M</span>
                </div>
                {/* İçerik */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StarDisplay value={r.rating} />
                    <span className="text-[11px] text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Yorum yazılmamış.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
