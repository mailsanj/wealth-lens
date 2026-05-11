import { Pencil, Trash2, Copy, TrendingUp, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useGrant } from '@/features/auth/GrantContext'
import type { Goal } from '@/hooks/useGoals'
import type { SimulationResult } from '@/types/scenario'
import { yearsToTarget } from '@/lib/simulation'

interface Portfolio { id: string; name: string; total_value: number }

interface Props {
  goal: Goal
  allPortfolios: Portfolio[]
  totalNetWorth: number
  simulationResult?: SimulationResult
  currency?: string
  onEdit: (goal: Goal) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => Promise<void>
}

export default function GoalCard({ goal, allPortfolios, totalNetWorth, simulationResult, currency = 'USD', onEdit, onDuplicate, onDelete }: Props) {
  const { isViewer } = useGrant()
  // Use linked portfolios' combined value if specified, otherwise total net worth
  const currentValue = goal.linked_portfolio_ids?.length > 0
    ? allPortfolios
        .filter(p => goal.linked_portfolio_ids.includes(p.id))
        .reduce((sum, p) => sum + p.total_value, 0)
    : totalNetWorth

  const progressPct = Math.min(100, goal.target_value > 0 ? (currentValue / goal.target_value) * 100 : 0)
  const remaining = Math.max(0, goal.target_value - currentValue)

  const targetDate = new Date(goal.target_date)
  const now = new Date()
  const yearsLeft = Math.max(0, (targetDate.getTime() - now.getTime()) / (365.25 * 86400 * 1000))
  const isPast = targetDate < now

  const linkedPortfolioNames = allPortfolios
    .filter(p => goal.linked_portfolio_ids?.includes(p.id))
    .map(p => p.name)

  const projectedYear = simulationResult ? yearsToTarget(simulationResult, goal.target_value) : null
  const onTrack = projectedYear !== null && projectedYear <= Math.ceil(yearsLeft)

  return (
    <Card className="group">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{goal.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Target {formatDate(goal.target_date)}
            {!isPast && ` · ${yearsLeft.toFixed(1)}y away`}
          </p>
          {linkedPortfolioNames.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tracking: {linkedPortfolioNames.join(', ')}
            </p>
          )}
        </div>
        {!isViewer && (
          <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => onEdit(goal)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDuplicate(goal.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground" title="Duplicate">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(goal.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-end justify-between text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Current</div>
            <div className="font-semibold tabular-nums">{formatCurrency(currentValue, currency)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="font-semibold tabular-nums">{formatCurrency(goal.target_value, currency)}</div>
          </div>
        </div>

        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{progressPct.toFixed(1)}% complete</span>
            <span>{formatCurrency(remaining, currency)} to go</span>
          </div>
        </div>

        {simulationResult && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            onTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {onTrack
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : projectedYear !== null
              ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              : <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            }
            <span>
              {onTrack
                ? `On track — projection reaches target in year ${projectedYear}`
                : projectedYear !== null
                ? `Off track — projection reaches target in year ${projectedYear} (${Math.round(projectedYear - yearsLeft)}y late)`
                : 'Projection does not reach target within the time horizon'
              }
            </span>
          </div>
        )}

        {goal.linked_scenario_id && !simulationResult && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 shrink-0" />
            <span>Linked to a scenario — open Scenarios to see the projection.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
