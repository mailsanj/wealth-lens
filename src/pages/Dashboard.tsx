import { useMemo } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGrant } from '@/features/auth/GrantContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useProfile } from '@/hooks/useProfile'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { convert } from '@/lib/currency'
import NetWorthSummary from '@/features/dashboard/NetWorthSummary'
import PortfolioBreakdown from '@/features/dashboard/PortfolioBreakdown'
import AllocationChart from '@/components/charts/AllocationChart'
import NetWorthChart from '@/components/charts/NetWorthChart'
import { formatDateTime } from '@/lib/formatters'

export default function Dashboard() {
  const { isViewer } = useGrant()
  const { profile } = useProfile()
  const { portfolioStats, portfolioIds, byAssetType, loading } = useNetWorth()
  const currency = profile?.currency ?? 'USD'
  const { rates, loading: ratesLoading, error: ratesError } = useExchangeRates(currency)

  const { chartData, lastSnapshotAt, taking, takeSnapshot } = useSnapshots(
    portfolioIds,
    Object.keys(rates).length > 0 ? { rates, baseCurrency: currency } : undefined
  )

  // Convert each portfolio's value to the user's base currency, then aggregate
  const converted = useMemo(() => {
    const withConversion = portfolioStats.map(p => ({
      ...p,
      converted_value: convert(p.total_value, p.currency, currency, rates),    // gross for card display
      converted_equity: convert(p.total_equity, p.currency, currency, rates),  // equity for net worth total
      converted_cost: convert(p.total_cost_basis, p.currency, currency, rates),
    }))
    // Net Worth stat uses equity (true wealth); Gain/Loss uses gross appreciation
    const totalValue = withConversion.reduce((s, p) => s + p.converted_equity, 0)
    const totalGross = withConversion.reduce((s, p) => s + p.converted_value, 0)
    const totalCostBasis = withConversion.reduce((s, p) => s + p.converted_cost, 0)
    const gainLoss = totalGross - totalCostBasis
    const gainLossPct = totalCostBasis > 0 ? (gainLoss / totalCostBasis) * 100 : 0
    const hasMixedCurrencies = portfolioStats.some(p => p.currency !== currency)
    return { withConversion, totalValue, totalCostBasis, gainLoss, gainLossPct, hasMixedCurrencies }
  }, [portfolioStats, currency, rates])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {profile?.display_name ? `Welcome back, ${profile.display_name}` : 'Dashboard'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lastSnapshotAt
              ? `Last snapshot: ${formatDateTime(lastSnapshotAt)}`
              : 'No snapshots yet — take one to start tracking history'}
          </p>
        </div>
        {!isViewer && (
          <Button
            variant="outline"
            onClick={() => takeSnapshot(portfolioStats)}
            disabled={taking || portfolioStats.length === 0}
          >
            <Camera className="mr-2 h-4 w-4" />
            {taking ? 'Saving…' : 'Take Snapshot'}
          </Button>
        )}
      </div>

      {/* Stat cards — always in user's base currency, converted if needed */}
      <NetWorthSummary
        totalValue={converted.totalValue}
        totalCostBasis={converted.totalCostBasis}
        gainLoss={converted.gainLoss}
        gainLossPct={converted.gainLossPct}
        currency={currency}
        ratesLoading={ratesLoading}
        ratesError={ratesError}
        hasMixedCurrencies={converted.hasMixedCurrencies}
      />

      {/* Allocation + Portfolio breakdown */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationChart data={byAssetType} currency={currency} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioBreakdown
              portfolios={converted.withConversion}
              currency={currency}
              rates={rates}
              ratesLoading={ratesLoading}
              ratesError={ratesError}
            />
          </CardContent>
        </Card>
      </div>

      {/* Historical net worth */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <NetWorthChart data={chartData} currency={currency} />
        </CardContent>
      </Card>
    </div>
  )
}
