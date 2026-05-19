/**
 * CustomerRegisterPage — Müşteri Kayıt
 * user_type = 'customer' olarak kaydeder.
 * Kayıt sonrası /customer/login'e yönlendirir.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CustomerRegisterPage() {
  const { register } = useAuth()
  const navigate     = useNavigate()

  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [loading,   setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== password2) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.')
      return
    }

    setLoading(true)
    try {
      // store_name yerine full_name, user_type = 'customer'
      await register(email, password, fullName, 'customer')
      setSuccess('Kayıt başarılı! E-postanı doğruladıktan sonra giriş yapabilirsin.')
    } catch (err) {
      setError(err.message || 'Kayıt başarısız.')
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
            S
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            Dijital<span className="text-orange-500">Esnaf</span> Mağaza
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Yeni müşteri hesabı oluştur</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            {success}
            <div className="mt-2">
              <Link to="/customer/login" className="font-medium underline">
                Giriş sayfasına git →
              </Link>
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Adın ve soyadın"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

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
                placeholder="En az 6 karakter"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre Tekrar</label>
              <input
                type="password"
                required
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                placeholder="Şifreni tekrarla"
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
              {loading ? 'Kayıt yapılıyor…' : 'Üye Ol'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Zaten hesabın var mı?{' '}
          <Link to="/customer/login" className="text-orange-500 hover:underline font-medium">
            Giriş Yap
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
