import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import './index.css'

const queryClient = new QueryClient()

type Page = 'dashboard' | 'accounts'

function App() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null)

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('antigravity_api_key')
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

  // Listen Supabase auth state changes (Google OAuth callback)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null)

      // Khi user vừa login Google xong (redirect back), auto chuyển sang Accounts page
      if (session?.user && session.provider_token) {
        setCurrentPage('accounts')
      }
    })

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = (key: string) => {
    localStorage.setItem('antigravity_api_key', key)
    setApiKey(key)
  }

  const handleLogout = () => {
    localStorage.removeItem('antigravity_api_key')
    setApiKey(null)
    setCurrentPage('dashboard')
  }

  const handleSupabaseLogout = async () => {
    await supabase.auth.signOut()
    setSupabaseUser(null)
  }

  if (!apiKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginPage onLogin={handleLogin} />
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      {currentPage === 'dashboard' ? (
        <DashboardPage
          apiKey={apiKey}
          onLogout={handleLogout}
          onNavigateToAccounts={() => setCurrentPage('accounts')}
        />
      ) : (
        <AccountsPage
          apiKey={apiKey}
          user={supabaseUser}
          onBack={() => setCurrentPage('dashboard')}
          onLogout={handleSupabaseLogout}
        />
      )}
    </QueryClientProvider>
  )
}

export default App
