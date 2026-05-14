/**
 * AlertsPage — Anomali uyarıları ekranı
 * Context bağımlılığı YOK — kendi verilerini direkt API'den çeker.
 */

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/shared/Layout'
import api from '../services/api'

// ── Severity meta ────────────────────────────────────────────────────────────
const SEV = {
  critical: { border: 'border-red-400',    bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',    icon: '🚨', label: 'Kritik' },
  medium:   { border: 'border-orange-300', bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700', icon: '⚠️', label: 'Orta' },
  low:      { border: 'border-yellow-200', bg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-700', icon: 'ℹ️', label: 'Düşük' },
}

const EXAMPLE_QUESTIONS = [
  'Kritik uyarıları nasıl çözebilirim?',
  'Reklam harcamamı nasıl optimize etmeliyim?',
  'Nakit projeksiyonumu nasıl iyileştirebilirim?',
  'Stok tükenen ürünler için ne yapmalıyım?',
]

// ── Alert Kartı ──────────────────────────────────────────────────────────────
function AlertCard({ alert }) {
  const meta = SEV[alert.severity] || SEV.low
  return (
    <div className={`border ${meta.border} ${meta.bg} rounded-xl p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base flex-shrink-0">{meta.icon}</span>
          <span className="font-semibold text-gray-800 text-sm truncate">{alert.title}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.badge}`}>
          {meta.label}
        </span>
      </div>
      {(alert.detail || alert.description) && (
        <p className="text-sm text-gray-600 leading-relaxed mb-1">
          {alert.detail || alert.description}
        </p>
      )}
      {alert.metric && (
        <p className="text-xs font-mono text-gray-400 mb-1">{alert.metric}</p>
      )}
      {alert.recommendation && (
        <p className="text-xs text-blue-600 font-medium">💡 {alert.recommendation}</p>
      )}
    </div>
  )
}

// ── Mesaj Balonu ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <span className="text-xl mr-2 mt-0.5 flex-shrink-0">🤖</span>}
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'}`}>
        {isUser
          ? msg.text
          : <div className="prose prose-sm max-w-none"><ReactMarkdown>{String(msg.text || '')}</ReactMarkdown></div>
        }
      </div>
    </div>
  )
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  // Alerts state — kendi fetch'ini yapıyor
  const [alerts,      setAlerts]      = useState([])
  const [hasCritical, setHasCritical] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState(null)

  // Context (finans özeti)
  const [context, setContext] = useState({})

  // Chat state
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [sending,  setSending]  = useState(false)

  const bottomRef  = useRef(null)
  const isSending  = useRef(false)

  // Alerts yükle
  const loadAlerts = () => {
    setAlertsLoading(true)
    api.get('/finance/alerts')
      .then(r => {
        setAlerts(Array.isArray(r.data?.alerts) ? r.data.alerts : [])
        setHasCritical(Boolean(r.data?.has_critical))
        setLastChecked(r.data?.checked_at || null)
      })
      .catch(err => console.warn('Alerts yüklenemedi:', err?.message))
      .finally(() => setAlertsLoading(false))
  }

  // Finans bağlamını yükle
  const loadContext = () => {
    api.get('/finance/context')
      .then(r => setContext(r.data || {}))
      .catch(() => {})
  }

  useEffect(() => {
    loadAlerts()
    loadContext()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const sendMessage = async (textArg) => {
    if (isSending.current) return

    const text = typeof textArg === 'string' ? textArg.trim() : input.trim()
    if (!text) return

    isSending.current = true
    const userMsg = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const history = [...messages, userMsg].slice(-10).map(m => ({
        role: String(m.role),
        text: String(m.text),
      }))

      const payload = {
        message: text,
        history,
        alerts:  alerts,
        context: context,
      }

      const res  = await api.post('/finance/alerts/chat', payload)
      const reply = String(res.data?.reply || 'Yanıt alınamadı.')
      setMessages(prev => [...prev, { role: 'ai', text: reply }])
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Sunucu hatası'
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ Hata: ${msg}` }])
    } finally {
      setSending(false)
      isSending.current = false
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const criticalCount = alerts.filter(a => a?.severity === 'critical').length
  const mediumCount   = alerts.filter(a => a?.severity === 'medium').length
  const lowCount      = alerts.filter(a => a?.severity === 'low').length

  const sortedAlerts = [...alerts].sort((a, b) => {
    const o = { critical: 0, medium: 1, low: 2 }
    return (o[a?.severity] ?? 3) - (o[b?.severity] ?? 3)
  })

  return (
    <Layout>
      <div className="flex gap-5 h-[calc(100vh-8rem)]">

        {/* ── Sol panel: Uyarılar ─────────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">🔔 Anomali Uyarıları</h2>
            <button
              onClick={loadAlerts}
              disabled={alertsLoading}
              className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40"
            >
              {alertsLoading ? 'Kontrol…' : '↻ Yenile'}
            </button>
          </div>

          {lastChecked && (
            <p className="text-xs text-gray-400">
              Son kontrol: {new Date(lastChecked).toLocaleTimeString('tr-TR')}
            </p>
          )}

          {/* Özet sayaçlar */}
          {alerts.length > 0 && (
            <div className="flex gap-1.5">
              {criticalCount > 0 && (
                <span className="flex-1 text-center bg-red-100 text-red-700 text-xs font-bold py-1.5 rounded-lg">
                  🚨 {criticalCount}
                </span>
              )}
              {mediumCount > 0 && (
                <span className="flex-1 text-center bg-orange-100 text-orange-700 text-xs font-bold py-1.5 rounded-lg">
                  ⚠️ {mediumCount}
                </span>
              )}
              {lowCount > 0 && (
                <span className="flex-1 text-center bg-yellow-100 text-yellow-700 text-xs font-bold py-1.5 rounded-lg">
                  ℹ️ {lowCount}
                </span>
              )}
            </div>
          )}

          {/* Alert listesi */}
          {alertsLoading ? (
            <div className="text-center text-gray-400 py-8 text-sm animate-pulse">Yükleniyor…</div>
          ) : sortedAlerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-green-700 font-medium text-sm">Anomali tespit edilmedi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAlerts.map((a, i) => <AlertCard key={a.id || i} alert={a} />)}
            </div>
          )}
        </div>

        {/* ── Sağ panel: Chat ─────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Anomali Asistanı</p>
              <p className="text-xs text-gray-400">
                {hasCritical ? '🚨 Kritik uyarılar mevcut' : 'Uyarılar hakkında soru sor'}
              </p>
            </div>
          </div>

          {/* Mesajlar alanı */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {messages.length === 0 && (
              <div className="space-y-2">
                {hasCritical && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-700">
                    🚨 <strong>Kritik uyarılar var.</strong> Sol paneli incele, ardından aşağıdan sor.
                  </div>
                )}
                <p className="text-xs text-gray-400 mb-2">Başlamak için bir soru seç:</p>
                {EXAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={sending || alertsLoading}
                    className="block w-full text-left text-sm bg-gray-50 hover:bg-blue-50 hover:text-blue-700
                               border border-gray-100 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

            {sending && (
              <div className="flex justify-start">
                <span className="text-xl mr-2">🤖</span>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-2">
              💡 Asistan tüm uyarıları biliyor. Son 10 mesajı hatırlıyor.
            </p>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={sending}
                placeholder="Uyarılar hakkında bir şey sor… (Enter ile gönder)"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none
                           focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                           rounded-xl disabled:opacity-40 transition-colors"
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
