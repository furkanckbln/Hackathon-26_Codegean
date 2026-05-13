import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/shared/Layout'
import api from '../services/api'

const fmt  = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0)
const fmtK = (n) => n >= 1000 ? `₺${(n / 1000).toFixed(1)}K` : `₺${fmt(n)}`

const EXAMPLE_QUESTIONS = [
  'Genel finansal durumum nasıl, nelere dikkat etmeliyim?',
  'Reklam harcamalarım hasılata oranla makul mu?',
  'Hangi gider kalemini düşürsem kârım en çok artar?',
  'Aylık nakit akışımda dikkat çeken bir trend var mı?',
  'Gerçek net kâr marjım sektör ortalamasına göre iyi mi?',
]

// ── Sol Panel: Finansal Özet ─────────────────────────────────────────────────
function FinanceSummary({ ctx, loading }) {
  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm animate-pulse">
      Veriler yükleniyor…
    </div>
  )
  if (!ctx) return null

  const { orders_summary: o, records_summary: r, true_net_profit, expense_breakdown, monthly_cashflow } = ctx
  const grossMargin = o.gross_revenue ? Math.round(o.net_revenue_from_sales / o.gross_revenue * 100) : 0
  const trueMargin  = o.gross_revenue ? Math.round(true_net_profit / o.gross_revenue * 100) : 0
  const maxFlow     = Math.max(...(monthly_cashflow || []).map(m => Math.max(m.orders_net, m.expenses)), 1)

  const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  const mLabel = (ym) => { const [, m] = ym.split('-'); return MONTH_TR[parseInt(m) - 1] }

  return (
    <div className="space-y-4 text-sm">

      {/* Kâr özeti */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
        <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Gerçek Net Kâr (6 ay)</p>
        <p className="text-2xl font-bold text-green-700">{fmtK(true_net_profit)}</p>
        <p className="text-xs text-green-600 mt-0.5">Net marj: %{trueMargin}</p>
      </div>

      {/* 3 KPI */}
      <div className="grid grid-cols-1 gap-2">
        {[
          { label: 'Brüt Hasılat',       value: fmtK(o.gross_revenue),          sub: `%${grossMargin} brüt marj` },
          { label: 'Operasyonel Gider',   value: fmtK(r.total_expense),          sub: 'Finance records' },
          { label: 'Diğer Gelirler',      value: fmtK(r.total_income),           sub: 'Platform dışı + teşvik' },
        ].map(item => (
          <div key={item.label} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-xs text-gray-400">{item.sub}</p>
            </div>
            <p className="font-semibold text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Gider dağılımı */}
      {expense_breakdown?.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gider Kalemleri</p>
          <div className="space-y-1.5">
            {expense_breakdown.slice(0, 5).map(e => (
              <div key={e.category} className="flex justify-between text-xs">
                <span className="text-gray-600 truncate mr-2">{e.category}</span>
                <span className="font-medium text-gray-800 whitespace-nowrap">{fmtK(e.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aylık mini chart */}
      {monthly_cashflow?.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aylık Nakit Akışı</p>
          <div className="flex items-end gap-1 h-16">
            {monthly_cashflow.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col items-center justify-end gap-0.5" style={{ height: 52 }}>
                  <div className="w-full bg-green-400 rounded-sm"
                    style={{ height: `${(m.orders_net / maxFlow) * 100}%` }} title={`Gelir: ${fmtK(m.orders_net)}`} />
                  <div className="w-full bg-red-300 rounded-sm"
                    style={{ height: `${(m.expenses / maxFlow) * 48}%` }} title={`Gider: ${fmtK(m.expenses)}`} />
                </div>
                <span className="text-[9px] text-gray-400">{mLabel(m.month)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Satış geliri
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="w-2 h-2 rounded-sm bg-red-300 inline-block" /> Gider
            </span>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function FinanceAssistantPage() {
  const [ctx,         setCtx]         = useState(null)
  const [ctxLoading,  setCtxLoading]  = useState(true)

  const [messages,    setMessages]    = useState([
    { role: 'ai', text: 'Merhaba! Ben SellerAI Finans Asistanı\'yım. Son 6 aylık finansal tablonu inceledim — kârlılık, gider optimizasyonu veya nakit akışı hakkında sormak istediğin ne varsa sorabilirsin.' }
  ])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const bottomRef = useRef()

  // Bağlamı çek
  useEffect(() => {
    api.get('/finance/context')
      .then(r => setCtx(r.data))
      .catch(() => {})
      .finally(() => setCtxLoading(false))
  }, [])

  // Yeni mesajda scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role: 'user', text: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].slice(-10)
      const res = await api.post('/finance/chat', {
        message: msg,
        history: history.map(m => ({ role: m.role, text: m.text })),
        context: ctx || {},
      })
      setMessages(prev => [...prev, { role: 'ai', text: res.data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '⚠️ Bağlantı hatası, tekrar dener misin?' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <Layout>
      <div className="flex gap-5 h-[calc(100vh-120px)]">

        {/* ── Sol: Özet Panel ──────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800">Finans Asistanı</h2>
            <p className="text-xs text-gray-400 mt-0.5">RAG destekli finansal danışman</p>
          </div>
          <FinanceSummary ctx={ctx} loading={ctxLoading} />
        </aside>

        {/* ── Sağ: Chat ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Örnek sorular — sadece başta göster */}
            {messages.length === 1 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2 font-medium">Örnek sorular:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-0.5">
                    🤖
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm'}`}>
                  {msg.role === 'ai'
                    ? <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    : msg.text
                  }
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm mr-2">🤖</div>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            <p className="text-[10px] text-gray-400 mb-2">
              💡 Asistan son 10 mesaja kadar bağlamı hatırlar.
            </p>
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Finansal durumun hakkında bir şey sor…"
                rows={2}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="h-10 w-10 flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl transition-colors flex-shrink-0"
              >
                ➤
              </button>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
