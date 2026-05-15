/**
 * StorePage — Müşteri Vitrini (Public, auth gerektirmez)
 *
 * Tüm aktif ilanları Trendyol tarzı grid'de gösterir.
 * Kategori filtresi + arama + ürün kartları.
 * Tıklayınca /store/:id ürün detay sayfasına gider.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const CATEGORY_ALL = 'Tümü'

const fmt = (n) =>
  Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function StarRating({ rating }) {
  if (!rating) return <span className="text-xs text-gray-400">Henüz değerlendirme yok</span>
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <div className="flex items-center gap-1">
      <span className="text-yellow-400 text-sm">
        {'★'.repeat(full)}
        {half ? '½' : ''}
        {'☆'.repeat(empty)}
      </span>
      <span className="text-xs text-gray-400">({rating})</span>
    </div>
  )
}

function ProductCard({ listing, onClick }) {
  const inStock = (listing.stock ?? 0) > 0

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-orange-200 transition-all cursor-pointer group"
    >
      {/* Görsel */}
      <div
        className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative"
        style={{
          backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {listing.clean_image_url ? (
          <img
            src={listing.clean_image_url}
            alt={listing.title}
            className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-5xl opacity-30">🛍️</span>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Tükendi
            </span>
          </div>
        )}
        {listing.category && (
          <span className="absolute top-2 left-2 bg-white/90 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-100 truncate max-w-[120px]">
            {listing.category}
          </span>
        )}
      </div>

      {/* Bilgiler */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-gray-800 leading-snug mb-1.5 line-clamp-2 min-h-[2.5rem]">
          {listing.title}
        </h3>
        <StarRating rating={listing.rating} />
        <div className="mt-2 flex items-end justify-between">
          <p className="text-lg font-bold text-orange-600">
            {listing.price ? `${fmt(listing.price)} ₺` : '—'}
          </p>
          {inStock && (
            <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              Stokta {listing.stock} adet
            </span>
          )}
        </div>
        <p className="text-[10px] mt-1 font-medium
          {(listing.cargo_price ?? 29.90) <= 0 ? 'text-green-500' : 'text-gray-400'}">
          {(listing.cargo_price ?? 29.90) <= 0
            ? '🎁 Ücretsiz Kargo'
            : `Kargo: ${Number(listing.cargo_price ?? 29.90).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`}
        </p>
      </div>
    </div>
  )
}

export default function StorePage() {
  const navigate  = useNavigate()
  const { user, logout }           = useAuth()
  const { items, removeItem, updateQty, totalItems, totalPrice, clear } = useCart()

  const [listings,       setListings]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL)
  const [cartOpen,       setCartOpen]       = useState(false)
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [checkingOut,    setCheckingOut]    = useState(false)
  const [checkoutDone,   setCheckoutDone]   = useState(false)
  // Bakiye
  const [balance,        setBalance]        = useState(null)
  const [balanceModal,   setBalanceModal]   = useState(false)
  const [balanceInput,   setBalanceInput]   = useState('')
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceErr,     setBalanceErr]     = useState('')
  const profileRef = useRef(null)

  const isCustomer = user?.user_metadata?.user_type === 'customer'
  const userName   = user?.user_metadata?.store_name || user?.email?.split('@')[0] || 'Kullanıcı'
  const userInitial = userName.charAt(0).toUpperCase()

  // Bakiyeyi çek (müşteri girişliyse)
  useEffect(() => {
    if (!isCustomer || !user) return
    api.get('/auth/balance')
      .then(r => setBalance(r.data.balance))
      .catch(() => {})
  }, [isCustomer, user])

  const handleTopUp = async () => {
    const amt = parseInt(balanceInput, 10)
    if (!amt || amt <= 0) { setBalanceErr('Pozitif bir tam sayı gir.'); return }
    setBalanceErr('')
    setBalanceLoading(true)
    try {
      const r = await api.post('/auth/balance', { amount: amt })
      setBalance(r.data.balance)
      setBalanceInput('')
      setBalanceModal(false)
    } catch (e) {
      setBalanceErr(e?.response?.data?.detail || 'Hata oluştu.')
    } finally {
      setBalanceLoading(false)
    }
  }

  useEffect(() => {
    api.get('/listings/all')
      .then(r => setListings(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Profil dropdown'u dışına tıklayınca kapat
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Kategoriler
  const categories = [CATEGORY_ALL, ...Array.from(new Set(listings.map(l => l.category).filter(Boolean)))]

  // Filtrele
  const filtered = listings.filter(l => {
    const matchCat    = activeCategory === CATEGORY_ALL || l.category === activeCategory
    const matchSearch = !search || l.title?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // Sepetten sipariş ver
  const handleCheckout = async () => {
    if (!user) { navigate('/customer/login'); return }
    setCheckingOut(true)
    try {
      for (const item of items) {
        await api.post('/orders/', {
          listing_id: item.listing_id,
          quantity:   item.quantity,
          buyer_id:   isCustomer ? user.id : undefined,
        })
      }
      clear()
      setCheckoutDone(true)
      // Bakiyeyi yenile
      if (isCustomer) {
        api.get('/auth/balance').then(r => setBalance(r.data.balance)).catch(() => {})
      }
      setTimeout(() => { setCheckoutDone(false); setCartOpen(false) }, 3000)
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Sipariş oluşturulurken hata oluştu.'
      alert(msg)
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Bakiye Yükleme Modalı ────────────────────────────────────────── */}
      {balanceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <h3 className="font-bold text-gray-800 text-base mb-1">💰 Bakiye Yükle</h3>
            {balance !== null && (
              <p className="text-xs text-gray-400 mb-4">
                Mevcut bakiye: <span className="font-semibold text-orange-600">{Number(balance).toLocaleString('tr-TR')} ₺</span>
              </p>
            )}
            <input
              type="number"
              min="1"
              step="1"
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTopUp()}
              placeholder="Yüklenecek miktar (₺)"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent mb-3"
              autoFocus
            />
            {balanceErr && (
              <p className="text-xs text-red-500 mb-3">{balanceErr}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setBalanceModal(false); setBalanceInput(''); setBalanceErr('') }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleTopUp}
                disabled={balanceLoading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {balanceLoading ? '⏳' : 'Yükle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sepet Paneli (slide-over) ────────────────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-base">🛒 Sepetim ({totalItems})</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            {checkoutDone ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="text-5xl">✅</div>
                <p className="font-semibold text-gray-800">Siparişleriniz Alındı!</p>
                <p className="text-sm text-gray-400">Kargoya verildiğinde bildirim alacaksınız.</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="text-5xl opacity-30">🛒</div>
                <p className="text-gray-400 text-sm">Sepetiniz boş.</p>
                <button onClick={() => setCartOpen(false)} className="text-sm text-orange-500 hover:underline">
                  Alışverişe devam et →
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {items.map(item => (
                    <div key={item.listing_id} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                      {item.image
                        ? <img src={item.image} alt={item.title} className="w-14 h-14 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                        : <div className="w-14 h-14 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-xl flex-shrink-0">🛍️</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.title}</p>
                        <p className="text-orange-600 font-bold text-sm mt-0.5">{fmt(item.price)} ₺</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
                            <button onClick={() => updateQty(item.listing_id, item.quantity - 1)}
                              className="px-2 py-1 hover:bg-gray-100 text-gray-600">−</button>
                            <span className="px-2 font-semibold">{item.quantity}</span>
                            <button onClick={() => updateQty(item.listing_id, item.quantity + 1)}
                              className="px-2 py-1 hover:bg-gray-100 text-gray-600">+</button>
                          </div>
                          <button onClick={() => removeItem(item.listing_id)}
                            className="text-red-400 hover:text-red-600 text-xs">Sil</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Ara Toplam</span>
                    <span className="font-semibold text-gray-800">{fmt(totalPrice)} ₺</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kargo</span>
                    <span className="font-semibold text-gray-800">
                      {items.every(i => (i.cargo_price ?? 29.90) <= 0)
                        ? <span className="text-green-600">Ücretsiz</span>
                        : `${fmt(items.reduce((s, i) => s + Math.max(i.cargo_price ?? 29.90, 0), 0))} ₺`}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
                    <span>Toplam</span>
                    <span className="text-orange-600">
                      {fmt(totalPrice + items.reduce((s, i) => s + Math.max(i.cargo_price ?? 29.90, 0), 0))} ₺
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={checkingOut}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    {checkingOut ? '⏳ İşleniyor…' : '⚡ Siparişi Ver'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer" onClick={() => navigate('/store')}>
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">S</div>
            <span className="font-bold text-gray-800 text-lg">
              Seller<span className="text-orange-500">AI</span>
              <span className="font-normal text-gray-400 text-sm ml-1">Mağaza</span>
            </span>
          </div>

          {/* Arama */}
          <div className="flex-1 max-w-xl relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          </div>

          {/* ── Sağ butonlar ── */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Satıcı Girişi — her durumda görünür */}
            <button
              onClick={() => navigate('/login')}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-xl transition-colors flex-shrink-0"
            >
              🏪 Satıcı Girişi
            </button>

            {isCustomer ? (
              /* Müşteri giriş yapmış */
              <>
                {/* Sepet */}
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-600 transition-colors"
                  title="Sepet"
                >
                  🛒
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {totalItems > 9 ? '9+' : totalItems}
                    </span>
                  )}
                </button>

                {/* Profil */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(p => !p)}
                    className="flex items-center gap-2 border border-gray-200 hover:border-orange-300 rounded-xl px-3 py-2 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                      {userInitial}
                    </div>
                    <span className="text-xs text-gray-700 font-medium max-w-[80px] truncate">{userName}</span>
                    <span className="text-gray-400 text-xs">{profileOpen ? '▲' : '▼'}</span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                      {/* Kullanıcı bilgisi */}
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-800 truncate">{userName}</p>
                        <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                        <span className="inline-block mt-1 text-[10px] bg-orange-100 text-orange-600 font-medium px-2 py-0.5 rounded-full">
                          Müşteri
                        </span>
                      </div>
                      {/* Bakiye */}
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-gray-400">Bakiye</p>
                            <p className="text-sm font-bold text-gray-800">
                              {balance !== null
                                ? `${Number(balance).toLocaleString('tr-TR')} ₺`
                                : '—'}
                            </p>
                          </div>
                          <button
                            onClick={() => { setProfileOpen(false); setBalanceModal(true) }}
                            className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white font-medium px-2.5 py-1 rounded-lg transition-colors"
                          >
                            + Yükle
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={async () => { await logout(); window.location.href = '/store' }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Çıkış Yap
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : user ? (
              /* Satıcı yanlışlıkla store'a girmiş → panele dön */
              <button
                onClick={() => navigate('/dashboard')}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors font-medium"
              >
                Panele Dön →
              </button>
            ) : (
              /* Giriş yapılmamış */
              <>
                <button
                  onClick={() => setCartOpen(true)}
                  className="relative w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-600 transition-colors"
                >
                  🛒
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {totalItems > 9 ? '9+' : totalItems}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => navigate('/customer/login')}
                  className="text-xs text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-xl transition-colors font-medium"
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => navigate('/customer/register')}
                  className="text-xs text-orange-600 border border-orange-300 hover:bg-orange-50 px-3 py-2 rounded-xl transition-colors"
                >
                  Üye Ol
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── İçerik ──────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Kategori filtreleri */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 text-xs font-medium px-4 py-2 rounded-full border transition-colors whitespace-nowrap
                ${activeCategory === cat
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sonuç sayısı */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {loading ? 'Yükleniyor…' : `${filtered.length} ürün bulundu`}
            {search && <span className="text-orange-500"> — "{search}"</span>}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-5 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500">Aradığınız kriterlere uygun ürün bulunamadı.</p>
            <button
              onClick={() => { setSearch(''); setActiveCategory(CATEGORY_ALL) }}
              className="mt-3 text-sm text-orange-500 hover:underline"
            >
              Filtreleri temizle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(l => (
              <ProductCard
                key={l.id}
                listing={l}
                onClick={() => navigate(`/store/${l.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
