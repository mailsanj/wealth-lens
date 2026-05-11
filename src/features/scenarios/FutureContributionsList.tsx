import { useState } from 'react'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/forms/NumericInput'
import { formatCurrency } from '@/lib/formatters'
import type { FutureContribution } from '@/types/scenario'

interface Props {
  contributions: FutureContribution[]
  timeHorizon: number
  onAdd: (fc: Omit<FutureContribution, 'id' | 'scenario_id' | 'created_at'>) => Promise<unknown>
  onUpdate: (id: string, fc: Omit<FutureContribution, 'id' | 'scenario_id' | 'created_at'>) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
  readOnly?: boolean
}

const BLANK = { name: '', annual_amount: 0, start_year: 1, end_year: '' }

export default function FutureContributionsList({ contributions, timeHorizon, onAdd, onUpdate, onDelete, readOnly = false }: Props) {
  const [editTarget, setEditTarget] = useState<FutureContribution | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditTarget(null)
    setForm(BLANK)
    setShowForm(true)
  }

  function openEdit(fc: FutureContribution) {
    setEditTarget(fc)
    setForm({ name: fc.name, annual_amount: fc.annual_amount, start_year: fc.start_year, end_year: fc.end_year !== null ? String(fc.end_year) : '' })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setForm(BLANK)
    setError(null)
  }

  function set<K extends keyof typeof BLANK>(key: K, value: typeof BLANK[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setError(null)
    setSaving(true)
    const endYearNum = form.end_year !== '' ? Math.round(Number(form.end_year)) : null
    const payload = {
      name: form.name.trim(),
      annual_amount: form.annual_amount,
      start_year: Math.max(1, Math.min(timeHorizon, Math.round(form.start_year))),
      end_year: endYearNum,
    }
    try {
      if (editTarget) {
        await onUpdate(editTarget.id, payload)
      } else {
        await onAdd(payload)
      }
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {contributions.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          No future contributions yet. Add recurring income like Social Security, pension, or annuity payments.
        </p>
      )}

      {contributions.map(fc => (
        <div key={fc.id} className="group flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{fc.name}</span>
              <span className="text-xs text-emerald-600 font-medium">{formatCurrency(fc.annual_amount)}/yr</span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Year {fc.start_year}
              {fc.end_year !== null ? ` – ${fc.end_year}` : ' onwards'}
            </div>
          </div>
          {!readOnly && (
            <div className="ml-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => openEdit(fc)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(fc.id)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}

      {!readOnly && showForm && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {editTarget ? 'Edit Contribution' : 'New Future Contribution'}
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              placeholder="e.g. Social Security"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Annual Amount ($)</Label>
            <NumericInput
              value={form.annual_amount}
              onChange={v => set('annual_amount', v)}
              currency
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start Year</Label>
              <NumericInput
                value={form.start_year}
                onChange={v => set('start_year', Math.max(1, Math.round(v)) as typeof BLANK['start_year'])}
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">End Year (blank = indefinite)</Label>
              <Input
                type="number"
                min={1}
                max={timeHorizon}
                placeholder="—"
                value={form.end_year}
                onChange={e => set('end_year', e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Contribution'}
            </Button>
            <Button size="sm" variant="outline" onClick={closeForm}>Cancel</Button>
          </div>
        </div>
      )}

      {!readOnly && !showForm && (
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Contribution
        </Button>
      )}
    </div>
  )
}
