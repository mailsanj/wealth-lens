import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/forms/NumericInput'
import { SelectField } from '@/components/forms/SelectField'
import type { Goal, GoalInput } from '@/hooks/useGoals'
import type { Scenario } from '@/types/scenario'

interface Portfolio { id: string; name: string }

interface Props {
  open: boolean
  onClose: () => void
  goal?: Goal
  scenarios: Scenario[]
  portfolios: Portfolio[]
  onCreate?: (data: GoalInput) => Promise<unknown>
  onUpdate?: (id: string, data: GoalInput) => Promise<unknown>
}

const BLANK: GoalInput = { name: '', target_value: 0, target_date: '', linked_scenario_id: null, linked_portfolio_ids: [] }

export default function GoalForm({ open, onClose, goal, scenarios, portfolios, onCreate, onUpdate }: Props) {
  const [form, setForm] = useState<GoalInput>(BLANK)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(goal
        ? { name: goal.name, target_value: goal.target_value, target_date: goal.target_date, linked_scenario_id: goal.linked_scenario_id, linked_portfolio_ids: goal.linked_portfolio_ids ?? [] }
        : BLANK
      )
      setError(null)
    }
  }, [open, goal])

  function set<K extends keyof GoalInput>(key: K, value: GoalInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function togglePortfolio(id: string) {
    setForm(prev => ({
      ...prev,
      linked_portfolio_ids: prev.linked_portfolio_ids.includes(id)
        ? prev.linked_portfolio_ids.filter(pid => pid !== id)
        : [...prev.linked_portfolio_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.target_date) { setError('Please set a target date.'); return }
    setError(null)
    setLoading(true)
    try {
      if (goal && onUpdate) await onUpdate(goal.id, form)
      else if (onCreate) await onCreate(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const scenarioOptions = [
    { value: '', label: 'None' },
    ...scenarios.map(s => ({ value: s.id, label: s.name })),
  ]

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'New Goal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Goal Name</Label>
            <Input
              id="g-name"
              required
              placeholder="e.g. Retire with $2M"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="g-value">Target Value ($)</Label>
              <NumericInput id="g-value" value={form.target_value} onChange={v => set('target_value', v)} currency />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-date">Target Date</Label>
              <Input id="g-date" type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
            </div>
          </div>

          {/* Linked portfolios — used as "current value" baseline */}
          {portfolios.length > 0 && (
            <div className="space-y-2">
              <Label>Track Value From <span className="text-muted-foreground">(optional)</span></Label>
              <p className="text-xs text-muted-foreground">Select specific portfolios to use as the current value for this goal. Defaults to total net worth if none selected.</p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border p-2">
                {portfolios.map(p => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={form.linked_portfolio_ids.includes(p.id)}
                      onChange={() => togglePortfolio(p.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Linked Scenario <span className="text-muted-foreground">(optional)</span></Label>
            <SelectField
              value={form.linked_scenario_id ?? ''}
              onChange={v => set('linked_scenario_id', v || null)}
              options={scenarioOptions}
            />
            <p className="text-xs text-muted-foreground">Link a scenario to see if your projection reaches this goal.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : goal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
