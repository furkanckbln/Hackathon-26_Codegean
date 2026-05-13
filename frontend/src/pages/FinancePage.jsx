import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/shared/Layout'
import api from '../services/api'

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const fmt  = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
const fmtK = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)

const STATUS_META = {
  delivered:  { label: 'Teslim Edildi', color: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-700'  },
  shipped:    { label: 'Kargoda',       color: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-700'   },
  processing: { label: 'Hazırlanıyor',  color: 'bg-yellow-400', light: 'bg-yellow-50', text: 'text-yellow-700' },
  cancelled:  { label: 'İptal',         color: 'bg-red-400',    light: 'bg-red-50',    text: 'text-red-700'    },
  refunded:   { label: 'İade',          color: 'bg-purple-400', light: 'bg-purple-50', text: 'text-purple-700' },
}

const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return `${MONTH_TR[parseInt(m) - 1]} ${y.slice(2)}`
}

// ── KPI Kartı ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'from-blue-50 to-blue-100 border-blue-200 text-blue-600',
    green:  'from-green-50 to-green-100 border-green-200 text-green-600',
    orange: 'from-orange-50 to-orange-100 border-orange-200 text-orange-600',
    red:    'from-red-50 to-red-100 border-red-200 text-red-600',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex flex-col gap-1`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Aylık Gelir Grafik (CSS Bar Chart) ──────────────────────────────────────
function MonthlyChart({ data }) {
  if (!data?.length) return null
  const maxVal = Math.max(...data.map(d => Math.max(d.income || 0, d.expense || 0)), 1)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">📈 Aylık Gelir / Gider</h3>
      <div className="flex items-end gap-3 h-40">
        {data.map((d) => {
          const incPct = Math.max(((d.income || 0) / maxVal) * 100, 2)
          const expPct = Math.max(((d.expense || 0) / maxVal) * 100, 2)
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-800 text-white rounded px-2 py-1 whitespace-nowrap text-center">
                <div>Gelir: ₺{fmtK(d.income)}</div>
                <div>Gider: ₺{fmtK(d.expense)}</div>
              </div>
              <div className="w-full flex items-end gap-0.5" style={{ height: '100%' }}>
                <div className="flex-1 bg-green-400 hover:bg-green-500 transition-colors rounded-t"
                  style={{ height: `${incPct}%` }} />
                <div className="flex-1 bg-red-300 hover:bg-red-400 transition-colors rounded-t"
                  style={{ height: `${expPct}%` }} />
              </div>
              <span className="text-[10px] text-gray-400">{monthLabel(d.month)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-2">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Gelir
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-300 inline-block" /> Gider
        </span>
      </div>
    </div>
  )
}

// ── Gider Dağılımı (yatay bar) ───────────────────────────────────────────────
function CostBreakdown({ kpis, costBreakdown }) {
  if (!kpis) return null
  const items = costBreakdown?.length
    ? costBreakdown.map((c, i) => ({
        label: c.label,
        value: c.value,
        color: ['bg-red-400','bg-orange-400','bg-yellow-400','bg-purple-400','bg-green-500'][i] || 'bg-gray-300',
      }))
    : [
        { label: 'Maliyet (COGS)',      value: kpis.total_cogs,      color: 'bg-red-400'    },
        { label: 'Komisyon',            value: kpis.total_commission, color: 'bg-orange-400' },
        { label: 'Kargo',               value: kpis.total_cargo,      color: 'bg-yellow-400' },
        { label: 'Operasyonel Giderler',value: kpis.manual_expense,   color: 'bg-purple-400' },
        { label: 'Net Kâr',             value: kpis.true_net_profit,  color: 'bg-green-500'  },
      ]
  const total = items.reduce((s, i) => s + (i.value || 0), 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">💸 Gelir Dağılımı</h3>
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-5 mb-5">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.color} transition-all`}
            style={{ width: `${total ? (item.value / total) * 100 : 0}%` }}
            title={`${item.label}: ₺${fmt(item.value)}`}
          />
        ))}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-gray-600">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs">{total ? Math.round((item.value / total) * 100) : 0}%</span>
              <span className="font-semibold text-gray-800 w-24 text-right">₺{fmtK(item.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Durum Dağılımı ───────────────────────────────────────────────────────────
function StatusBreakdown({ data }) {
  if (!data?.length) return null
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">📦 Sipariş Durumları</h3>
      <div className="space-y-3">
        {data.map((d) => {
          const meta  = STATUS_META[d.status] || { label: d.status, color: 'bg-gray-400', light: 'bg-gray-50', text: 'text-gray-700' }
          const pct   = total ? Math.round((d.count / total) * 100) : 0
          return (
            <div key={d.status}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-medium ${meta.text}`}>{meta.label}</span>
                <span className="text-gray-500">{d.count} sipariş · %{pct}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${meta.color} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Kategori Gelir Tablosu ───────────────────────────────────────────────────
function CategoryTable({ data }) {
  if (!data?.length) return null
  const maxRev = Math.max(...data.map(d => d.net_revenue), 1)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">🏷️ Kategoriye Göre Gelir</h3>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.category}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 font-medium truncate mr-4">{d.category}</span>
              <span className="text-gray-800 font-semibold whitespace-nowrap">₺{fmtK(d.net_revenue)}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${(d.net_revenue / maxRev) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Top İlanlar ──────────────────────────────────────────────────────────────
function TopListings({ data }) {
  if (!data?.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">🏆 En Çok Kazandıran İlanlar</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={item.listing_id} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
              ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                i === 1 ? 'bg-gray-100 text-gray-600' :
                i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
              <p className="text-xs text-gray-400">{item.category} · {item.orders} sipariş</p>
            </div>
            <div className="text-sm font-semibold text-green-600 whitespace-nowrap">
              ₺{fmtK(item.net_revenue)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/finance/overview')
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">💰</div>
          <p>Finansal veriler yükleniyor…</p>
        </div>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-600">
        Veri yüklenemedi: {error}
      </div>
    </Layout>
  )

  const { kpis, monthly_revenue, cost_breakdown, category_expense, status_breakdown, top_listings } = data

  return (
    <Layout>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Genel Bakış</h2>
          <p className="text-gray-500 text-sm mt-0.5">Satış performansı ve finansal özet</p>
        </div>
        <button
          onClick={() => navigate('/finance/assistant')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <span>🤖</span> Finans Asistanı
        </button>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon="💰"
          label="Gerçek Net Kâr"
          value={`₺${fmtK(kpis.true_net_profit)}`}
          sub={`Brüt hasılat: ₺${fmtK(kpis.gross_revenue)}`}
          color="green"
        />
        <KpiCard
          icon="📥"
          label="Toplam Gelir"
          value={`₺${fmtK(kpis.total_income)}`}
          sub={`Sipariş + diğer gelirler`}
          color="blue"
        />
        <KpiCard
          icon="📤"
          label="Toplam Gider"
          value={`₺${fmtK(kpis.total_expense)}`}
          sub={`COGS + komisyon + operasyonel`}
          color="orange"
        />
        <KpiCard
          icon="📊"
          label="Brüt Marj"
          value={`%${kpis.gross_margin}`}
          sub="Sipariş gelirinden"
          color={kpis.gross_margin > 40 ? 'green' : 'red'}
        />
      </div>

      {/* Grafik + Gider Dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <MonthlyChart data={monthly_revenue} />
        <CostBreakdown kpis={kpis} costBreakdown={cost_breakdown} />
      </div>

      {/* Alt satır: Durum + Kategori Gider + Top ilanlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatusBreakdown data={status_breakdown} />
        <CategoryTable   data={category_expense?.map(c => ({ category: c.category, net_revenue: c.total, orders: 0 }))} />
        <TopListings     data={top_listings} />
      </div>
    </Layout>
  )
}
