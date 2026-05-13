import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/shared/Layout'
import api from '../services/api'

export default function SalesAssistantPage() {
  const [summary,  setSummary]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Chat state (backend bağlantısı sonra yapılacak)
  const [messages,    setMessages]    = useState([
    { role: 'ai', text: 'Merhaba! Ben satış asistanınım. İlanlarını, rakip verileri ve sektör trendlerini analiz ederek sana önerilerde bulunabilirim. Ne öğrenmek istersin?' }
  ])
  const [input,       setInput]       = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef()

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Özet verisini çek ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/assistant/summary')
        setSummary(res.data)
      } catch {
        setError('Özet verisi yüklenemedi.')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || chatLoading) return

    const newHistory = [...messages, { role: 'user', text: msg }]
    setInput('')
    setMessages(newHistory)
    setChatLoading(true)

    try {
      const res = await api.post('/assistant/chat', {
        message: msg,
        history: messages.slice(-10),   // son 10 mesaj
        context: summary || {},
      })
      setMessages(prev => [...prev, { role: 'ai', text: res.data.reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '⚠️ Bir hata oluştu, tekrar dener misin?'
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Satıcının kategorisindeki sektör ortalamasını bul ────────────────────
  const getCategoryInsight = (listing) => {
    if (!summary?.category_avgs || !listing.category) return null
    const avg = summary.category_avgs[listing.category]
    if (!avg?.avg_price) return null
    const diff = ((listing.price - avg.avg_price) / avg.avg_price * 100).toFixed(0)
    if (diff > 10)  return { text: `Sektör ort. %${diff} üzerinde`, color: 'text-red-500' }
    if (diff < -10) return { text: `Sektör ort. %${Math.abs(diff)} altında`, color: 'text-green-600' }
    return { text: 'Sektör ortalamasında', color: 'text-gray-400' }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col">

        {/* Başlık */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Satış Asistanı</h2>
          <p className="text-gray-500 text-sm mt-1">İlan performansını analiz et, rakiplerle kıyasla, büyü.</p>
        </div>

        {/* Ana layout: Sol özet + Sağ chat */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* ── Sol Panel: Hızlı Özet ──────────────────────────────────────── */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">

            {loading && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <p className="text-gray-400 text-sm animate-pulse">Veriler yükleniyor...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-500 text-xs rounded-xl px-4 py-3">
                ⚠️ {error}
              </div>
            )}

            {summary && (
              <>
                {/* Genel İstatistikler */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Genel Durum</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{summary.my_stats.active_listings}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Aktif İlan</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{summary.my_stats.total_sales}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Toplam Satış</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {summary.my_stats.avg_rating ? `★ ${summary.my_stats.avg_rating}` : '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Ort. Puan</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">{summary.my_stats.total_listings}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Toplam İlan</p>
                    </div>
                  </div>
                </div>

                {/* En Çok Satan İlanlarım */}
                {summary.top_listings.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      🏆 En Çok Satan İlanlarım
                    </p>
                    <div className="space-y-2.5">
                      {summary.top_listings.map((l, i) => {
                        const insight = getCategoryInsight(l)
                        return (
                          <div key={l.id} className="flex items-center gap-3">
                            <span className={`text-sm font-bold w-5 flex-shrink-0
                              ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-orange-400'}`}>
                              {i + 1}.
                            </span>
                            {l.clean_image_url && (
                              <img src={l.clean_image_url} alt="" className="w-9 h-9 object-cover rounded-lg border border-gray-100 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{l.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-400">🛒 {l.sales_count} satış</span>
                                {l.rating && <span className="text-xs text-yellow-500">★ {l.rating}</span>}
                              </div>
                              {insight && (
                                <p className={`text-xs mt-0.5 ${insight.color}`}>{insight.text}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Stok Uyarıları */}
                {summary.low_stock.length > 0 && (
                  <div className="bg-orange-50 rounded-2xl border border-orange-200 p-4">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-3">
                      ⚠️ Stok Uyarısı
                    </p>
                    <div className="space-y-2">
                      {summary.low_stock.map(l => (
                        <div key={l.id} className="flex items-center justify-between">
                          <p className="text-xs text-gray-700 truncate flex-1 mr-2">{l.title}</p>
                          <span className="text-xs font-bold text-orange-600 flex-shrink-0">
                            {l.stock} adet
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Platformun En Çok Satanları */}
                {summary.top_sector.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      🔥 Platformun En Çok Satanları
                    </p>
                    <div className="space-y-2.5">
                      {summary.top_sector.map((l, i) => (
                        <div key={l.id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-4 flex-shrink-0">{i + 1}.</span>
                          {l.clean_image_url && (
                            <img src={l.clean_image_url} alt="" className="w-8 h-8 object-cover rounded-lg border border-gray-100 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{l.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{l.category}</span>
                              <span className="text-xs text-green-600 font-medium">🛒 {l.sales_count}</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-orange-600 flex-shrink-0">
                            {l.price ? `${Number(l.price).toLocaleString('tr-TR')}₺` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Kategori Ortalamaları */}
                {Object.keys(summary.category_avgs).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      📊 Kategori Ortalamaları
                    </p>
                    <div className="space-y-2">
                      {Object.entries(summary.category_avgs)
                        .sort((a, b) => (b[1].avg_sales || 0) - (a[1].avg_sales || 0))
                        .slice(0, 6)
                        .map(([cat, data]) => (
                          <div key={cat} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                            <div>
                              <p className="text-xs font-medium text-gray-700">{cat}</p>
                              <p className="text-xs text-gray-400">
                                {data.listing_count} ilan · ort. {data.avg_sales || 0} satış
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-orange-600">
                                {data.avg_price ? `${Number(data.avg_price).toLocaleString('tr-TR')}₺` : '—'}
                              </p>
                              {data.avg_rating && (
                                <p className="text-xs text-yellow-500">★ {data.avg_rating}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Sağ Panel: Chat ────────────────────────────────────────────── */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 flex flex-col min-h-0">

            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-500 rounded-t-2xl">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-xl">🤖</div>
              <div>
                <p className="text-white font-semibold text-sm">Satış Asistanı</p>
                <p className="text-blue-200 text-xs">İlan & sektör analizi · Kişiselleştirilmiş öneriler</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-blue-200 text-xs">Çevrimiçi</span>
              </div>
            </div>

            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-sm mr-2 mt-1 flex-shrink-0">🤖</div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-700 rounded-bl-sm'}`}>
                    {msg.role === 'user' ? msg.text : (
                      <ReactMarkdown
                        components={{
                          p:      ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                          em:     ({children}) => <em className="italic">{children}</em>,
                          ul:     ({children}) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                          ol:     ({children}) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                          li:     ({children}) => <li className="text-gray-700">{children}</li>,
                          h1:     ({children}) => <h1 className="font-bold text-base mb-1">{children}</h1>,
                          h2:     ({children}) => <h2 className="font-bold text-sm mb-1">{children}</h2>,
                          h3:     ({children}) => <h3 className="font-semibold text-sm mb-1">{children}</h3>,
                          code:   ({children}) => <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                          hr:     () => <hr className="my-2 border-gray-300" />,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-sm mr-2 flex-shrink-0">🤖</div>
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

            {/* Örnek sorular */}
            {messages.length <= 1 && (
              <div className="px-5 pb-3">
                <p className="text-xs text-gray-400 mb-2">Örnek sorular:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'En çok satan ilanım hangisi?',
                    'Fiyatlarım sektör ortalamasında mı?',
                    'Hangi kategoride fırsat var?',
                    'İlanlarımı nasıl iyileştirebilirim?',
                  ].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-xs bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-3 py-1.5 rounded-full transition-colors border border-gray-200">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <span>💡</span>
                Asistan son 10 mesajı hatırlar. Daha eski konuşmalar bağlam dışında kalır.
              </p>
              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Satış verilerini sor, karşılaştırma yap, öneri al... (Enter ile gönder)"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || chatLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white p-2.5 rounded-xl transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
