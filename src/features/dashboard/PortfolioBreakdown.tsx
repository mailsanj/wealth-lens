import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { PORTFOLIO_TYPES, type PortfolioTypeValue } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PortfolioStat } from '@/hooks/useNetWorth'

const TYPE_COLORS: Record<PortfolioTypeValue, string> = {
  investment: 'bg-blue-100 text-blue-800 border-blue-200',
  retirement:  'bg-amber-100 text-amber-800 border-amber-200',
  education:   'bg-violet-100 text-violet-800 border-violet-200',
  general:     'bg-slate-100 text-slate-700 border-slate-200',
}

const BAR_COLORS: Record<PortfolioTypeValue, string> = {
  investment: 'bg-blue-500',
  retirement:  'bg-amber-500',
  education:   'bg-violet-500',
  general:     'bg-slate-400',
}

interface PortfolioStatWithConversion extends PortfolioStat {
  converted_value: number   // gross, converted to base currency
  converted_equity: number  // equity-adjusted, converted to base currency
  converted_cost: number
}

interface Props {
  portfolios: PortfolioStatWithConversion[]
  currency?: string
  rates?: Record<string, number>
  ratesLoading?: boolean
  ratesError?: string | null
}

export default function PortfolioBreakdown({ portfolios, currency = 'USD', rates = {}, ratesLoading = false, ratesError = null }: Props) {
  // Per-portfolio toggle: true = show in user's base currency, false = native portfolio currency
  const [showConverted, setShowConverted] = useState<Record<string, boolean>>({})

  if (portfolios.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No portfolios yet.
      </div>
    )
  }

  // Use equity total for proportional bar accuracy
  const equityTotal = portfolios.reduce((s, p) => s + p.converted_equity, 0)

  return (
    <ul className="space-y-3">
      {portfolios.map(p => {
        const typeLabel = PORTFOLIO_TYPES.find(t => t.value === p.portfolio_type)?.label ?? p.portfolio_type
        // Show toggle for any portfolio whose currency differs from the user's base —
        // regardless of whether FX rates have loaded yet.
        const hasDifferentCurrency = p.currency !== currency
        const ratesAvailable = !!rates[p.currency]
        const isConverted = (showConverted[p.id] ?? false) && ratesAvailable

        // Values to display — gross total_value for the main number, equity for % bar
        const displayValue = isConverted ? p.converted_value : p.total_value
        const displayEquity = isConverted ? p.converted_equity : p.total_equity
        const displayCost = isConverted ? p.converted_cost : p.total_cost_basis
        const displayGainLoss = displayValue - displayCost  // gross appreciation
        const hasEquityDiff = displayEquity !== displayValue
        const displayCurrency = isConverted ? currency : p.currency

        // % of total uses equity for accurate proportional comparison
        const pctOfTotal = equityTotal > 0 ? ((isConverted ? p.converted_equity : p.total_equity) / equityTotal) * 100 : 0
        const positive = displayGainLoss >= 0
        const barColor = BAR_COLORS[p.portfolio_type as PortfolioTypeValue] ?? 'bg-slate-400'

        return (
          <li key={p.id}>
            <Link to={`/portfolios/${p.id}`} className="group block rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/30">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium group-hover:text-primary">{p.name}</span>
                  <Badge variant="outline" className={cn('shrink-0 text-xs font-normal', TYPE_COLORS[p.portfolio_type as PortfolioTypeValue])}>
                    {typeLabel}
                  </Badge>
                  {/* Currency toggle — only shown for portfolios with a different currency */}
                  {hasDifferentCurrency && (
                    <button
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (ratesAvailable) {
                          setShowConverted(prev => ({ ...prev, [p.id]: !prev[p.id] }))
                        }
                      }}
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-xs transition-colors',
                        ratesAvailable
                          ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer'
                          : 'text-muted-foreground/50 cursor-wait',
                      )}
                      title={
                        ratesError ? `Exchange rates unavailable: ${ratesError}`
                        : ratesLoading ? 'Loading exchange rates…'
                        : !ratesAvailable ? `Rate for ${p.currency} unavailable`
                        : isConverted ? `Show in ${p.currency} (native)`
                        : `Convert to ${currency}`
                      }
                    >
                      {(ratesLoading && !ratesError)
                        ? <Loader2 className="inline h-3 w-3 animate-spin mr-0.5" />
                        : <ArrowLeftRight className="inline h-3 w-3 mr-0.5" />
                      }
                      {/* Show current display currency so user knows what they're viewing */}
                      {isConverted ? currency : p.currency}
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatCurrency(displayValue, displayCurrency)}
                  </div>
                  {hasEquityDiff && (
                    <div className={`text-xs tabular-nums ${displayEquity < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Equity: {formatCurrency(displayEquity, displayCurrency)}
                    </div>
                  )}
                  <div className={`text-xs tabular-nums ${positive ? 'text-emerald-600' : 'text-destructive'}`}>
                    {positive ? '+' : ''}{formatCurrency(displayGainLoss, displayCurrency)}
                  </div>
                </div>
              </div>
              {/* Proportional bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {pctOfTotal.toFixed(1)}% of total
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
