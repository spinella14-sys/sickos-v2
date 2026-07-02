import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined) // undefined = loading, null = logged out
  const [manager, setManager] = useState(null)      // managers table row
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchManager(session.user.id)
      else setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchManager(session.user.id)
      else { setManager(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchManager(userId) {
    const { data } = await supabase
      .from('managers')
      .select('*, teams(name, abbrev)')
      .eq('id', userId)
      .single()
    setManager(data || null)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setManager(null)
  }

  const isAdmin = manager?.is_admin === true
  const teamAbbrev = manager?.team_abbrev || null

  return (
    <AuthContext.Provider value={{ user, manager, loading, isAdmin, teamAbbrev, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
