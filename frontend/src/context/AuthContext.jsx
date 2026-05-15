import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sayfa açılınca mevcut oturumu kontrol et
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Oturum değişikliklerini dinle (giriş/çıkış)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const register = async (email, password, storeName, userType = 'seller') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          store_name: storeName || '',
          user_type:  userType,
        },
      },
    })
    if (error) throw error
    return data
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  /** Mevcut kullanıcının tipini döndürür: 'seller' | 'customer' */
  const getUserType = () => user?.user_metadata?.user_type ?? 'seller'

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, getUserType }}>
      {children}
    </AuthContext.Provider>
  )
}

// Kolayca erişmek için hook
export function useAuth() {
  return useContext(AuthContext)
}
