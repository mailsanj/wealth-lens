import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import type { AccessGrant, GrantablePage } from '@/lib/permissions'

interface GrantContextValue {
  effectiveUserId: string | null
  isViewer: boolean
  grantedPages: GrantablePage[]
  grants: AccessGrant[]
  selectedGrant: AccessGrant | null
  selectGrant: (grant: AccessGrant) => void
  loading: boolean
}

const GrantContext = createContext<GrantContextValue | null>(null)

export function GrantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [selectedGrant, setSelectedGrant] = useState<AccessGrant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setGrants([]); setSelectedGrant(null); setLoading(false); return }

    async function load() {
      const { data } = await supabase
        .from('access_grants')
        .select('*')
        .eq('grantee_id', user!.id)
      const found = (data ?? []) as unknown as AccessGrant[]
      setGrants(found)
      setSelectedGrant(found.length === 1 ? found[0] : null)
      setLoading(false)
    }
    load()
  }, [user?.id])

  const isViewer = grants.length > 0
  const effectiveUserId = selectedGrant
    ? selectedGrant.owner_id
    : (grants.length === 0 ? (user?.id ?? null) : null)

  const grantedPages: GrantablePage[] = selectedGrant
    ? selectedGrant.pages
    : []

  return (
    <GrantContext.Provider value={{
      effectiveUserId,
      isViewer,
      grantedPages,
      grants,
      selectedGrant,
      selectGrant: setSelectedGrant,
      loading,
    }}>
      {children}
    </GrantContext.Provider>
  )
}

export function useGrant() {
  const ctx = useContext(GrantContext)
  if (!ctx) throw new Error('useGrant must be used inside GrantProvider')
  return ctx
}
