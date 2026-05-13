import Layout from '../components/shared/Layout'

export default function FinanceTransactionsPage() {
  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gelir & Giderler</h2>
        <p className="text-gray-500 text-sm mt-1">Sipariş bazında gelir-gider detayı.</p>
      </div>
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-20 text-center">
        <div className="text-5xl mb-4">💸</div>
        <p className="text-gray-500 font-medium">Yakında burada</p>
      </div>
    </Layout>
  )
}
