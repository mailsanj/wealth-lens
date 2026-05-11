import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMultipleScenarios } from '@/hooks/useScenarios'
import { useProfile } from '@/hooks/useProfile'
import { useNetWorth } from '@/hooks/useNetWorth'
import { runSimulation } from '@/lib/simulation'
import ScenarioCompareChart from '@/components/charts/ScenarioCompareChart'
import { formatCurrency } from '@/lib/formatters'

// Reuse the scenario color palette from the chart
const COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#db2777']

export default function ScenarioCompare() {
  const [searchParams] = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const { bundles, loading } = useMultipleScenarios(ids)
  const { profile } = useProfile()
  const { totalValue } = useNetWorth()
  const currency = profile?.currency ?? 'USD'

  const results = useMemo(() =>
    bundles.map(b => runSimulation({
      config: b.config,
      events: b.events,
      futureContributions: b.futureContributions,
      scenarioId: b.scenario.id,
      scenarioName: b.scenario.name,
    })),
    [bundles]
  )

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }

  if (bundles.length < 2) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Select at least 2 scenarios to compare. <Link to="/scenarios" className="underline">Back to scenarios</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link to="/scenarios" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All Scenarios
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Scenario Comparison</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Comparing {bundles.length} scenarios
        </p>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Projection Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ScenarioCompareChart results={results} currentNetWorth={totalValue} currency={currency} />
        </CardContent>
      </Card>

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Scenario</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Final Value</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Inflation-Adjusted</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Peak Value</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Peak Year</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Horizon</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map((r, i) => {
                  const peak = r.years.reduce((best, y) => y.endValue > best.endValue ? y : best, r.years[0])
                  return (
                    <tr key={r.scenarioId} className="hover:bg-muted/30">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <Link to={`/scenarios/${r.scenarioId}`} className="font-medium hover:text-primary hover:underline">
                            {r.scenarioName}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 text-right tabular-nums font-semibold">{formatCurrency(r.finalValue, currency)}</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(r.finalInflationAdjustedValue, currency)}</td>
                      <td className="py-3 text-right tabular-nums">{formatCurrency(peak?.endValue ?? 0, currency)}</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">{peak?.year ?? '—'}</td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">{bundles[i]?.config.time_horizon_years}y</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
