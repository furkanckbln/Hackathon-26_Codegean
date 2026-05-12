import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import api from '../services/api'

const STATUS_LABELS = {
  active:  { label: 'Aktif',   color: 'bg-green-50 text-green-700 border-green-200' },
  passive: { label: 'Pasif',   color: 'bg-gray-100 text-gray-500 border-gray-200' },
  draft:   { label: 'Taslak',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const [listings,        setListings]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Tümü')
  const [deletingId,      setDeletingId]      = useState(null)
  const [statusLoadingId, setStatusLoadingId] = useState(null)

  // ── İlanları çek ──────────────────────────────────────────────────────────
  const fetchListings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/listings/')
      setListings(res.data)
    } catch (err) {
      setError('İlanlar yüklenemedi. Lütfen sayfayı yenile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchListings() }, [])

  // ── Kategorileri listeden türet ────────────────────────────────────────────
  const categories = ['Tümü', ...Array.from(new Set(listings.map(l => l.category).filter(Boolean)))]

  // ── Seçili kategoriye göre filtrele ───────────────────────────────────────
  const filtered = selectedCategory === 'Tümü'
    ? listings
    : listings.filter(l => l.category === selectedCategory)

  // ── Durum güncelle ────────────────────────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    setStatusLoadingId(id)
    try {
      await api.patch(`/listings/${id}?status=${newStatus}`)
      setListings(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    } catch {
      alert('Durum güncellenemedi.')
    } finally {
      setStatusLoadingId(null)
    }
  }

  // ── İlan sil ──────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Bu ilanı silmek istediğine emin misin?')) return
    setDeletingId(id)
    try {
      await api.delete(`/listings/${id}`)
      setListings(prev => prev.filter(l => l.id !== id))
      // Silinen ilan seçili kategorideki son ilansa Tümü'ne dön
      const remaining = listings.filter(l => l.id !== id)
      const stillHasCategory = remaining.some(l => l.category === selectedCategory)
      if (!stillHasCategory && selectedCategory !== 'Tümü') setSelectedCategory('Tümü')
    } catch {
      alert('İlan silinemedi.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-5xl mx-auto">

        {/* Başlık */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">İlanlarım</h2>
            <p className="text-gray-500 text-sm mt-1">
              {loading ? 'Yükleniyor...' : `${listings.length} ilan`}
            </p>
          </div>
          <button
            onClick={() => navigate('/new-listing')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            <span>+</span> Yeni İlan
          </button>
        </div>

        {/* Hata */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
            ⚠️ {error}
          </div>
        )}

        {/* Yükleniyor */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 py-20 text-center">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p className="text-gray-400 text-sm">İlanlar yükleniyor...</p>
          </div>
        )}

        {/* İlan yok */}
        {!loading && listings.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-20 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 font-medium">Henüz ilan yok</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">İlk ilanını oluşturmak için "Yeni İlan Oluştur" menüsüne git.</p>
            <button
              onClick={() => navigate('/new-listing')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              + Yeni İlan Oluştur
            </button>
          </div>
        )}

        {/* İlanlar var */}
        {!loading && listings.length > 0 && (
          <>
            {/* Kategori filtreleri */}
            <div className="flex gap-2 flex-wrap mb-5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border
                    ${selectedCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'}`}
                >
                  {cat}
                  {cat !== 'Tümü' && (
                    <span className={`ml-1.5 text-xs ${selectedCategory === cat ? 'text-blue-200' : 'text-gray-400'}`}>
                      {listings.filter(l => l.category === cat).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Seçili kategoride ilan yoksa */}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                <p className="text-gray-400 text-sm">Bu kategoride ilan yok.</p>
              </div>
            )}

            {/* İlan kartları */}
            <div className="grid grid-cols-1 gap-4">
              {filtered.map(listing => {
                const statusInfo = STATUS_LABELS[listing.status] || STATUS_LABELS.draft
                const isDeleting = deletingId === listing.id
                const isStatusLoading = statusLoadingId === listing.id

                return (
                  <div key={listing.id}
                    className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-5 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => navigate(`/listings/${listing.id}`, { state: { listing, sellerView: true } })}>

                    {/* Görsel */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                      {listing.clean_image_url
                        ? <img src={listing.clean_image_url} alt={listing.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">📷</div>
                      }
                    </div>

                    {/* Bilgiler */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <p className="font-semibold text-gray-800 text-sm leading-snug truncate flex-1">
                          {listing.title || 'Başlıksız İlan'}
                        </p>
                        <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                        {listing.category && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {listing.category}
                          </span>
                        )}
                        <span className="font-medium text-gray-700">
                          {listing.price ? `₺${Number(listing.price).toLocaleString('tr-TR')}` : '—'}
                        </span>
                        <span>Stok: {listing.stock ?? '—'}</span>
                      </div>

                      {/* Aksiyon butonları */}
                      <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                        {/* Durum değiştir */}
                        {listing.status !== 'active' && (
                          <button
                            onClick={() => handleStatusChange(listing.id, 'active')}
                            disabled={isStatusLoading}
                            className="text-xs px-3 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                          >
                            {isStatusLoading ? '...' : '✓ Aktif Et'}
                          </button>
                        )}
                        {listing.status !== 'passive' && (
                          <button
                            onClick={() => handleStatusChange(listing.id, 'passive')}
                            disabled={isStatusLoading}
                            className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            {isStatusLoading ? '...' : '⏸ Pasife Al'}
                          </button>
                        )}
                        {listing.status !== 'draft' && (
                          <button
                            onClick={() => handleStatusChange(listing.id, 'draft')}
                            disabled={isStatusLoading}
                            className="text-xs px-3 py-1 rounded-lg border border-yellow-200 text-yellow-700 hover:bg-yellow-50 transition-colors disabled:opacity-50"
                          >
                            {isStatusLoading ? '...' : '✎ Taslağa Al'}
                          </button>
                        )}

                        {/* Sil */}
                        <button
                          onClick={() => handleDelete(listing.id)}
                          disabled={isDeleting}
                          className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto"
                        >
                          {isDeleting ? 'Siliniyor...' : '🗑 Sil'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
