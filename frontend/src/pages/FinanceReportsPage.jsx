/**
 * FinanceReportsPage — 4 bölümlü kapsamlı finans raporu
 *
 * 1. Kârlılık Özeti   — aylık net kâr trendi + aylık büyüme + kategori marjları
 * 2. Gider Analizi    — top kategori aylık trend + reklam/gelir oranı
 * 3. Sipariş Sağlığı  — tamamlanma/iade/iptal donut + aylık sipariş metrikleri
 * 4. Ürün Performansı — en kârlı 5 ilan + yavaş dönen stoklar
 */

import { useEffect, useState } from 'react'
import Layout from '../components/shared/Layout'
import api from '../services/api'

// ── Format yardımcıları ──────────────────────────────────────────────────────
const fmt  = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0)
const fmtK = (n) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)
const MONTH_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const monthLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTH_TR[parseInt(m)-1]} ${y.slice(2)}` }

const BAR_H = 120  // bar grafik max px yüksekliği

// ── Mini bar grafik ──────────────────────────────────────────────────────────
function MiniBarChart({ data, valueKey = 'net', colorPos = 'bg-blue-400', colorNeg = 'bg-red-400', label }) {
  if (!data?.length) return null
  const vals   = data.map(d => d[valueKey] ?? 0)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)

  return (
    <div>
      {label && <p className="text-xs text-gray-500 mb-2">{label}</p>}
      <div className="flex items-end gap-1.5" style={{ height: `${BAR_H + 20}px` }}>
        {data.map((d, i) => {
          const val = d[valueKey] ?? 0
          const h   = Math.max((Math.abs(val) / maxAbs) * BAR_H, 3)
          const col = val >= 0 ? colorPos : colorNeg
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-gray-800 text-white rounded px-1.5 py-0.5 whitespace-nowrap">
                ₺{fmtK(val)}
              </div>
              <div className={`w-full ${col} rounded-t transition-all`} style={{ height: `${h}px` }} />
              <span className="text-[9px] text-gray-400">{monthLabel(d.month)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Yüzde çubuğu ────────────────────────────────────────────────────────────
function PctBar({ value, max, color = 'bg-blue-400', label, sublabel }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 font-medium truncate mr-3">{label}</span>
        <span className="text-gray-500 text-xs whitespace-nowrap">{sublabel}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── KPI küçük kart ───────────────────────────────────────────────────────────
function KpiSmall({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    gray:   'bg-gray-50 text-gray-600',
  }
  return (
    <div className={`${colors[color]} rounded-xl p-4`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Bölüm başlığı ───────────────────────────────────────────────────────────
function SectionTitle({ icon, title, sub }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
        <span>{icon}</span>{title}
      </h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5 ml-6">{sub}</p>}
    </div>
  )
}

// ── Ana sayfa ────────────────────────────────────────────────────────────────
export default function FinanceReportsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.get('/finance/reports')
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📊</div>
          <p>Raporlar hazırlanıyor…</p>
        </div>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-600">
        Raporlar yüklenemedi: {error}
      </div>
    </Layout>
  )

  const { profitability, expense_analysis, order_health, product_performance } = data

  // Kategori marjları için max revenue
  const maxMarginRev = Math.max(...(profitability.category_margins || []).map(c => c.revenue), 1)
  // Top profitable max revenue
  const maxProfRev   = Math.max(...(product_performance.top_profitable || []).map(p => p.net_revenue), 1)
  // Reklam oranı rengi
  const adRatioColor = (pct) => pct > 25 ? 'text-red-600' : pct > 15 ? 'text-orange-500' : 'text-green-600'

  const COLORS = ['bg-blue-400','bg-purple-400','bg-orange-400','bg-teal-400','bg-pink-400']

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Raporlar</h2>
        <p className="text-gray-500 text-sm mt-0.5">Detaylı finansal analiz ve performans özeti</p>
      </div>

      <div className="space-y-5">

        {/* ══════════════════════════════════════════════════════════════════
            BÖLÜM 1 — KÂRLILIK ÖZETİ
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SectionTitle
            icon="💰"
            title="Kârlılık Özeti"
            sub="Aylık net kâr trendi ve kategori bazında brüt marj analizi"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sol: Aylık net kâr bar grafiği */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Aylık Net Kâr</p>
                {profitability.overall_mom_pct != null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    profitability.overall_mom_pct >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {profitability.overall_mom_pct >= 0 ? '▲' : '▼'} %{Math.abs(profitability.overall_mom_pct)} geçen aya göre
                  </span>
                )}
              </div>
              <MiniBarChart
                data={profitability.monthly_net}
                valueKey="net"
                colorPos="bg-green-400"
                colorNeg="bg-red-400"
              />
              {/* Aylık büyüme oranları */}
              <div className="mt-3 flex gap-2 flex-wrap">
                {profitability.monthly_net.filter(m => m.mom_pct != null).slice(-4).map(m => (
                  <span key={m.month} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    m.mom_pct >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {monthLabel(m.month)}: {m.mom_pct >= 0 ? '+' : ''}{m.mom_pct}%
                  </span>
                ))}
              </div>
            </div>

            {/* Sağ: Kategori marjları */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Kategori Brüt Marjları</p>
              <div className="space-y-1">
                {profitability.category_margins.map((c, i) => (
                  <PctBar
                    key={c.category}
                    value={c.revenue}
                    max={maxMarginRev}
                    color={COLORS[i % COLORS.length]}
                    label={c.category}
                    sublabel={`%${c.margin} marj · ${c.orders} sipariş · ₺${fmtK(c.revenue)}`}
                  />
                ))}
                {profitability.category_margins.length === 0 && (
                  <p className="text-sm text-gray-400">Kategori verisi henüz yok.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BÖLÜM 2 — GİDER ANALİZİ
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SectionTitle
            icon="📤"
            title="Gider Analizi"
            sub="Kategori bazında aylık gider trendi ve reklam/gelir oranı"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sol: Top kategori aylık trend — çok çizgili bar */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Top 4 Gider Kategorisi Trendi</p>
              {expense_analysis.category_trend.length > 0 ? (
                <div className="space-y-4">
                  {expense_analysis.category_trend.map((cat, ci) => {
                    const maxAmt = Math.max(...cat.monthly.map(m => m.amount), 1)
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORS[ci % COLORS.length]}`} />
                          <span className="text-xs font-medium text-gray-700 truncate">{cat.category}</span>
                          <span className="text-xs text-gray-400 ml-auto">
                            ₺{fmtK(cat.monthly.reduce((s,m) => s + m.amount, 0))} toplam
                          </span>
                        </div>
                        <div className="flex items-end gap-1 h-10">
                          {cat.monthly.map((m, mi) => {
                            const h = Math.max((m.amount / maxAmt) * 36, 2)
                            return (
                              <div key={mi} className="flex-1 flex flex-col items-center justify-end group">
                                <div className="opacity-0 group-hover:opacity-100 text-[9px] bg-gray-700 text-white rounded px-1 absolute -mt-5 whitespace-nowrap">
                                  ₺{fmtK(m.amount)}
                                </div>
                                <div className={`w-full ${COLORS[ci % COLORS.length]} rounded-t opacity-80`}
                                  style={{ height: `${h}px` }} />
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex gap-1 mt-0.5">
                          {cat.monthly.map((m, mi) => (
                            <div key={mi} className="flex-1 text-center text-[8px] text-gray-300">
                              {monthLabel(m.month).split(' ')[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Gider verisi henüz yok.</p>
              )}
            </div>

            {/* Sağ: Reklam/Gelir oranı trendi */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Reklam / Gelir Oranı Trendi</p>
              <div className="space-y-3">
                {expense_analysis.ad_ratio_trend.map(m => (
                  <div key={m.month}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">{monthLabel(m.month)}</span>
                      <span className={`font-bold ${adRatioColor(m.ratio_pct)}`}>
                        %{m.ratio_pct}
                        {m.ratio_pct > 25 ? ' 🚨' : m.ratio_pct > 15 ? ' ⚠️' : ' ✅'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          m.ratio_pct > 25 ? 'bg-red-400' : m.ratio_pct > 15 ? 'bg-orange-400' : 'bg-green-400'
                        }`}
                        style={{ width: `${Math.min(m.ratio_pct * 2, 100)}%` }}
                      />
                    </div>
                    {m.ad_exp > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        ₺{fmtK(m.ad_exp)} reklam · ₺{fmtK(m.income)} sipariş geliri
                      </p>
                    )}
                  </div>
                ))}
                {expense_analysis.ad_ratio_trend.every(m => m.ad_exp === 0) && (
                  <p className="text-sm text-gray-400">Reklam gideri kaydı yok.</p>
                )}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-700">
                  💡 <strong>Sektör standardı:</strong> Reklam/gelir oranı %5–10 olmalı.
                  %15 üzeri yüksek, %25 üzeri kritik.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BÖLÜM 3 — SİPARİŞ SAĞLIĞI
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SectionTitle
            icon="📦"
            title="Sipariş Sağlığı"
            sub="Tamamlanma, iptal ve iade oranları · Ortalama sepet değeri"
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiSmall
              label="Toplam Sipariş"
              value={fmt(order_health.total_orders)}
              color="gray"
            />
            <KpiSmall
              label="Tamamlanma Oranı"
              value={`%${order_health.completion_rate}`}
              sub={`${fmt(order_health.completed)} sipariş`}
              color={order_health.completion_rate >= 70 ? 'green' : 'orange'}
            />
            <KpiSmall
              label="İptal & İade Oranı"
              value={`%${order_health.refund_cancel_rate}`}
              sub={`${fmt(order_health.cancelled + order_health.refunded)} sipariş`}
              color={order_health.refund_cancel_rate <= 5 ? 'green' : order_health.refund_cancel_rate <= 15 ? 'orange' : 'red'}
            />
            <KpiSmall
              label="Ort. Sepet Tutarı"
              value={`₺${fmtK(order_health.avg_basket)}`}
              sub="tamamlanan siparişler"
              color="blue"
            />
          </div>

          {/* Sipariş durum stacked bar */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Sipariş Durum Dağılımı</p>
            <div className="flex rounded-full overflow-hidden h-4 mb-3">
              {[
                { key: 'completed',  val: order_health.completed,   color: 'bg-green-400' },
                { key: 'processing', val: order_health.processing,  color: 'bg-yellow-400' },
                { key: 'cancelled',  val: order_health.cancelled,   color: 'bg-red-400' },
                { key: 'refunded',   val: order_health.refunded,    color: 'bg-purple-400' },
              ].map(s => (
                <div
                  key={s.key}
                  className={`${s.color} transition-all`}
                  style={{ width: `${order_health.total_orders ? (s.val / order_health.total_orders) * 100 : 0}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {[
                { label: 'Tamamlandı',   val: order_health.completed,  color: 'bg-green-400' },
                { label: 'Hazırlanıyor', val: order_health.processing, color: 'bg-yellow-400' },
                { label: 'İptal',        val: order_health.cancelled,  color: 'bg-red-400' },
                { label: 'İade',         val: order_health.refunded,   color: 'bg-purple-400' },
              ].map(s => (
                <span key={s.label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${s.color} inline-block`} />
                  {s.label}: {fmt(s.val)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            BÖLÜM 4 — ÜRÜN PERFORMANSI
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <SectionTitle
            icon="🏷️"
            title="Ürün Performansı"
            sub="En kârlı ilanlar ve yavaş dönen stoklar"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sol: En kârlı 5 ilan */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">🏆 En Kârlı 5 İlan</p>
              {product_performance.top_profitable.length > 0 ? (
                <div className="space-y-3">
                  {product_performance.top_profitable.map((p, i) => (
                    <div key={p.listing_id}>
                      <div className="flex items-start gap-3 mb-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                          ${i === 0 ? 'bg-yellow-100 text-yellow-700'
                          : i === 1 ? 'bg-gray-100 text-gray-600'
                          : i === 2 ? 'bg-orange-100 text-orange-600'
                          : 'bg-gray-50 text-gray-400'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                          <p className="text-xs text-gray-400">{p.category} · {p.orders} sipariş · sipariş başı ₺{fmtK(p.profit_per_order)}</p>
                        </div>
                        <span className="text-sm font-bold text-green-600 whitespace-nowrap">₺{fmtK(p.net_revenue)}</span>
                      </div>
                      <div className="ml-9 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-400 rounded-full"
                          style={{ width: `${(p.net_revenue / maxProfRev) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Tamamlanan sipariş bulunamadı.</p>
              )}
            </div>

            {/* Sağ: Yavaş dönen stoklar */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">🐢 Yavaş Dönen Stoklar</p>
              <p className="text-xs text-gray-400 mb-3">Aktif, stok &gt; 5 ve toplam satış &lt; 5 olan ilanlar</p>
              {product_performance.slow_movers.length > 0 ? (
                <div className="space-y-2">
                  {product_performance.slow_movers.map(p => (
                    <div key={p.listing_id} className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                      <span className="text-lg">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                        <p className="text-xs text-gray-500">{p.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-orange-600">{p.stock} stok</p>
                        <p className="text-xs text-gray-400">{p.sales_count} satış</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-sm text-green-700 font-medium">Yavaş dönen stok yok</p>
                  <p className="text-xs text-green-500 mt-0.5">Tüm aktif ilanların satışları sağlıklı</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  )
}
