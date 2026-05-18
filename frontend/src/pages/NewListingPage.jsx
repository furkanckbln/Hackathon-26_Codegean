import { useState, useRef, useEffect } from 'react'
import Layout from '../components/shared/Layout'
import api from '../services/api'

const CATEGORIES = [
  "Telefon & Aksesuar",
  "Bilgisayar & Tablet",
  "TV & Görüntü Sistemleri",
  "Ses & Müzik Sistemleri",
  "Fotoğraf & Kamera",
  "Oyun & Konsol",
  "Küçük Ev Aletleri",
  "Beyaz Eşya",
  "Kadın Giyim",
  "Erkek Giyim",
  "Çocuk Giyim",
  "Ayakkabı",
  "Çanta & Cüzdan",
  "Takı & Mücevher",
  "Saat",
  "Gözlük & Aksesuar",
  "Mobilya",
  "Ev Tekstili",
  "Mutfak & Yemek",
  "Dekorasyon",
  "Aydınlatma",
  "Banyo & Kişisel Bakım Ürünleri",
  "Temizlik & Hijyen",
  "Spor Giyim & Ayakkabı",
  "Spor Ekipmanları & Aletleri",
  "Outdoor & Kamp",
  "Bisiklet & Scooter",
  "Fitness & Wellness",
  "Parfüm & Deodorant",
  "Cilt Bakımı",
  "Saç Bakımı & Şekillendirme",
  "Makyaj & Kozmetik",
  "Bebek Giyim",
  "Bebek Bakım & Beslenme",
  "Oyuncak & Oyun",
  "Kitap",
  "Film & Müzik",
  "Otomotiv Aksesuar",
  "Otomotiv Yedek Parça",
  "Bahçe & Tarım",
  "El Aletleri & Hırdavat",
  "Yapı Malzemeleri",
  "Gıda & İçecek",
  "Vitamin & Gıda Takviyesi",
  "Medikal & Sağlık Ürünleri",
  "Kırtasiye & Ofis",
  "Evcil Hayvan Ürünleri",
  "Diğer",
]

const TONES = [
  { id: 'professional', label: '🏢 Profesyonel', desc: 'Kurumsal ve güven verici' },
  { id: 'friendly',     label: '😊 Samimi',       desc: 'Sıcak ve yakın' },
  { id: 'youth',        label: '🔥 Genç Kitle',   desc: 'Enerjik ve trend' },
]

const EMPTY_FORM = {
  title:       '',
  shortDesc:   '',
  longDesc:    '',
  features:    '',
  seoTags:     '',
  brand:       '',
  price:       '',
  costPrice:   '',
  cargoPrice:  '29.90',
  stock:       '',
  variant:     '',
  shippingDay: '',
}

export default function NewListingPage() {
  // ── Görsel ──────────────────────────────────────────────────────────────────
  const [originalImage,   setOriginalImage]   = useState(null)
  const [originalFile,    setOriginalFile]    = useState(null)
  const [isDragging,      setIsDragging]      = useState(false)
  const fileInputRef = useRef()

  // ── YOLO ────────────────────────────────────────────────────────────────────
  const [yoloLoading,     setYoloLoading]     = useState(false)
  const [cleanImage,      setCleanImage]      = useState(null)

  // ── Kategori — Gemini tarafından tespit edilir ───────────────────────────
  const [category,        setCategory]        = useState('')

  // ── Form ────────────────────────────────────────────────────────────────────
  const [tone,            setTone]            = useState('professional')
  const [form,            setForm]            = useState(EMPTY_FORM)
  const [aiLoading,       setAiLoading]       = useState(false)
  const [aiDone,          setAiDone]          = useState(false)
  const [publishLoading,  setPublishLoading]  = useState(false)
  const [publishDone,     setPublishDone]     = useState(false)

  // ── Chat Panel ──────────────────────────────────────────────────────────────
  const [chatOpen,        setChatOpen]        = useState(false)
  const [chatInput,       setChatInput]       = useState('')
  const [chatMessages,    setChatMessages]    = useState([
    { role: 'ai', text: 'Merhaba! İlan içeriği hakkında değişiklik yapmamı ister misin? Örn: "başlığı daha kısa yap", "açıklamaya garanti bilgisi ekle"' }
  ])
  const [chatLoading,     setChatLoading]     = useState(false)
  const chatBottomRef = useRef()

  // Chat açıldığında en alta scroll
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [chatOpen, chatMessages])

  // ── Görsel işlemleri ────────────────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setOriginalFile(file)
    setCleanImage(null); setCategory('')
    setAiDone(false); setForm(EMPTY_FORM)
    const reader = new FileReader()
    reader.onload = (e) => setOriginalImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const onFileChange = (e)  => handleFile(e.target.files[0])
  const onDrop       = (e)  => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]) }
  const onDragOver   = (e)  => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave  = ()   => setIsDragging(false)

  // ── YOLO ────────────────────────────────────────────────────────────────────
  const [yoloError, setYoloError] = useState('')
  const [listingId, setListingId] = useState(null)

  const handleYolo = async () => {
    if (!originalFile) return
    setYoloLoading(true)
    setYoloError('')
    try {
      const formData = new FormData()
      formData.append('image', originalFile)

      const res = await api.post('/listings/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setListingId(res.data.listing_id)
      setCleanImage(res.data.clean_image_url)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Görsel AI ile temizlenemedi. Lütfen tekrar deneyin.'
      setYoloError(msg)
    } finally {
      setYoloLoading(false)
    }
  }

  // ── Gemini — AI Doldur ──────────────────────────────────────────────────────
  const [aiError, setAiError] = useState('')

  const handleAiFill = async () => {
    if (!cleanImage) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await api.post('/listings/generate', {
        listing_id:      listingId,
        clean_image_url: cleanImage,
        tone:            tone,
        brand:           form.brand || '',
        price:           form.price || '',
        extra_note:      '',
      })
      const d = res.data
      // Kategori Gemini'den geliyor
      if (d.category) setCategory(d.category)
      setForm(prev => ({
        ...prev,
        title:     d.title      || prev.title,
        shortDesc: d.short_desc || prev.shortDesc,
        longDesc:  d.long_desc  || prev.longDesc,
        features:  d.features   || prev.features,
        seoTags:   d.seo_tags   || prev.seoTags,
      }))
      setAiDone(true)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Gemini içerik üretimi başarısız oldu.'
      setAiError(msg)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Chat — Prompt gönder ────────────────────────────────────────────────────
  const handleChatSend = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)

    try {
      const res = await api.post('/chat/listing', {
        message:      msg,
        current_form: {
          title:     form.title,
          shortDesc: form.shortDesc,
          longDesc:  form.longDesc,
          features:  form.features,
          seoTags:   form.seoTags,
        },
        category: category,
        tone:     tone,
      })

      const { updated_form, reply } = res.data

      // Sadece değişen alanları forma uygula
      if (updated_form && Object.keys(updated_form).length > 0) {
        setForm(prev => ({
          ...prev,
          ...(updated_form.title     && { title:     updated_form.title }),
          ...(updated_form.shortDesc && { shortDesc: updated_form.shortDesc }),
          ...(updated_form.longDesc  && { longDesc:  updated_form.longDesc }),
          ...(updated_form.features  && { features:  updated_form.features }),
          ...(updated_form.seoTags   && { seoTags:   updated_form.seoTags }),
        }))
      }

      setChatMessages(prev => [...prev, { role: 'ai', text: reply || '✅ Güncellendi.' }])
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Bir hata oluştu, tekrar dener misin?'
      setChatMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${errMsg}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleChatKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend() }
  }

  // ── Yayınla ─────────────────────────────────────────────────────────────────
  const [publishError, setPublishError] = useState('')

  const handlePublish = async () => {
    setPublishLoading(true)
    setPublishError('')
    try {
      await api.post('/listings/', {
        listing_id:      listingId,
        title:           form.title,
        short_desc:      form.shortDesc,
        long_desc:       form.longDesc,
        features:        form.features,
        seo_tags:        form.seoTags,
        category:        category,
        price:           parseFloat(form.price)      || 0,
        cost_price:      parseFloat(form.costPrice)  || 0,
        cargo_price:     parseFloat(form.cargoPrice) ?? 29.90,
        stock:           parseInt(form.stock)        || 0,
        clean_image_url: cleanImage,
      })
      setPublishDone(true)
    } catch (err) {
      const msg = err.response?.data?.detail || 'İlan yayınlanamadı.'
      setPublishError(msg)
    } finally {
      setPublishLoading(false)
    }
  }

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const resetAll = () => {
    setOriginalImage(null); setOriginalFile(null); setCleanImage(null)
    setCategory(''); setAiDone(false)
    setForm(EMPTY_FORM); setPublishDone(false)
    setChatMessages([{ role: 'ai', text: 'Merhaba! İlan içeriği hakkında değişiklik yapmamı ister misin?' }])
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Yeni İlan Oluştur</h2>
          <p className="text-gray-500 text-sm mt-1">Ürün görselini yükle, AI geri kalanını halleder.</p>
        </div>

        {publishDone ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-20 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">İlan Yayınlandı!</h3>
            <p className="text-gray-500 text-sm mb-6">İlanın başarıyla oluşturuldu.</p>
            <button onClick={resetAll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
              Yeni İlan Oluştur
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── BÖLÜM 1: Görsel ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                Ürün Görseli Yükle
              </h3>
              {!originalImage ? (
                <div
                  onClick={() => fileInputRef.current.click()}
                  onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                    ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                >
                  <div className="text-4xl mb-3">📸</div>
                  <p className="text-gray-600 font-medium">Görseli buraya sürükle ya da tıkla</p>
                  <p className="text-gray-400 text-sm mt-1">JPG, PNG — Maks. 10MB</p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                </div>
              ) : (
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Yüklenen Görsel</p>
                    <img src={originalImage} alt="Orijinal" className="w-48 h-48 object-cover rounded-xl border border-gray-200" />
                  </div>
                  <div className="flex-1 pt-2">
                    <button onClick={() => { setOriginalImage(null); setOriginalFile(null); setCleanImage(null); setCategory('') }}
                      className="text-sm text-red-500 hover:text-red-600 mb-4 block">
                      ✕ Görseli Kaldır
                    </button>
                    <button onClick={handleYolo} disabled={yoloLoading || !!cleanImage}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors
                        ${cleanImage
                          ? 'bg-green-50 text-green-600 border border-green-200 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white'}`}>
                      {yoloLoading ? <><span className="animate-spin">⏳</span> Arka plan temizleniyor...</>
                        : cleanImage ? <><span>✅</span> Arka Plan Temizlendi</>
                        : <><span>🪄</span> Arka Planı Temizle</>}
                    </button>
                    {!cleanImage && !yoloLoading && !yoloError && (
                      <p className="text-gray-400 text-xs mt-3">AI modeli görselin arka planını otomatik temizler. Kategori tespiti bir sonraki adımda Gemini tarafından yapılır.</p>
                    )}
                    {yoloError && (
                      <p className="text-red-500 text-xs mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        ⚠️ {yoloError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── BÖLÜM 2: YOLO Sonucu ────────────────────────────────────── */}
            {cleanImage && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                  Arka Plan Temizlendi
                </h3>
                <div className="flex items-start gap-8">
                  <div>
                    <p className="text-xs text-gray-400 mb-2 font-medium">Temizlenmiş Görsel</p>
                    <img src={cleanImage} alt="Temiz" className="w-48 h-48 object-cover rounded-xl border border-gray-200 bg-gray-50" />
                  </div>
                  <div className="flex-1 pt-1">
                    {category ? (
                      <>
                        <p className="text-xs text-gray-400 mb-2 font-medium">Gemini'nin Tespit Ettiği Kategori</p>
                        <span className="bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-blue-200 inline-block mb-4">
                          {category}
                        </span>
                        <p className="text-xs text-gray-400 mb-1.5 font-medium">Yanlışsa listeden seç</p>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 text-sm mt-4">
                        <span>✨</span>
                        <span>Kategori, "AI ile Doldur" adımında Gemini tarafından görselden otomatik tespit edilecek.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── BÖLÜM 3: İlan Bilgileri ─────────────────────────────────── */}
            {cleanImage && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-700 mb-5 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                  İlan Bilgileri
                </h3>

                {/* Satıcı alanları */}
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Marka <span className="text-red-400">*</span></label>
                    <input type="text" value={form.brand} onChange={e => updateForm('brand', e.target.value)}
                      placeholder="Nike, Samsung..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Stok Adedi <span className="text-red-400">*</span></label>
                    <input type="number" value={form.stock} onChange={e => updateForm('stock', e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Satış Fiyatı (₺) <span className="text-red-400">*</span>
                    </label>
                    <input type="number" value={form.price} onChange={e => updateForm('price', e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Maliyet Fiyatı (₺)
                      <span className="text-gray-400 font-normal ml-1">— kâr hesabı için</span>
                    </label>
                    <input type="number" value={form.costPrice} onChange={e => updateForm('costPrice', e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Kargo Ücreti (₺)
                      <span className="text-gray-400 font-normal ml-1">— pozitif: müşteri öder · negatif: satıcı karşılar · 0: ücretsiz</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.cargoPrice}
                      onChange={e => updateForm('cargoPrice', e.target.value)}
                      placeholder="29.90"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {form.cargoPrice !== '' && (
                      <p className="mt-1 text-[11px] font-medium
                        ${parseFloat(form.cargoPrice) < 0 ? 'text-orange-500' : parseFloat(form.cargoPrice) === 0 ? 'text-green-600' : 'text-blue-500'}">
                        {parseFloat(form.cargoPrice) < 0
                          ? `Satıcı ${Math.abs(parseFloat(form.cargoPrice)).toFixed(2)} ₺ kargo üstleniyor — finance_records'a gider kaydı gider`
                          : parseFloat(form.cargoPrice) === 0
                          ? 'Ücretsiz kargo — satıcı karşılar, gider kaydı tutulmaz'
                          : `Müşteri ${parseFloat(form.cargoPrice).toFixed(2)} ₺ kargo öder`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ton seçimi */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-600 mb-2">AI İçerik Tonu</label>
                  <div className="flex gap-3">
                    {TONES.map(t => (
                      <button key={t.id} onClick={() => setTone(t.id)}
                        className={`flex-1 py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors text-left
                          ${tone === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                        <div>{t.label}</div>
                        <div className="text-xs font-normal opacity-70 mt-0.5">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Doldur */}
                {!aiDone && (
                  <>
                    <button onClick={handleAiFill} disabled={aiLoading}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500
                                 hover:from-blue-700 hover:to-blue-600 disabled:opacity-60
                                 text-white font-semibold py-3 rounded-xl text-sm transition-all mb-2">
                      {aiLoading
                        ? <><span className="animate-spin inline-block">⏳</span> Gemini içerik üretiyor...</>
                        : <><span>✨</span> AI ile Doldur</>}
                    </button>
                    {aiError && (
                      <p className="text-red-500 text-xs mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        ⚠️ {aiError}
                      </p>
                    )}
                  </>
                )}

                {/* AI alanları */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">İlan Başlığı</label>
                    <input type="text" value={form.title} onChange={e => updateForm('title', e.target.value)}
                      placeholder="AI dolduracak..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Kısa Açıklama</label>
                    <textarea rows={2} value={form.shortDesc} onChange={e => updateForm('shortDesc', e.target.value)}
                      placeholder="AI dolduracak..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Detaylı Açıklama</label>
                    <textarea rows={4} value={form.longDesc} onChange={e => updateForm('longDesc', e.target.value)}
                      placeholder="AI dolduracak..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ürün Özellikleri <span className="text-gray-400 font-normal">(her satıra bir özellik)</span></label>
                    <textarea rows={4} value={form.features} onChange={e => updateForm('features', e.target.value)}
                      placeholder="AI dolduracak..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SEO Etiketleri <span className="text-gray-400 font-normal">(virgülle ayır)</span></label>
                    <input type="text" value={form.seoTags} onChange={e => updateForm('seoTags', e.target.value)}
                      placeholder="AI dolduracak..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Varyant <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
                      <input type="text" value={form.variant} onChange={e => updateForm('variant', e.target.value)}
                        placeholder="S, M, L / Siyah, Beyaz..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Kargo Süresi <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
                      <input type="text" value={form.shippingDay} onChange={e => updateForm('shippingDay', e.target.value)}
                        placeholder="1-3 iş günü"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Aksiyon butonları */}
                <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
                  {aiDone && (
                    <button onClick={handleAiFill} disabled={aiLoading}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-blue-300 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      {aiLoading ? <><span className="animate-spin inline-block">⏳</span> Üretiliyor...</> : '🔄 Yeniden Üret'}
                    </button>
                  )}
                  <div className="ml-auto flex flex-col items-end gap-1">
                    {publishError && (
                      <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                        ⚠️ {publishError}
                      </p>
                    )}
                    <button
                      onClick={handlePublish}
                      disabled={publishLoading || !form.title || !form.price || !form.stock}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300
                                 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors">
                      {publishLoading ? 'Yayınlanıyor...' : '🚀 Yayınla'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FLOATING CHAT ─────────────────────────────────────────────────────── */}

      {/* Chat paneli — sağdan kayar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200
                       flex flex-col transition-transform duration-300 z-40
                       ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-blue-600">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <div>
              <p className="text-white font-semibold text-sm">AI Asistan</p>
              <p className="text-blue-200 text-xs">İlan içeriğini düzenle</p>
            </div>
          </div>
          <button onClick={() => setChatOpen(false)}
            className="text-white hover:text-blue-200 text-xl leading-none p-1">
            ✕
          </button>
        </div>

        {/* Mesajlar */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-700 rounded-bl-sm'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Örnek promptlar */}
        {chatMessages.length <= 2 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-400 mb-2">Örnek istekler:</p>
            <div className="flex flex-wrap gap-1.5">
              {['Başlığı kısalt', 'Garanti bilgisi ekle', 'SEO etiketlerini genişlet', 'Açıklamayı kısalt'].map(s => (
                <button key={s} onClick={() => setChatInput(s)}
                  className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-2.5 py-1 rounded-full transition-colors border border-gray-200">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input alanı */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2 items-end">
            <textarea
              rows={2}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKey}
              placeholder="Değişiklik iste... (Enter ile gönder)"
              disabled={!aiDone}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
                         disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading || !aiDone}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white
                         p-2.5 rounded-xl transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {!aiDone && <p className="text-xs text-gray-400 mt-1.5">Önce "AI ile Doldur" butonuna bas.</p>}
        </div>
      </div>

      {/* Overlay — chat açıkken arka planı karartır */}
      {chatOpen && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setChatOpen(false)} />
      )}

      {/* Floating buton */}
      <button
        onClick={() => setChatOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700
                    text-white rounded-full shadow-lg hover:shadow-xl
                    flex items-center justify-center text-2xl transition-all z-50
                    ${chatOpen ? 'scale-0' : 'scale-100'}`}
        title="AI Asistan"
      >
        💬
      </button>
    </Layout>
  )
}
