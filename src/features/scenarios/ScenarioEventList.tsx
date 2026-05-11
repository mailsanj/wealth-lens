import { useState } from 'react'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/forms/SelectField'
import { NumericInput } from '@/components/forms/NumericInput'
import HoldingSourcePicker from './HoldingSourcePicker'
import { SCENARIO_EVENT_TYPES } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import type { ScenarioEvent, ScenarioEventType, HoldingSource } from '@/types/scenario'

interface Props {
  events: ScenarioEvent[]
  timeHorizon: number
  holdingAllocation: Map<string, number>
  onAdd: (event: Omit<ScenarioEvent, 'id' | 'scenario_id'>) => Promise<unknown>
  onUpdate: (id: string, event: Omit<ScenarioEvent, 'id' | 'scenario_id'>) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
}

const BLANK = {
  event_year: 1,
  event_type: 'contribution' as ScenarioEventType,
  amount: 0,
  description: '',
  useHolding: false,
}

export default function ScenarioEventList({ events, timeHorizon, holdingAllocation, onAdd, onUpdate, onDelete, readOnly = false }: Props) {
  const [editTarget, setEditTarget] = useState<ScenarioEvent | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [linkedSources, setLinkedSources] = useState<HoldingSource[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditTarget(null)
    setForm(BLANK)
    setLinkedSources([])
    setShowForm(true)
  }

  function openEdit(ev: ScenarioEvent) {
    setEditTarget(ev)
    const hasSources = ev.linked_sources?.length > 0
    setForm({
      event_year: ev.event_year,
      event_type: ev.event_type,
      amount: ev.amount,
      description: ev.description ?? '',
      useHolding: hasSources,
    })
    setLinkedSources(ev.linked_sources ?? [])
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setForm(BLANK)
    setLinkedSources([])
    setError(null)
  }

  function set<K extends keyof typeof BLANK>(key: K, value: typeof BLANK[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function buildPayload(): Omit<ScenarioEvent, 'id' | 'scenario_id'> {
    const year = Math.min(timeHorizon, Math.max(1, Math.round(form.event_year)))
    const sources = form.useHolding && form.event_type === 'contribution' ? linkedSources : []
    const computedAmount = sources.length > 0
      ? sources.reduce((s, src) => s + src.snapshot * (src.pct / 100), 0)
      : form.amount

    return {
      event_year: year,
      event_type: form.event_type,
      amount: computedAmount,
      description: form.description || null,
      linked_sources: sources,
    }
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const payload = buildPayload()
      if (editTarget) await onUpdate(editTarget.id, payload)
      else await onAdd(payload)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const canLinkHolding = form.event_type === 'contribution'
  const sourcesTotal = linkedSources.reduce((s, src) => s + src.snapshot * (src.pct / 100), 0)

  return (
    <div className="space-y-3">
      {events.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No one-off events. Add market shocks, windfalls, or large withdrawals.</p>
      )}

      {events.map(ev => {
        const hasSources = ev.linked_sources?.length > 0
        return (
          <div key={ev.id} className="group flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">Year {ev.event_year}</span>
              <EventTypePill type={ev.event_type} />
              {/* flex row so the description truncates correctly as a flex child */}
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 font-medium">
                  {hasSources
                    ? `${ev.linked_sources.map(s => `${s.pct}% of ${s.holdingName}`).join(' + ')} (${formatCurrency(ev.amount)})`
                    : ev.event_type === 'shock' ? `${ev.amount}% loss` : `$${ev.amount.toLocaleString()}`
                  }
                </span>
                {ev.description && (
                  <span
                    className="truncate text-muted-foreground"
                    title={ev.description}
                  >
                    — {ev.description}
                  </span>
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => openEdit(ev)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDelete(ev.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {!readOnly && showForm && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">{editTarget ? 'Edit Event' : 'New Event'}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Year (1–{timeHorizon})</Label>
              <NumericInput
                value={form.event_year}
                onChange={v => set('event_year', Math.min(timeHorizon, Math.max(1, Math.round(v))) as typeof BLANK['event_year'])}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <SelectField
                value={form.event_type}
                onChange={v => {
                  set('event_type', v as ScenarioEventType)
                  if (v !== 'contribution') set('useHolding', false)
                }}
                options={[...SCENARIO_EVENT_TYPES]}
              />
            </div>
          </div>

          {form.event_type !== 'rebalance' && (
            <>
              {canLinkHolding && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.useHolding}
                    onChange={e => { set('useHolding', e.target.checked); if (!e.target.checked) setLinkedSources([]) }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Source amount from holdings</span>
                </label>
              )}

              {form.useHolding && canLinkHolding ? (
                <div className="rounded-lg border p-3 space-y-3">
                  <HoldingSourcePicker
                    sources={linkedSources}
                    onChange={setLinkedSources}
                    usedElsewhere={holdingAllocation}
                  />
                  {sourcesTotal > 0 && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      Total contribution: <span className="font-semibold text-foreground">{formatCurrency(sourcesTotal)}</span>
                      <span className="ml-1">(based on current holding values — actual future amount will differ)</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {form.event_type === 'shock' ? 'Loss (%)' : 'Amount ($)'}
                  </Label>
                  <NumericInput
                    value={form.amount}
                    onChange={v => set('amount', v as typeof BLANK['amount'])}
                    currency={form.event_type !== 'shock'}
                    placeholder="0"
                  />
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note (optional)</Label>
            <Input
              placeholder="e.g. Sell rental property"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Event'}
            </Button>
            <Button size="sm" variant="outline" onClick={closeForm}>Cancel</Button>
          </div>
        </div>
      )}

      {!readOnly && !showForm && (
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Event
        </Button>
      )}
    </div>
  )
}

function EventTypePill({ type }: { type: ScenarioEventType }) {
  const STYLES: Record<ScenarioEventType, string> = {
    contribution: 'bg-emerald-100 text-emerald-700',
    withdrawal:   'bg-amber-100 text-amber-700',
    shock:        'bg-red-100 text-red-700',
    rebalance:    'bg-slate-100 text-slate-600',
  }
  const label = SCENARIO_EVENT_TYPES.find(t => t.value === type)?.label ?? type
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STYLES[type]}`}>{label}</span>
}
