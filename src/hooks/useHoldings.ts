import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Holding } from '@/types/holding'

export function useHoldings(portfolioId: string) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHoldings = useCallback(async () => {
    if (!portfolioId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('holdings')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setHoldings((data ?? []) as unknown as Holding[])
    setLoading(false)
  }, [portfolioId])

  useEffect(() => { fetchHoldings() }, [fetchHoldings])

  async function createHolding(input: Omit<Holding, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('holdings')
      .insert(input as never)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setHoldings(prev => [data as unknown as Holding, ...prev])
    return data as unknown as Holding
  }

  async function updateHolding(
    id: string,
    updates: Partial<Omit<Holding, 'id' | 'portfolio_id' | 'created_at' | 'updated_at'>>
  ) {
    const { data, error } = await supabase
      .from('holdings')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const updated = data as unknown as Holding
    setHoldings(prev => prev.map(h => h.id === id ? updated : h))
    return updated
  }

  async function duplicateHolding(id: string) {
    const source = holdings.find(h => h.id === id)
    if (!source) return
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = source
    return createHolding({ ...rest, name: `Copy of ${source.name}` })
  }

  async function deleteHolding(id: string) {
    const { error } = await supabase.from('holdings').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setHoldings(prev => prev.filter(h => h.id !== id))
  }

  return { holdings, loading, error, createHolding, updateHolding, duplicateHolding, deleteHolding, refetch: fetchHoldings }
}
