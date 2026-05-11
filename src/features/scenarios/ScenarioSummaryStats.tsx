import { formatCurrency } from '@/lib/formatters'
import type { SimulationResult } from '@/types/scenario'

interface Props {
  result: SimulationResult
  currency?: string
}

export default function ScenarioSummaryStats({ result, currency = 'USD' }: Props) {
  const totalContributions = result.years.reduce((s, y) => s + y.contribution, 0)
  const totalGrowth = result.years.reduce((s, y) => s + y.growth, 0)
  const totalWithdrawals = result.years.reduce((s, y) => s + y.withdrawal, 0)
  const peakYear = result.years.reduce((best, y) => y.endValue > best.endValue ? y : best, result.years[0])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="Final Value" value={formatCurrency(result.finalValue, currency)} highlight />
      <Stat label="Inflation-Adjusted" value={formatCurrency(result.finalInflationAdjustedValue, currency)} />
      <Stat label="Peak Value" value={`${formatCurrency(peakYear?.endValue ?? 0, currency)} (yr ${peakYear?.year ?? '-'})`} />
      <Stat label="Total Contributions" value={formatCurrency(totalContributions, currency)} />
      <Stat label="Total Growth" value={formatCurrency(totalGrowth, currency)} />
      <Stat label="Total Withdrawals" value={formatCurrency(totalWithdrawals, currency)} />
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  )
}
