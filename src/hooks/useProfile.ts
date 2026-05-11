import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import type { Profile } from '@/types/user'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(data as unknown as Profile)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'currency' | 'date_format'>>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user!.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProfile(data as unknown as Profile)
  }

  return { profile, loading, updateProfile }
}
