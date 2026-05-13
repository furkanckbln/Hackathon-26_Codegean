import { useEffect, useState } from 'react'
import Layout from '../components/shared/Layout'
import api from '../services/api'

// ── Sabitler ─────────────────────────────────────────────────────────────────
const INCOME_CATEGORIES  = [
  'Platform Dışı Satış', 'Teşvik & Destek', 'İade & Alacak',
  'Fiyat Farkı Geliri', 'Diğer Gelir',
]
const EXPENSE_CATEGORIES = [
  'Reklam & Pazarlama', 'Depo & Kira', 'Stok Alımı',
  'Paketleme Malzemeleri', 'Kargo Anlaşması', 'Muhasebe & Danışmanlık',
  'Platform Aboneliği', 'Yazılım & Araçlar', 'Sigorta',
  'Fuar & Etkinlik', 'Ekipman & Demirbaş', 'Personel & Serbest Çalışan',
  'Vergi & Harç', 'Diğer Gider',
]

// Sipariş kaynaklı otomatik kayıtlar — sadece görüntülenir, silinemez
const AUTO_SOURCES = ['order_commission', 'order_cargo', 'order_refund', 'order_income']

const fmt = (n) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)

const MONTH_LABELS = {
  '01':'Oca','02':'Şub','03':'Mar','04':'Nis','05':'May','06':'Haz',
  '07':'Tem','08':'Ağu','09':'Eyl','10':'Eki','11':'Kas','12':'Ara',
}
const formatDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day} ${MONTH_LABELS[m]} ${y}`
}

const EMPTY_FORM = {
  type:        'expense',
  amount:      '',
  category:    '',
  description: '',
  record_date: new Date().toISOString().slice(0, 10),
}

// ── Özet Kartı ───────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color, icon }) {
  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-800">₺{fmt(value)}</p>
    </div>
  )
}

// ── Yeni Kayıt Formu ─────────────────────────────────────────────────────────
function AddRecordForm({ onSave, onCancel, saving }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  // Kategori tipi değişince sıfırla
  const handleTypeChange = (t) => setForm(p => ({ ...p, type: t, category: '' }))

  const handleSubmit = () => {
    if (!form.amount || !form.category || !form.record_date) return
    onSave({
      type:        form.type,
      amount:      parseFloat(form.amount),
      category:    form.category,
      description: form.description,
      record_date: form.record_date,
    })
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Yeni Kayıt Ekle</h3>

      {/* Tür seçimi */}
      <div className="flex gap-2 mb-4">
        {[
          { val: 'income',  label: '💚 Gelir',  active: 'bg-green-600 text-white border-green-600' },
          { val: 'expense', label: '🔴 Gider',  active: 'bg-red-500 text-white border-red-500'     },
        ].map(t => (
          <button
            key={t.val}
            onClick={() => handleTypeChange(t.val)}
            className={`px-5 py-2 rounded-xl border text-sm font-medium transition-colors
              ${form.type === t.val ? t.active : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Tutar */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Tutar (₺) <span className="text-red-400">*</span>
          </label>
          <input
            type="number" min="0" step="0.01"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tarih */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Tarih <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={form.record_date}
            onChange={e => set('record_date', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Kategori */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Kategori <span className="text-red-400">*</span>
          </label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Seç —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
          <input
            type="text"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="İsteğe bağlı not…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl"
        >
          İptal
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !form.amount || !form.category}
          className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
        >
          {saving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
        </button>
      </div>
    </div>
  )
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function FinanceTransactionsPage() {
  const [records,    setRecords]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleteId,   setDeleteId]   = useState(null)

  // Filtreler
  const [typeFilter, setTypeFilter] = useState('all')   // all | income | expense
  const [catFilter,  setCatFilter]  = useState('')
  const [monthFilter,setMonthFilter]= useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/finance/transactions')
      setRecords(res.data || [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Özet hesapla ──────────────────────────────────────────────────────────
  const totalIncome  = records.filter(r => r.type === 'income') .reduce((s, r) => s + (r.amount || 0), 0)
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0)
  const net          = totalIncome - totalExpense

  // ── Filtre uygula ─────────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false
    if (catFilter  && r.category !== catFilter)         return false
    if (monthFilter && !(r.record_date || '').startsWith(monthFilter)) return false
    return true
  })

  // Mevcut aylar (filtre için)
  const months = [...new Set(
    records.map(r => (r.record_date || '').slice(0, 7)).filter(Boolean)
  )].sort().reverse()

  // Mevcut kategoriler (filtre için)
  const categories = [...new Set(records.map(r => r.category).filter(Boolean))].sort()

  // ── Kaydet ───────────────────────────────────────────────────────────────
  const handleSave = async (data) => {
    setSaving(true)
    try {
      await api.post('/finance/transactions', data)
      setShowForm(false)
      await load()
    } catch {
      alert('Kayıt eklenemedi.')
    } finally {
      setSaving(false)
    }
  }

  // ── Sil ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/finance/transactions/${id}`)
      setDeleteId(null)
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('Silinemedi.')
    }
  }

  return (
    <Layout>
      {/* Başlık */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gelir & Giderler</h2>
          <p className="text-gray-500 text-sm mt-0.5">Manuel kayıtlar + sipariş kaynaklı otomatik girişler</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {showForm ? '✕ Kapat' : '+ Yeni Kayıt'}
        </button>
      </div>

      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Toplam Gelir"  value={totalIncome}  color="bg-green-50 border-green-200"  icon="💚" />
        <SummaryCard label="Toplam Gider"  value={totalExpense} color="bg-red-50 border-red-200"      icon="🔴" />
        <SummaryCard
          label="Net"
          value={Math.abs(net)}
          color={net >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}
          icon={net >= 0 ? "📈" : "📉"}
        />
      </div>

      {/* Form */}
      {showForm && (
        <AddRecordForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Filtre bar */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        {/* Tür */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { val: 'all',     label: 'Tümü'   },
            { val: 'income',  label: '💚 Gelir' },
            { val: 'expense', label: '🔴 Gider' },
          ].map(t => (
            <button
              key={t.val}
              onClick={() => setTypeFilter(t.val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${typeFilter === t.val ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Kategori */}
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">Tüm Kategoriler</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Ay */}
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">Tüm Aylar</option>
          {months.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{MONTH_LABELS[mo]} {y}</option>
          })}
        </select>

        <span className="ml-auto text-xs text-gray-400">{filtered.length} kayıt</span>
      </div>

      {/* Tablo */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm animate-pulse">
            Yükleniyor…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 text-sm">Kayıt bulunamadı.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarih</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tür</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tutar</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => {
                const isAuto   = AUTO_SOURCES.includes(r.source)
                const isIncome = r.type === 'income'
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDate(r.record_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                        ${isIncome
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {isIncome ? '▲ Gelir' : '▼ Gider'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{r.category || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {r.description || '—'}
                      {isAuto && (
                        <span className="ml-2 text-[10px] bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-full">
                          otomatik
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap
                      ${isIncome ? 'text-green-600' : 'text-red-500'}`}>
                      {isIncome ? '+' : '-'}₺{fmt(r.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isAuto && (
                        deleteId === r.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-xs text-gray-500">Emin misin?</span>
                            <button onClick={() => handleDelete(r.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium">Sil</button>
                            <button onClick={() => setDeleteId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600">İptal</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteId(r.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                            title="Sil"
                          >
                            ✕
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
