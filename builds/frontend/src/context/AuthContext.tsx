import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '@/types'
import { apiBase } from '@/api/base'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: () => void
  logout: () => void
  isAdmin: boolean
  isCoach: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)
const authBase = `${apiBase}/auth`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch(`${authBase}/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      }
    } catch {
      // not logged in
    } finally {
      setIsLoading(false)
    }
  }

  const login = () => {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const url = new URL(`${authBase}/discord/login`, window.location.origin)
    url.searchParams.set('next', next)
    window.location.href = url.toString()
  }

  const logout = async () => {
    await fetch(`${authBase}/logout`, { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      isCoach: user?.role === 'admin' || !!user?.is_coach
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
