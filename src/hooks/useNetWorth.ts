import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { useGrant } from '@/features/auth/GrantContext'
import { computeEffectiveValue } from '@/lib/holdings'
import type { AssetTypeValue } from '@/lib/constants'

interface HoldingRow {
  asset_type: string
  current_value: number
  cost_basis: number
  metadata: Record<string, unknown>
}

interface PortfolioRow {
  id: string
  name: string
  currency: string
  portfolio_type: string
  holdings: HoldingRow[]
}

export interface PortfolioStat {
  id: string
  name: string
  currency: string
  portfolio_type: string
  total_value: number       // gross (sum of current_value) — shown on cards
  total_equity: number      // equity-adjusted (deducts mortgage/HELOC) — used for net worth aggregate
  total_cost_basis: number
  gain_loss: number         // gross appreciation: total_value - total_cost_basis
  gain_loss_pct: number
  pct_of_total: number      // % of total equity, for proportional bar accuracy
}

export interface NetWorthData {
  portfolioStats: PortfolioStat[]
  portfolioIds: string[]
  totalValue: number        // equity-adjusted net worth (true wealth for the stat card)
  totalCostBasis: number
  gainLoss: number          // gross appreciation: totalGrossValue - totalCostBasis
  gainLossPct: number
  byAssetType: { type: AssetTypeValue; value: number; pct: number }[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useNetWorth(): NetWorthData {
  useAuth()
  const { effectiveUserId } = useGrant()
  const [rows, setRows] = useState<PortfolioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('portfolios')
      .select('id, name, currency, portfolio_type, holdings(asset_type, current_value, cost_basis, metadata)')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) setError(error.message)
    else setRows((data ?? []) as unknown as PortfolioRow[])
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { fetch() }, [fetch])

  const computed = useMemo(() => {
    const portfolioStats: PortfolioStat[] = rows.map(p => {
      const tv = p.holdings.reduce((s, h) => s + h.current_value, 0)            // gross
      const te = p.holdings.reduce((s, h) => s + computeEffectiveValue(h), 0)   // equity
      const cb = p.holdings.reduce((s, h) => s + h.cost_basis, 0)
      const gl = tv - cb  // gain/loss = gross appreciation
      return {
        id: p.id, name: p.name, currency: p.currency, portfolio_type: p.portfolio_type,
        total_value: tv,
        total_equity: te,
        total_cost_basis: cb,
        gain_loss: gl,
        gain_loss_pct: cb > 0 ? (gl / cb) * 100 : 0,
        pct_of_total: 0,  // filled in below once we know the equity total
      }
    })

    // Aggregate using equity for true net worth; gross for gain/loss
    const totalEquity = portfolioStats.reduce((s, p) => s + p.total_equity, 0)
    const totalGross   = portfolioStats.reduce((s, p) => s + p.total_value, 0)
    const totalCostBasis = portfolioStats.reduce((s, p) => s + p.total_cost_basis, 0)

    // Fill pct_of_total based on equity
    portfolioStats.forEach(p => {
      p.pct_of_total = totalEquity > 0 ? (p.total_equity / totalEquity) * 100 : 0
    })
    portfolioStats.sort((a, b) => b.total_equity - a.total_equity)

    const gainLoss = totalGross - totalCostBasis
    const gainLossPct = totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0

    // Asset class breakdown uses equity values so the donut reflects true allocation
    const assetMap = new Map<string, number>()
    for (const p of rows) {
      for (const h of p.holdings) {
        const ev = computeEffectiveValue(h)
        assetMap.set(h.asset_type, (assetMap.get(h.asset_type) ?? 0) + ev)
      }
    }
    const byAssetType = Array.from(assetMap.entries())
      .map(([type, value]) => ({
        type: type as AssetTypeValue,
        value,
        pct: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    return { portfolioStats, totalValue: totalEquity, totalCostBasis, gainLoss, gainLossPct, byAssetType }
  }, [rows])

  return {
    ...computed,
    portfolioIds: rows.map(p => p.id),
    loading,
    error,
    refetch: fetch,
  }
}
