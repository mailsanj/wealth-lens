import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { convert } from '@/lib/currency'
import type { PortfolioStat } from './useNetWorth'

interface Snapshot {
  id: string
  portfolio_id: string | null    // null when the portfolio has been deleted (SET NULL)
  snapshot_date: string
  total_value: number
  currency: string               // stored at save time — survives portfolio deletion
  breakdown: Record<string, number>
  created_at: string
}

export interface ChartPoint {
  date: string
  value: number
}

interface CurrencyContext {
  rates: Record<string, number>
  baseCurrency: string
}

export function useSnapshots(portfolioIds: string[], currencyCtx?: CurrencyContext) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [taking, setTaking] = useState(false)

  const fetch = useCallback(async () => {
    if (portfolioIds.length === 0) return
    setLoading(true)
    const { data } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .in('portfolio_id', portfolioIds)
      .order('snapshot_date', { ascending: true })
    setSnapshots((data ?? []) as unknown as Snapshot[])
    setLoading(false)
  }, [portfolioIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch() }, [fetch])

  // Aggregate per-portfolio snapshots into a single net-worth-over-time series.
  // Uses snapshot.currency (stored at save time) so deleted portfolios are still
  // correctly converted — no live portfolio lookup needed.
  const chartData = useMemo<ChartPoint[]>(() => {
    const byDate = new Map<string, number>()
    for (const s of snapshots) {
      const value = currencyCtx
        ? convert(s.total_value, s.currency, currencyCtx.baseCurrency, currencyCtx.rates)
        : s.total_value
      byDate.set(s.snapshot_date, (byDate.get(s.snapshot_date) ?? 0) + value)
    }
    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [snapshots, currencyCtx])

  const lastSnapshotDate = chartData.at(-1)?.date ?? null

  // Full datetime of the most recently created snapshot row (for display)
  const lastSnapshotAt = useMemo(() => {
    if (snapshots.length === 0) return null
    return snapshots.reduce((latest, s) =>
      s.created_at > latest ? s.created_at : latest,
      snapshots[0].created_at
    )
  }, [snapshots])

  async function takeSnapshot(portfolioStats: PortfolioStat[]) {
    if (portfolioStats.length === 0) return
    setTaking(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('portfolio_snapshots').upsert(
      portfolioStats.map(p => ({
        portfolio_id: p.id,
        snapshot_date: today,
        total_value: p.total_equity,   // equity (deducts mortgage/HELOC) — matches stat card
        currency: p.currency,
        breakdown: {},
      })),
      { onConflict: 'portfolio_id,snapshot_date' }
    )
    await fetch()
    setTaking(false)
  }

  return { chartData, lastSnapshotDate, lastSnapshotAt, loading, taking, takeSnapshot, refetch: fetch }
}
