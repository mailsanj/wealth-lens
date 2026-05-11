import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { useGrant } from '@/features/auth/GrantContext'
import { computeEffectiveValue } from '@/lib/holdings'
import type { Portfolio } from '@/types/portfolio'

export interface PortfolioWithValue extends Portfolio {
  sort_order: number
  total_value: number       // gross (sum of current_value) — shown on cards
  total_equity: number      // equity-adjusted (deducts mortgage/HELOC for real estate)
  total_cost_basis: number
  holdings_count: number
}

type RawPortfolio = Portfolio & {
  sort_order: number
  holdings: { asset_type: string; current_value: number; cost_basis: number; metadata: Record<string, unknown> }[]
}

export function usePortfolios() {
  const { user } = useAuth()
  const { effectiveUserId } = useGrant()
  const [portfolios, setPortfolios] = useState<PortfolioWithValue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortfolios = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('portfolios')
      .select('*, holdings(asset_type, current_value, cost_basis, metadata)')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      const rows = (data ?? []) as unknown as RawPortfolio[]
      setPortfolios(rows.map(p => ({
        ...p,
        holdings: undefined as never,
        total_value: p.holdings.reduce((s, h) => s + h.current_value, 0),
        total_equity: p.holdings.reduce((s, h) => s + computeEffectiveValue(h), 0),
        total_cost_basis: p.holdings.reduce((s, h) => s + h.cost_basis, 0),
        holdings_count: p.holdings.length,
      })))
    }
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { fetchPortfolios() }, [fetchPortfolios])

  async function createPortfolio(
    input: Pick<Portfolio, 'name' | 'description' | 'portfolio_type' | 'currency'>
  ) {
    const nextOrder = portfolios.length
    const { data, error } = await supabase
      .from('portfolios')
      .insert({ ...input, user_id: user!.id, is_active: true, sort_order: nextOrder })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const p = data as unknown as Portfolio & { sort_order: number }
    setPortfolios(prev => [...prev, { ...p, total_value: 0, total_equity: 0, total_cost_basis: 0, holdings_count: 0 }])
    return p
  }

  async function updatePortfolio(
    id: string,
    input: Pick<Portfolio, 'name' | 'description' | 'portfolio_type' | 'currency'>
  ) {
    const { data, error } = await supabase
      .from('portfolios')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const updated = data as unknown as Portfolio
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    return updated
  }

  async function reorderPortfolios(orderedIds: string[]) {
    // Optimistic update
    setPortfolios(prev => {
      const map = new Map(prev.map(p => [p.id, p]))
      return orderedIds.map((id, index) => ({ ...map.get(id)!, sort_order: index }))
    })
    // Persist — one update per portfolio
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('portfolios').update({ sort_order: index }).eq('id', id)
      )
    )
  }

  async function duplicatePortfolio(id: string) {
    const source = portfolios.find(p => p.id === id)
    if (!source) return
    // Create the new portfolio
    const { data: newPf, error: pfErr } = await supabase
      .from('portfolios')
      .insert({ name: `Copy of ${source.name}`, description: source.description, portfolio_type: source.portfolio_type, currency: source.currency, user_id: user!.id, is_active: true, sort_order: portfolios.length })
      .select().single()
    if (pfErr) throw new Error(pfErr.message)
    const newPortfolio = newPf as unknown as Portfolio & { sort_order: number }
    // Fetch source holdings and copy them
    const { data: sourceHoldings } = await supabase.from('holdings').select('*').eq('portfolio_id', id)
    if (sourceHoldings && sourceHoldings.length > 0) {
      const copies = (sourceHoldings as unknown as { portfolio_id: string; asset_type: string; name: string; symbol: string | null; quantity: number; cost_basis: number; current_value: number; purchase_date: string | null; notes: string | null; metadata: object }[])
        .map(({ portfolio_id: _pid, ...h }) => ({ ...h, portfolio_id: newPortfolio.id }))
      await supabase.from('holdings').insert(copies as never)
    }
    await fetchPortfolios()
    return newPortfolio
  }

  async function deletePortfolio(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setPortfolios(prev => prev.filter(p => p.id !== id))
  }

  return { portfolios, loading, error, createPortfolio, updatePortfolio, reorderPortfolios, duplicatePortfolio, deletePortfolio, refetch: fetchPortfolios }
}
