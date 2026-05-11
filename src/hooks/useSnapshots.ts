import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { PortfolioStat } from './useNetWorth'

interface Snapshot {
  id: string
  portfolio_id: string
  snapshot_date: string
  total_value: number
  breakdown: Record<string, number>
}

export interface ChartPoint {
  date: string
  value: number
}

export function useSnapshots(portfolioIds: string[]) {
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

  // Aggregate per-portfolio snapshots into a single net-worth-over-time series
  const chartData = useMemo<ChartPoint[]>(() => {
    const byDate = new Map<string, number>()
    for (const s of snapshots) {
      byDate.set(s.snapshot_date, (byDate.get(s.snapshot_date) ?? 0) + s.total_value)
    }
    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [snapshots])

  const lastSnapshotDate = chartData.at(-1)?.date ?? null

  async function takeSnapshot(portfolioStats: PortfolioStat[]) {
    if (portfolioStats.length === 0) return
    setTaking(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('portfolio_snapshots').upsert(
      portfolioStats.map(p => ({
        portfolio_id: p.id,
        snapshot_date: today,
        total_value: p.total_value,
        breakdown: {},
      })),
      { onConflict: 'portfolio_id,snapshot_date' }
    )
    await fetch()
    setTaking(false)
  }

  return { chartData, lastSnapshotDate, loading, taking, takeSnapshot, refetch: fetch }
}
