import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Employee } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  employee: Employee | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshEmployee: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchEmployee = async (userId: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, group:groups(id,name), position:positions(id,name,code)')
      .eq('auth_user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (!error && data) {
      setEmployee(data as Employee)
    } else {
      setEmployee(null)
    }
  }

  const refreshEmployee = async () => {
    if (user) await fetchEmployee(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.id).finally(() => setLoading(false))
      else {
        setEmployee(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setEmployee(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, employee, loading, signInWithGoogle, signOut, refreshEmployee }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
