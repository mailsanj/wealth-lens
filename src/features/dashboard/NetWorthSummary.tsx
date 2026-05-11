import { AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'

interface Props {
  totalValue: number
  totalCostBasis: number
  gainLoss: number
  gainLossPct: number
  currency?: string
  ratesLoading?: boolean
  ratesError?: string | null
  hasMixedCurrencies?: boolean
}

export default function NetWorthSummary({
  totalValue, totalCostBasis, gainLoss, gainLossPct,
  currency = 'USD', ratesLoading, ratesError, hasMixedCurrencies,
}: Props) {
  const positive = gainLoss >= 0

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Net Worth" value={formatCurrency(totalValue, currency)} highlight />
        <StatCard label="Total Cost Basis" value={formatCurrency(totalCostBasis, currency)} />
        <StatCard
          label="Gain / Loss"
          value={`${positive ? '+' : ''}${formatCurrency(gainLoss, currency)}`}
          valueClass={positive ? 'text-emerald-600' : 'text-destructive'}
        />
        <StatCard
          label="Overall Return"
          value={`${positive ? '+' : ''}${formatPercent(gainLossPct)}`}
          valueClass={positive ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>

      {/* Currency conversion status — only shown when portfolios use mixed currencies */}
      {hasMixedCurrencies && (
        <div className={`flex items-center gap-1.5 text-xs ${ratesError ? 'text-destructive' : 'text-muted-foreground'}`}>
          {ratesError ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Exchange rates unavailable — values shown in each portfolio's native currency.
                <span className="ml-1 opacity-70">({ratesError})</span>
              </span>
            </>
          ) : ratesLoading ? (
            <span>Fetching exchange rates to convert all portfolios to {currency}…</span>
          ) : (
            <span>Totals converted to {currency} · Live rates via ExchangeRate-API (cached 4h)</span>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, valueClass = '', highlight = false }: {
  label: string; value: string; valueClass?: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
      <div className={`text-xs ${highlight ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${highlight ? 'text-primary-foreground' : valueClass}`}>
        {value}
      </div>
    </div>
  )
}
