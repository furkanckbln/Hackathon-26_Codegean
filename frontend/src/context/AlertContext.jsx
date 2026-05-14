/**
 * AlertContext — Anomali uyarı sistemi için global React context.
 *
 * • Her 5 dakikada bir /finance/alerts pollar
 * • hasCritical bayrağını ve alert listesini tüm uygulamaya sağlar
 * • Zorla yönlendirme KALDIRILDI — Layout'taki bell icon yeterli
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import api from '../services/api'

const AlertContext = createContext(null)

const POLL_INTERVAL_MS = 5 * 60 * 1000   // 5 dakika

export function AlertProvider({ children }) {
  const { user } = useAuth()

  const [alerts,      setAlerts]      = useState([])
  const [hasCritical, setHasCritical] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [lastChecked, setLastChecked] = useState(null)

  // Stale closure sorununu önlemek için user'ı ref'te tut
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  const fetchAlerts = useCallback(async () => {
    if (!userRef.current) return
    setLoading(true)
    try {
      const { data } = await api.get('/finance/alerts')
      setAlerts(data.alerts ?? [])
      setHasCritical(data.has_critical ?? false)
      setLastChecked(data.checked_at ?? new Date().toISOString())
    } catch (err) {
      console.warn('[AlertContext] Uyarılar yüklenemedi:', err?.message)
    } finally {
      setLoading(false)
    }
  }, [])   // deps boş — location ya da navigate bağımlılığı yok

  // İlk yükleme + intervalli polling
  useEffect(() => {
    if (!user) {
      setAlerts([])
      setHasCritical(false)
      return
    }
    fetchAlerts()
    const id = setInterval(fetchAlerts, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [user, fetchAlerts])

  const unreadCount = alerts.filter(
    a => a.severity === 'critical' || a.severity === 'medium'
  ).length

  return (
    <AlertContext.Provider value={{
      alerts,
      hasCritical,
      loading,
      lastChecked,
      unreadCount,
      refresh: fetchAlerts,
    }}>
      {children}
    </AlertContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider')
  return ctx
}
