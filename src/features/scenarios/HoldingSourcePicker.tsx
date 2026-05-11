import { useEffect, useState } from 'react'
import { RefreshCw, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/forms/SelectField'
import { NumericInput } from '@/components/forms/NumericInput'
import { usePortfolios } from '@/hooks/usePortfolios'
import { useHoldings } from '@/hooks/useHoldings'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { HoldingSource } from '@/types/scenario'

// ── Per-row entry editor ──────────────────────────────────────────────────────

interface RowProps {
  entry: HoldingSource & { _key: string }
  expanded: boolean
  onToggle: () => void
  onUpdate: (updated: HoldingSource) => void
  onRemove: () => void
  usedElsewhere: number
}

function HoldingRow({ entry, expanded, onToggle, onUpdate, onRemove, usedElsewhere }: RowProps) {
  const { portfolios } = usePortfolios()
  const { holdings } = useHoldings(entry.portfolioId)

  const portfolioOptions = portfolios.map(p => ({ value: p.id, label: p.name }))
  const holdingOptions = holdings.map(h => ({
    value: h.id,
    label: `${h.name}${h.symbol ? ` (${h.symbol})` : ''} — ${formatCurrency(h.current_value)}`,
  }))

  const selectedHolding = holdings.find(h => h.id === entry.holdingId)
  const computedAmount = entry.snapshot * (entry.pct / 100)
  const totalPct = entry.pct + usedElsewhere
  const allocationColor = totalPct > 100 ? 'text-destructive' : totalPct === 100 ? 'text-amber-600' : 'text-emerald-600'

  function selectPortfolio(id: string) {
    const p = portfolios.find(p => p.id === id)
    onUpdate({ ...entry, portfolioId: id, portfolioName: p?.name ?? '', holdingId: '', holdingName: '', snapshot: 0, snapshotDate: '' })
  }

  function selectHolding(id: string) {
    const h = holdings.find(h => h.id === id)
    if (!h) return
    onUpdate({ ...entry, holdingId: id, holdingName: h.name, snapshot: h.current_value, snapshotDate: new Date().toISOString() })
  }

  function refresh() {
    if (!selectedHolding) return
    onUpdate({ ...entry, snapshot: selectedHolding.current_value, snapshotDate: new Date().toISOString() })
  }

  // Collapsed summary
  const summary = entry.holdingName
    ? `${entry.holdingName} — ${entry.pct}% → ${formatCurrency(computedAmount)}`
    : entry.portfolioName
    ? `${entry.portfolioName} — select a holding`
    : 'Select a portfolio and holding'

  return (
    <div className="rounded-lg border">
      {/* Row header — always visible */}
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left text-sm">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className={entry.holdingName ? 'font-medium' : 'text-muted-foreground'}>{summary}</span>
        </button>
        <button onClick={onRemove} className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Portfolio</Label>
            <SelectField value={entry.portfolioId} onChange={selectPortfolio} options={portfolioOptions} placeholder="Select portfolio…" />
          </div>

          {entry.portfolioId && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Holding</Label>
              <SelectField
                value={entry.holdingId}
                onChange={selectHolding}
                options={holdingOptions}
                placeholder={holdings.length === 0 ? 'No holdings in this portfolio' : 'Select holding…'}
              />
            </div>
          )}

          {entry.holdingId && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Percentage (%)</Label>
                <NumericInput value={entry.pct} onChange={v => onUpdate({ ...entry, pct: v })} placeholder="100" />
              </div>

              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Snapshot: <span className="font-medium text-foreground">{formatCurrency(entry.snapshot)}</span>
                    {entry.snapshotDate && <span className="ml-1 text-muted-foreground/70">({formatDate(entry.snapshotDate.slice(0, 10))})</span>}
                  </span>
                  <button onClick={refresh} className="flex items-center gap-1 text-primary hover:underline">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount used:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(computedAmount)}</span>
                </div>
              </div>

              {usedElsewhere > 0 && (
                <p className={`text-xs ${allocationColor}`}>
                  {totalPct > 100
                    ? `⚠ Total allocation ${totalPct}% exceeds 100%`
                    : `Total allocated: ${totalPct}% (${entry.pct}% here + ${usedElsewhere}% elsewhere)`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Multi-holding picker (public API) ─────────────────────────────────────────

interface Props {
  sources: HoldingSource[]
  onChange: (sources: HoldingSource[]) => void
  /** Map of holdingId → total % already allocated elsewhere (for tracker) */
  usedElsewhere?: Map<string, number>
}

let _keyCounter = 0
function newKey() { return `hs-${++_keyCounter}` }

type EntryWithKey = HoldingSource & { _key: string }

function toKeyed(sources: HoldingSource[]): EntryWithKey[] {
  return sources.map(s => ({ ...s, _key: newKey() }))
}

export default function HoldingSourcePicker({ sources, onChange, usedElsewhere = new Map() }: Props) {
  const [entries, setEntries] = useState<EntryWithKey[]>(() => toKeyed(sources))
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  // Sync if parent resets sources (e.g. on form open)
  useEffect(() => {
    const keyed = toKeyed(sources)
    setEntries(keyed)
    // Auto-expand single new entries
    if (keyed.length === 1 && !keyed[0].holdingId) {
      setExpandedKeys(new Set([keyed[0]._key]))
    }
  }, [sources.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function emit(updated: EntryWithKey[]) {
    setEntries(updated)
    onChange(updated.map(({ _key: _, ...rest }) => rest))
  }

  function addEntry() {
    const key = newKey()
    const newEntry: EntryWithKey = {
      _key: key, portfolioId: '', portfolioName: '', holdingId: '',
      holdingName: '', pct: 100, snapshot: 0, snapshotDate: '',
    }
    const updated = [...entries, newEntry]
    setEntries(updated)
    setExpandedKeys(prev => new Set([...prev, key]))
    onChange(updated.map(({ _key: _, ...rest }) => rest))
  }

  function updateEntry(key: string, val: HoldingSource) {
    emit(entries.map(e => e._key === key ? { ...val, _key: key } : e))
  }

  function removeEntry(key: string) {
    emit(entries.filter(e => e._key !== key))
    setExpandedKeys(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  function toggleExpanded(key: string) {
    setExpandedKeys(prev => {
      const s = new Set(prev)
      s.has(key) ? s.delete(key) : s.add(key)
      return s
    })
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.snapshot * (e.pct / 100), 0)

  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <HoldingRow
          key={entry._key}
          entry={entry}
          expanded={expandedKeys.has(entry._key)}
          onToggle={() => toggleExpanded(entry._key)}
          onUpdate={val => updateEntry(entry._key, val)}
          onRemove={() => removeEntry(entry._key)}
          usedElsewhere={usedElsewhere.get(entry.holdingId) ?? 0}
        />
      ))}

      <Button type="button" size="sm" variant="outline" onClick={addEntry} className="w-full">
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Holding
      </Button>

      {entries.length > 0 && totalAmount > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Total: <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
        </p>
      )}
    </div>
  )
}
