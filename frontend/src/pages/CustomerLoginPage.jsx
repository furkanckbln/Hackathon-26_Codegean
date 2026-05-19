/**
 * CustomerLoginPage — Müşteri Girişi
 * Giriş sonrası user_type kontrolü:
 *   customer → /store
 *   seller   → /dashboard (yanlış sayfadan girdiyse)
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CustomerLoginPage() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data    = await login(email, password)
      const userType = data?.user?.user_metadata?.user_type ?? 'customer'
      // Satıcıyı yanlışlıkla buradan girerse kendi paneline gönder
      navigate(userType === 'seller' ? '/dashboard' : '/store')
    } catch (err) {
      setError(err.message || 'Giriş başarısız.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">

        {/* Logo / Başlık */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            D
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            Dijital<span className="text-orange-500">Esnaf</span> Mağaza
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Müşteri hesabınla giriş yap</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300
                       text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Hesabın yok mu?{' '}
          <Link to="/customer/register" className="text-orange-500 hover:underline font-medium">
            Üye Ol
          </Link>
        </p>

        <div className="border-t border-gray-100 mt-6 pt-4 text-center">
          <Link to="/store" className="text-xs text-gray-400 hover:text-gray-600">
            ← Mağazaya dön
          </Link>
        </div>
      </div>
    </div>
  )
}
