import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: () => void
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)
const authBase = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/auth`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch(`${authBase}/me`)
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
    window.location.href = `${authBase}/discord/login`
  }

  const logout = async () => {
    await fetch(`${authBase}/logout`, { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === 'admin'
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
