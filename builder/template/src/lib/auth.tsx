import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { store } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = store.get()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const res = await api.get('/auth/me', { auth: true })
      setUser(res && res.user ? res.user : null)
    } catch {
      store.set('')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    if (res && res.token) {
      store.set(res.token)
      setUser(res.user || null)
    }
    return res
  }

  const signup = async (email, password, display_name) => {
    const res = await api.post('/auth/signup', { email, password, display_name })
    if (res && res.token) {
      store.set(res.token)
      setUser(res.user || null)
    }
    return res
  }

  const logout = () => {
    store.set('')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}