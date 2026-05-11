import { Link } from 'react-router-dom'
import { ChevronRight, GripVertical, Pencil, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { PORTFOLIO_TYPES, type PortfolioTypeValue } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useGrant } from '@/features/auth/GrantContext'
import type { PortfolioWithValue } from '@/hooks/usePortfolios'

const TYPE_COLORS: Record<PortfolioTypeValue, string> = {
  investment: 'bg-blue-100 text-blue-800 border-blue-200',
  retirement:  'bg-amber-100 text-amber-800 border-amber-200',
  education:   'bg-violet-100 text-violet-800 border-violet-200',
  general:     'bg-slate-100 text-slate-700 border-slate-200',
}

interface Props {
  portfolio: PortfolioWithValue
  onEdit: (portfolio: PortfolioWithValue) => void
  onDuplicate: (id: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isDragging?: boolean
}

export default function PortfolioCard({ portfolio, onEdit, onDuplicate, dragHandleProps, isDragging }: Props) {
  const { isViewer } = useGrant()
  const typeLabel = PORTFOLIO_TYPES.find(t => t.value === portfolio.portfolio_type)?.label ?? portfolio.portfolio_type
  const gainLoss = portfolio.total_value - portfolio.total_cost_basis
  const hasEquityDiff = portfolio.total_equity !== portfolio.total_value

  function handleEdit(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onEdit(portfolio)
  }

  return (
    <Link to={`/portfolios/${portfolio.id}`}>
      <Card className={cn(
        'group cursor-pointer transition-colors hover:border-primary/50',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30',
      )}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Drag handle */}
            <div
              {...dragHandleProps}
              onClick={e => e.preventDefault()}
              className="cursor-grab text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0" />
            </div>
            <CardTitle className="truncate text-base font-medium">{portfolio.name}</CardTitle>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className={cn('font-normal', TYPE_COLORS[portfolio.portfolio_type as PortfolioTypeValue])}>
              {typeLabel}
            </Badge>
            {!isViewer && (
              <>
                <button
                  onClick={handleEdit}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                  title="Edit portfolio"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onDuplicate(portfolio.id) }}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                  title="Duplicate portfolio"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {formatCurrency(portfolio.total_value, portfolio.currency)}
          </div>
          {hasEquityDiff && (
            <div className={`text-xs tabular-nums ${portfolio.total_equity < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              Equity: {formatCurrency(portfolio.total_equity, portfolio.currency)}
            </div>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {portfolio.holdings_count} holding{portfolio.holdings_count !== 1 ? 's' : ''}
            </span>
            {portfolio.total_cost_basis > 0 && (
              <span className={gainLoss >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, portfolio.currency)}
              </span>
            )}
          </div>
          {portfolio.description && (
            <p className="mt-2 text-sm text-muted-foreground">{portfolio.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
