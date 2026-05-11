import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { computeEffectiveValue } from '@/lib/holdings'

export interface OverlayPoint {
  year: number     // simulation year (1-based, relative to startYear)
  value: number    // equity-adjusted net worth at that snapshot date
}

/**
 * Fetches portfolio snapshots for the given portfolios, aggregates them by date,
 * and maps each date to a simulation year relative to startYear.
 * Snapshots taken before startYear are excluded (hidden per user preference).
 */
export function useScenarioOverlay(
  portfolioIds: string[],
  startYear: number,
  enabled: boolean,
) {
  const [snapshots, setSnapshots] = useState<{ snapshot_date: string; total_value: number }[]>([])
  const [loading, setLoading] = useState(false)
  const key = [...portfolioIds].sort().join(',')

  const fetch = useCallback(async () => {
    if (!enabled || portfolioIds.length === 0) return
    setLoading(true)
    const { data } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value')
      .in('portfolio_id', portfolioIds)
      .order('snapshot_date', { ascending: true })
    setSnapshots((data ?? []) as { snapshot_date: string; total_value: number }[])
    setLoading(false)
  }, [key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch() }, [fetch])

  const overlayData = useMemo<OverlayPoint[]>(() => {
    if (!enabled || snapshots.length === 0) return []

    // Aggregate by date (sum total_value across portfolios for the same date)
    const byDate = new Map<string, number>()
    for (const s of snapshots) {
      byDate.set(s.snapshot_date, (byDate.get(s.snapshot_date) ?? 0) + s.total_value)
    }

    return Array.from(byDate.entries())
      .map(([date, value]) => ({
        year: new Date(date).getFullYear() - startYear + 1,
        value,
      }))
      .filter(p => p.year >= 1)  // hide snapshots before scenario start year
      .sort((a, b) => a.year - b.year)
  }, [snapshots, startYear, enabled])

  return { overlayData, loading, refetch: fetch }
}

// Fetch a single portfolio's holdings and compute equity-adjusted total
// Used by the overlay to get the current equity-correct value for comparison
export function usePortfolioEquity(portfolioIds: string[]) {
  const [equityTotal, setEquityTotal] = useState<number | null>(null)
  const key = [...portfolioIds].sort().join(',')

  useEffect(() => {
    if (portfolioIds.length === 0) return
    supabase
      .from('holdings')
      .select('asset_type, current_value, metadata')
      .in('portfolio_id', portfolioIds)
      .then(({ data }) => {
        if (!data) return
        const total = (data as unknown as { asset_type: string; current_value: number; metadata: Record<string, unknown> }[])
          .reduce((s, h) => s + computeEffectiveValue(h), 0)
        setEquityTotal(total)
      })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return equityTotal
}
