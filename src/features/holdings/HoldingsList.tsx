import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, Copy, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import AssetTypeBadge from './AssetTypeBadge'
import { formatCurrency } from '@/lib/formatters'
import { computeEffectiveValue } from '@/lib/holdings'
import { useGrant } from '@/features/auth/GrantContext'
import type { Holding } from '@/types/holding'
import type { AssetTypeValue } from '@/lib/constants'

// Asset types where quantity is not meaningful
const HIDE_QUANTITY: AssetTypeValue[] = ['cash', 'real_estate', 'retirement_account', 'education_plan']

type SortKey = 'name' | 'type' | 'qty' | 'cost' | 'value' | 'gainLoss'
type SortDir = 'asc' | 'desc'

interface Props {
  holdings: Holding[]
  currency: string
  onEdit: (holding: Holding) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => Promise<void>
}

export default function HoldingsList({ holdings, currency, onEdit, onDuplicate, onDelete }: Props) {
  const { isViewer } = useGrant()
  const [deleteTarget, setDeleteTarget] = useState<Holding | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await onDelete(deleteTarget.id) } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const sorted = [...holdings].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'name':    return dir * a.name.localeCompare(b.name)
      case 'type':    return dir * a.asset_type.localeCompare(b.asset_type)
      case 'qty':     return dir * (a.quantity - b.quantity)
      case 'cost':    return dir * (a.cost_basis - b.cost_basis)
      case 'value':   return dir * (a.current_value - b.current_value)
      case 'gainLoss': return dir * ((a.current_value - a.cost_basis) - (b.current_value - b.cost_basis))
      default:        return 0
    }
  })

  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed py-12 text-center text-sm text-muted-foreground">
        No holdings yet. Click "Add Holding" to get started.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <SortTh label="Name"          col="name"     active={sortKey} dir={sortDir} onClick={handleSort} align="left" />
              <SortTh label="Type"          col="type"     active={sortKey} dir={sortDir} onClick={handleSort} align="left" />
              <SortTh label="Qty"           col="qty"      active={sortKey} dir={sortDir} onClick={handleSort} align="right" />
              <SortTh label="Cost Basis"    col="cost"     active={sortKey} dir={sortDir} onClick={handleSort} align="right" />
              <SortTh label="Current Value" col="value"    active={sortKey} dir={sortDir} onClick={handleSort} align="right" />
              <SortTh label="Gain / Loss"   col="gainLoss" active={sortKey} dir={sortDir} onClick={handleSort} align="right" />
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map(h => {
              const gainLoss = h.current_value - h.cost_basis
              const gainLossPct = h.cost_basis > 0 ? (gainLoss / h.cost_basis) * 100 : 0
              const showQty = !HIDE_QUANTITY.includes(h.asset_type as AssetTypeValue)
              return (
                <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{h.name}</div>
                    {h.symbol && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{h.symbol}</span>
                        {h.last_price_updated_at
                          ? <span className="rounded bg-emerald-50 px-1 text-emerald-600 dark:bg-emerald-950/40">auto · {relativeTime(h.last_price_updated_at)}</span>
                          : <span className="rounded bg-muted px-1">manual</span>
                        }
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AssetTypeBadge type={h.asset_type as AssetTypeValue} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {showQty ? formatQty(h.quantity, h.asset_type) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(h.cost_basis, currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatCurrency(h.current_value, currency)}
                    {h.asset_type === 'real_estate' && (() => {
                      const equity = computeEffectiveValue({ asset_type: h.asset_type, current_value: h.current_value, metadata: h.metadata as Record<string, unknown> })
                      if (equity === h.current_value) return null
                      return (
                        <div className={`text-xs ${equity < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          Equity: {formatCurrency(equity, currency)}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className={gainLoss >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                      {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, currency)}
                    </div>
                    <div className={`text-xs ${gainLoss >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {gainLoss >= 0 ? '+' : ''}{gainLossPct.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!isViewer && <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(h)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(h.id)}>
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(h)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this holding. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Sortable header cell ──────────────────────────────────────────────────────

function SortTh({ label, col, active, dir, onClick, align }: {
  label: string
  col: SortKey
  active: SortKey
  dir: SortDir
  onClick: (col: SortKey) => void
  align: 'left' | 'right'
}) {
  const isActive = active === col
  return (
    <th
      className={`px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onClick(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {isActive
          ? dir === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
            : <ChevronDown className="h-3.5 w-3.5 text-primary" />
          : <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
        }
      </span>
    </th>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatQty(qty: number, assetType: string): string {
  // Crypto can have many decimal places; other types typically integer or 2–4dp
  const decimals = assetType === 'crypto' ? 8 : 4
  const formatted = qty.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
  return formatted
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
