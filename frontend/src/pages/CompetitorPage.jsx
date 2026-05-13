import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import api from '../services/api'

export default function CompetitorPage() {
  const navigate = useNavigate()

  const [listings,          setListings]          = useState([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState('')
  const [selectedCategory,  setSelectedCategory]  = useState('Tümü')
  const [search,            setSearch]            = useState('')

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/listings/all')
        setListings(res.data)
      } catch {
        setError('İlanlar yüklenemedi.')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  // Kategorileri türet
  const categories = ['Tümü', ...Array.from(new Set(listings.map(l => l.category).filter(Boolean)))]

  // Filtrele
  const filtered = listings
    .filter(l => selectedCategory === 'Tümü' || l.category === selectedCategory)
    .filter(l => !search || l.title?.toLowerCase().includes(search.toLowerCase()))

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">

        {/* Başlık */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Rakip İlanları</h2>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? 'Yükleniyor...' : `${listings.length} aktif ilan`}
          </p>
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
            <div className="text-4xl mb-3 animate-pulse">🔍</div>
            <p className="text-gray-400 text-sm">İlanlar yükleniyor...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Arama + Kategori filtreleri */}
            <div className="flex flex-col gap-3 mb-5">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="İlan ara..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 flex-wrap">
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
            </div>

            {/* Sonuç yok */}
            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                <p className="text-gray-400 text-sm">Bu kategoride ilan bulunamadı.</p>
              </div>
            )}

            {/* İlan grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(listing => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/listings/${listing.id}`, { state: { listing, sellerView: false } })}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                >
                  {/* Görsel */}
                  <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100"
                    style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '12px 12px' }}>
                    {listing.clean_image_url
                      ? <img src={listing.clean_image_url} alt={listing.title}
                          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300" />
                      : <span className="text-4xl">📷</span>
                    }
                  </div>

                  {/* Bilgiler */}
                  <div className="p-3">
                    {listing.category && (
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 mb-1.5 inline-block">
                        {listing.category}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                      {listing.title}
                    </p>

                    {/* Fiyat */}
                    <p className="text-base font-bold text-orange-600 mb-1.5">
                      {listing.price
                        ? `${Number(listing.price).toLocaleString('tr-TR')} ₺`
                        : '—'}
                    </p>

                    {/* Satış & Puan */}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      {listing.sales_count > 0 && (
                        <span>🛒 {listing.sales_count} satış</span>
                      )}
                      {listing.rating && (
                        <span className="text-yellow-500 font-medium">★ {Number(listing.rating).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
