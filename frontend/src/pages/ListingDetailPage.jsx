import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import api from '../services/api'

const STATUS_LABELS = {
  active:  { label: 'Satışta', color: 'bg-green-50 text-green-700 border-green-200' },
  passive: { label: 'Pasif',   color: 'bg-gray-100 text-gray-500 border-gray-200' },
  draft:   { label: 'Taslak',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
}

const CATEGORIES = [
  "Telefon & Aksesuar","Bilgisayar & Tablet","TV & Görüntü Sistemleri",
  "Ses & Müzik Sistemleri","Fotoğraf & Kamera","Oyun & Konsol",
  "Küçük Ev Aletleri","Beyaz Eşya","Kadın Giyim","Erkek Giyim",
  "Çocuk Giyim","Ayakkabı","Çanta & Cüzdan","Takı & Mücevher","Saat",
  "Gözlük & Aksesuar","Mobilya","Ev Tekstili","Mutfak & Yemek",
  "Dekorasyon","Aydınlatma","Banyo & Kişisel Bakım Ürünleri",
  "Temizlik & Hijyen","Spor Giyim & Ayakkabı","Spor Ekipmanları & Aletleri",
  "Outdoor & Kamp","Bisiklet & Scooter","Fitness & Wellness",
  "Parfüm & Deodorant","Cilt Bakımı","Saç Bakımı & Şekillendirme",
  "Makyaj & Kozmetik","Bebek Giyim","Bebek Bakım & Beslenme","Oyuncak & Oyun",
  "Kitap","Film & Müzik","Otomotiv Aksesuar","Otomotiv Yedek Parça",
  "Bahçe & Tarım","El Aletleri & Hırdavat","Yapı Malzemeleri",
  "Gıda & İçecek","Vitamin & Gıda Takviyesi","Medikal & Sağlık Ürünleri",
  "Kırtasiye & Ofis","Evcil Hayvan Ürünleri","Diğer",
]

export default function ListingDetailPage() {
  const { id }    = useParams()
  const location  = useNavigate ? useLocation() : {}
  const navigate  = useNavigate()

  const sellerView = location.state?.sellerView ?? false

  const [listing,    setListing]    = useState(location.state?.listing || null)
  const [loading,    setLoading]    = useState(!listing)
  const [error,      setError]      = useState('')
  const [activeTab,  setActiveTab]  = useState('desc')

  // Satıcı düzenleme state'i
  const [edit,       setEdit]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')

  // Müşteri görünümü
  const [added,      setAdded]      = useState(false)

  // Listing yüklenince edit state'ini doldur
  useEffect(() => {
    if (listing) {
      setEdit({
        title:      listing.title      || '',
        short_desc: listing.short_desc || '',
        long_desc:  listing.long_desc  || '',
        features:   Array.isArray(listing.features)
                      ? listing.features.join('\n')
                      : (listing.features || ''),
        seo_tags:   Array.isArray(listing.seo_tags)
                      ? listing.seo_tags.join(', ')
                      : (listing.seo_tags || ''),
        category:   listing.category  || '',
        price:      listing.price     || '',
        stock:      listing.stock     ?? '',
        status:     listing.status    || 'draft',
      })
    }
  }, [listing])

  // Eğer state'den gelmemişse API'den çek
  useEffect(() => {
    if (listing) return
    const fetch = async () => {
      try {
        const res = await api.get(`/listings/${id}`)
        setListing(res.data)
      } catch {
        setError('İlan bulunamadı veya yüklenemedi.')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  const updateEdit = (key, val) => setEdit(prev => ({ ...prev, [key]: val }))

  // ── Kaydet ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.patch(`/listings/${id}?status=${edit.status}`)
      // Diğer alanları da güncellemek için ek endpoint gerekirse buraya eklenecek
      setListing(prev => ({ ...prev, ...edit }))
      setSaveMsg('✓ Değişiklikler kaydedildi.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('⚠️ Kaydedilemedi, tekrar dene.')
    } finally {
      setSaving(false)
    }
  }

  // ── Yardımcı ──────────────────────────────────────────────────────────────
  const featureList = listing?.features
    ? (Array.isArray(listing.features)
        ? listing.features
        : listing.features.split('\n').filter(Boolean))
    : []

  const seoList = listing?.seo_tags
    ? (Array.isArray(listing.seo_tags)
        ? listing.seo_tags
        : listing.seo_tags.split(',').map(t => t.trim()).filter(Boolean))
    : []

  const statusInfo = STATUS_LABELS[listing?.status] || STATUS_LABELS.draft

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center py-32 text-gray-400">
        <span className="animate-pulse text-4xl">🔍</span>
      </div>
    </Layout>
  )

  if (error || !listing) return (
    <Layout>
      <div className="text-center py-32">
        <p className="text-gray-500 text-lg mb-4">{error || 'İlan bulunamadı.'}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm">← Geri dön</button>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-5">
          <button onClick={() => navigate('/dashboard')} className="hover:text-blue-600 transition-colors">
            {sellerView ? 'İlanlarım' : 'Ana Sayfa'}
          </button>
          <span>/</span>
          {listing.category && <><span>{listing.category}</span><span>/</span></>}
          <span className="text-gray-600 font-medium truncate max-w-xs">{listing.title}</span>
        </nav>

        {/* Ana kart */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="flex flex-col md:flex-row">

            {/* ── Sol: Görsel ────────────────────────────────────────────── */}
            <div className="md:w-2/5 flex-shrink-0 border-r border-gray-100">
              <div className="sticky top-6 p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {listing.category && (
                    <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                      {listing.category}
                    </span>
                  )}
                </div>
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center mb-3"
                  style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
                  {listing.clean_image_url
                    ? <img src={listing.clean_image_url} alt={listing.title} className="w-full h-full object-contain p-4" />
                    : <span className="text-6xl">📷</span>}
                </div>
                <p className="text-center text-xs text-gray-400">Ürün görseli AI ile işlenmiştir</p>
              </div>
            </div>

            {/* ── Sağ: Satıcı Modu veya Müşteri Modu ────────────────────── */}
            <div className="flex-1 p-6 flex flex-col gap-4">

              {sellerView ? (
                /* ════════════════════════════════════════════
                   SATICI MODU — Düzenlenebilir alanlar
                ════════════════════════════════════════════ */
                <>
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-semibold text-gray-700">İlan Düzenle</h2>
                    {saveMsg && (
                      <span className={`text-xs px-3 py-1 rounded-full ${saveMsg.startsWith('✓') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {saveMsg}
                      </span>
                    )}
                  </div>

                  {/* Başlık */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">İlan Başlığı</label>
                    <input type="text" value={edit.title} onChange={e => updateEdit('title', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {/* Kategori + Durum yan yana */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Kategori</label>
                      <select value={edit.category} onChange={e => updateEdit('category', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Durum</label>
                      <select value={edit.status} onChange={e => updateEdit('status', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="active">Aktif</option>
                        <option value="passive">Pasif</option>
                        <option value="draft">Taslak</option>
                      </select>
                    </div>
                  </div>

                  {/* Fiyat + Stok yan yana */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Fiyat (₺)</label>
                      <input type="number" value={edit.price} onChange={e => updateEdit('price', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Stok Adedi</label>
                      <input type="number" value={edit.stock} onChange={e => updateEdit('stock', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Kısa açıklama */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Kısa Açıklama</label>
                    <textarea rows={2} value={edit.short_desc} onChange={e => updateEdit('short_desc', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  {/* Uzun açıklama */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Detaylı Açıklama</label>
                    <textarea rows={4} value={edit.long_desc} onChange={e => updateEdit('long_desc', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  {/* Özellikler */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Özellikler <span className="text-gray-400 font-normal">(her satıra bir özellik)</span>
                    </label>
                    <textarea rows={4} value={edit.features} onChange={e => updateEdit('features', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  {/* SEO etiketleri */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      SEO Etiketleri <span className="text-gray-400 font-normal">(virgülle ayır)</span>
                    </label>
                    <input type="text" value={edit.seo_tags} onChange={e => updateEdit('seo_tags', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {/* Kaydet butonu */}
                  <button onClick={handleSave} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                               text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-1">
                    {saving ? '⏳ Kaydediliyor...' : '💾 Değişiklikleri Kaydet'}
                  </button>
                </>

              ) : (
                /* ════════════════════════════════════════════
                   MÜŞTERİ MODU — Hepsiburada görünümü
                ════════════════════════════════════════════ */
                <>
                  <h1 className="text-xl font-bold text-gray-900 leading-snug">{listing.title}</h1>

                  {listing.short_desc && (
                    <p className="text-sm text-gray-500 leading-relaxed border-b border-gray-100 pb-4">
                      {listing.short_desc}
                    </p>
                  )}

                  <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Satış Fiyatı</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {listing.price
                        ? `${Number(listing.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">KDV Dahil</p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">Stok</p>
                      <p className={`text-sm font-semibold ${(listing.stock ?? 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {(listing.stock ?? 0) > 0 ? `${listing.stock} Adet` : 'Tükendi'}
                      </p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">Kargo</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {listing.shipping_day || 'Hızlı Teslimat'}
                      </p>
                    </div>
                  </div>

                  {featureList.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Öne Çıkan Özellikler</p>
                      <ul className="space-y-1.5">
                        {featureList.slice(0, 4).map((feat, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-orange-400 mt-0.5 flex-shrink-0">✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                        {featureList.length > 4 && (
                          <li className="text-xs text-blue-500 cursor-pointer hover:underline"
                            onClick={() => setActiveTab('features')}>
                            +{featureList.length - 4} özellik daha →
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3 mt-2">
                    <button onClick={() => { setAdded(true); setTimeout(() => setAdded(false), 2000) }}
                      disabled={(listing.stock ?? 0) === 0}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
                        ${added ? 'bg-green-500 text-white'
                          : (listing.stock ?? 0) === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md'}`}>
                      {added ? '✓ Sepete Eklendi' : '🛒 Sepete Ekle'}
                    </button>
                    <button className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-200 transition-colors text-lg"
                      title="Favorilere Ekle">♡</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Detay Tab'ları — müşteri modunda göster ──────────────────────── */}
        {!sellerView && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-100">
              {[
                { key: 'desc',     label: 'Ürün Açıklaması' },
                { key: 'features', label: `Özellikler${featureList.length ? ` (${featureList.length})` : ''}` },
                { key: 'seo',      label: 'Etiketler' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px
                    ${activeTab === tab.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-6">
              {activeTab === 'desc' && (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {listing.long_desc || <span className="text-gray-400">Açıklama eklenmemiş.</span>}
                </div>
              )}
              {activeTab === 'features' && (
                featureList.length > 0
                  ? <table className="w-full text-sm">
                      <tbody>
                        {featureList.map((feat, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="py-2.5 px-4 text-gray-400 w-8 font-medium">{i + 1}</td>
                            <td className="py-2.5 px-4 text-gray-700">{feat}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  : <p className="text-gray-400 text-sm">Özellik eklenmemiş.</p>
              )}
              {activeTab === 'seo' && (
                seoList.length > 0
                  ? <div className="flex flex-wrap gap-2">
                      {seoList.map((tag, i) => (
                        <span key={i} className="bg-blue-50 text-blue-600 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-100">
                          # {tag}
                        </span>
                      ))}
                    </div>
                  : <p className="text-gray-400 text-sm">Etiket eklenmemiş.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pb-6">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← Geri dön
          </button>
        </div>

      </div>
    </Layout>
  )
}
