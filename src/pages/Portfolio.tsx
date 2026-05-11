import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plus, ChevronLeft, Trash2, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useGrant } from '@/features/auth/GrantContext'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePortfolios } from '@/hooks/usePortfolios'
import { useHoldings } from '@/hooks/useHoldings'
import HoldingsList from '@/features/holdings/HoldingsList'
import HoldingForm from '@/features/holdings/HoldingForm'
import { formatCurrency } from '@/lib/formatters'
import { PORTFOLIO_TYPES } from '@/lib/constants'
import { exportHoldingsCsv } from '@/lib/export'
import { exportHoldingsXlsx } from '@/lib/exportXlsx'
import type { Holding } from '@/types/holding'

export default function Portfolio() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { portfolios, deletePortfolio } = usePortfolios()
  const portfolio = portfolios.find(p => p.id === id)

  const { holdings, loading, createHolding, updateHolding, duplicateHolding, deleteHolding, refetch: refetchHoldings } = useHoldings(id ?? '')
  const { isViewer } = useGrant()

  const [showAddHolding, setShowAddHolding] = useState(false)
  const [editHolding, setEditHolding] = useState<Holding | null>(null)
  const [showDeletePortfolio, setShowDeletePortfolio] = useState(false)
  const [deletingPortfolio, setDeletingPortfolio] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ updated: number; message?: string } | null>(null)

  const stats = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + h.current_value, 0)
    const totalCost = holdings.reduce((s, h) => s + h.cost_basis, 0)
    const gainLoss = totalValue - totalCost
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
    return { totalValue, totalCost, gainLoss, gainLossPct }
  }, [holdings])

  async function handleSaveHolding(data: Omit<Holding, 'id' | 'created_at' | 'updated_at'>) {
    if (editHolding) {
      await updateHolding(editHolding.id, data)
    } else {
      await createHolding(data)
    }
    setEditHolding(null)
    setShowAddHolding(false)
  }

  async function handleRefreshPrices() {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('refresh-prices')
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setRefreshResult({ updated: data.updated })
      await refetchHoldings()
    } catch (err) {
      setRefreshResult({ updated: -1, message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDeletePortfolio() {
    setDeletingPortfolio(true)
    try {
      await deletePortfolio(id!)
      navigate('/portfolios')
    } finally {
      setDeletingPortfolio(false)
    }
  }

  if (!portfolio && portfolios.length > 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Portfolio not found. <Link to="/portfolios" className="underline">Back to portfolios</Link>
      </div>
    )
  }

  const typeLabel = PORTFOLIO_TYPES.find(t => t.value === portfolio?.portfolio_type)?.label

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Back link */}
      <Link to="/portfolios" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All Portfolios
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{portfolio?.name ?? '…'}</h1>
            {typeLabel && <Badge variant="secondary">{typeLabel}</Badge>}
          </div>
          {portfolio?.description && (
            <p className="mt-1 text-sm text-muted-foreground">{portfolio.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isViewer && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPrices}
              disabled={refreshing || holdings.every(h => !h.symbol)}
              title="Fetch latest prices for all symbol-linked holdings"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh Prices'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportHoldingsCsv(holdings, portfolio?.name ?? 'Portfolio')}
            disabled={holdings.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportHoldingsXlsx(holdings, portfolio?.name ?? 'Portfolio', portfolio?.currency ?? 'USD')}
            disabled={holdings.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export XLSX
          </Button>
          {!isViewer && (
            <>
              <Button variant="outline" size="icon" onClick={() => setShowDeletePortfolio(true)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button onClick={() => setShowAddHolding(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Holding
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Refresh result feedback */}
      {refreshResult && (
        <p className={`-mt-4 mb-2 text-xs ${refreshResult.updated < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
          {refreshResult.updated < 0
            ? `Price refresh failed${refreshResult.message ? `: ${refreshResult.message}` : ''}`
            : `Updated ${refreshResult.updated} holding${refreshResult.updated !== 1 ? 's' : ''} with latest prices`}
        </p>
      )}

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Value" value={formatCurrency(stats.totalValue, portfolio?.currency ?? 'USD')} />
        <StatCard label="Cost Basis" value={formatCurrency(stats.totalCost, portfolio?.currency ?? 'USD')} />
        <StatCard
          label="Gain / Loss"
          value={`${stats.gainLoss >= 0 ? '+' : ''}${formatCurrency(stats.gainLoss, portfolio?.currency ?? 'USD')}`}
          valueClass={stats.gainLoss >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
        <StatCard
          label="Return"
          value={`${stats.gainLossPct >= 0 ? '+' : ''}${stats.gainLossPct.toFixed(1)}%`}
          valueClass={stats.gainLossPct >= 0 ? 'text-emerald-600' : 'text-destructive'}
        />
      </div>

      {/* Holdings */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Holdings ({holdings.length})</h2>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading holdings…</div>
      ) : (
        <HoldingsList
          holdings={holdings}
          currency={portfolio?.currency ?? 'USD'}
          onEdit={h => { setEditHolding(h); setShowAddHolding(true) }}
          onDuplicate={id => duplicateHolding(id)}
          onDelete={deleteHolding}
        />
      )}

      {/* Add / Edit Holding dialog */}
      <HoldingForm
        open={showAddHolding}
        onClose={() => { setShowAddHolding(false); setEditHolding(null) }}
        portfolioId={id ?? ''}
        currency={portfolio?.currency ?? 'USD'}
        holding={editHolding ?? undefined}
        onSave={handleSaveHolding}
      />

      {/* Delete portfolio confirmation */}
      <AlertDialog open={showDeletePortfolio} onOpenChange={o => !o && setShowDeletePortfolio(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{portfolio?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the portfolio and all its holdings. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeletePortfolio}
              disabled={deletingPortfolio}
            >
              {deletingPortfolio ? 'Deleting…' : 'Delete Portfolio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}
