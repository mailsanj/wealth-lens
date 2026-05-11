import { useState } from 'react'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/forms/NumericInput'
import type { YearRateOverride } from '@/types/scenario'

interface Props {
  overrides: YearRateOverride[]
  timeHorizon: number
  onAdd: (input: Omit<YearRateOverride, 'id' | 'scenario_id' | 'created_at'>) => Promise<unknown>
  onUpdate: (id: string, input: Omit<YearRateOverride, 'id' | 'scenario_id' | 'created_at'>) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
}

const BLANK = { from_year: 1, to_year: '', annual_return_pct: '', inflation_pct: '', note: '' }

export default function YearRateOverrideList({ overrides, timeHorizon, onAdd, onUpdate, onDelete, readOnly = false }: Props) {
  const [editTarget, setEditTarget] = useState<YearRateOverride | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() { setEditTarget(null); setForm(BLANK); setShowForm(true) }

  function openEdit(o: YearRateOverride) {
    setEditTarget(o)
    setForm({
      from_year: o.from_year,
      to_year: o.to_year !== null ? String(o.to_year) : '',
      annual_return_pct: o.annual_return_pct !== null ? String(o.annual_return_pct) : '',
      inflation_pct: o.inflation_pct !== null ? String(o.inflation_pct) : '',
      note: o.note ?? '',
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditTarget(null); setForm(BLANK); setError(null) }

  function set<K extends keyof typeof BLANK>(key: K, value: typeof BLANK[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function buildPayload(): Omit<YearRateOverride, 'id' | 'scenario_id' | 'created_at'> | null {
    const fromYear = Math.max(1, Math.min(timeHorizon, Math.round(Number(form.from_year))))
    const toYearRaw = form.to_year.trim()
    const toYear = toYearRaw === '' ? null : Math.max(fromYear, Math.min(timeHorizon, Math.round(Number(toYearRaw))))
    const returnPct = form.annual_return_pct.trim() === '' ? null : Number(form.annual_return_pct)
    const inflPct = form.inflation_pct.trim() === '' ? null : Number(form.inflation_pct)

    if (returnPct === null && inflPct === null) return null

    return { from_year: fromYear, to_year: toYear, annual_return_pct: returnPct, inflation_pct: inflPct, note: form.note.trim() || null }
  }

  async function handleSave() {
    const payload = buildPayload()
    if (!payload) { setError('Enter at least one rate to override (Growth % or Inflation %).'); return }
    setError(null); setSaving(true)
    try {
      if (editTarget) await onUpdate(editTarget.id, payload)
      else await onAdd(payload)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {overrides.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          No overrides — all years use the flat rates from Parameters.
        </p>
      )}

      {overrides.map(o => {
        const yearRange = o.to_year !== null && o.to_year !== o.from_year
          ? `Yr ${o.from_year}–${o.to_year}`
          : `Yr ${o.from_year}`
        const rates = [
          o.annual_return_pct !== null ? `Growth ${o.annual_return_pct}%` : null,
          o.inflation_pct !== null ? `Inflation ${o.inflation_pct}%` : null,
        ].filter(Boolean).join(' · ')
        return (
          <div key={o.id} className="group flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{yearRange}</span>
              <span className="font-medium text-primary">{rates}</span>
              {o.note && <span className="truncate text-muted-foreground" title={o.note}>— {o.note}</span>}
            </div>
            {!readOnly && (
              <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => openEdit(o)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onDelete(o.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {!readOnly && showForm && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">{editTarget ? 'Edit Override' : 'New Override'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From Year</Label>
              <NumericInput
                value={form.from_year}
                onChange={v => set('from_year', Math.max(1, Math.min(timeHorizon, Math.round(v))) as typeof BLANK['from_year'])}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To Year</Label>
              <Input
                type="number"
                min={form.from_year}
                max={timeHorizon}
                placeholder="blank = single year"
                title="Leave blank for a single-year override"
                value={form.to_year}
                onChange={e => set('to_year', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Growth Rate % <span className="opacity-60">(blank = keep flat)</span></Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 2"
                value={form.annual_return_pct}
                onChange={e => set('annual_return_pct', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Inflation % <span className="opacity-60">(blank = keep flat)</span></Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 5"
                value={form.inflation_pct}
                onChange={e => set('inflation_pct', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note (optional)</Label>
            <Input placeholder="e.g. Recession / high-inflation period" value={form.note} onChange={e => set('note', e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Override'}</Button>
            <Button size="sm" variant="outline" onClick={closeForm}>Cancel</Button>
          </div>
        </div>
      )}

      {!readOnly && !showForm && (
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Year Override
        </Button>
      )}
    </div>
  )
}
