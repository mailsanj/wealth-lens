import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/forms/SelectField'
import { PORTFOLIO_TYPES, CURRENCIES } from '@/lib/constants'
import type { Portfolio } from '@/types/portfolio'

type FormData = Pick<Portfolio, 'name' | 'description' | 'portfolio_type' | 'currency'>

interface Props {
  open: boolean
  onClose: () => void
  portfolio?: Portfolio
  onCreate?: (data: FormData) => Promise<unknown>
  onUpdate?: (id: string, data: FormData) => Promise<unknown>
}

const DEFAULTS: FormData = { name: '', description: '', portfolio_type: 'investment', currency: 'USD' }

const CURRENCY_OPTIONS = CURRENCIES.map(c => ({ value: c.value, label: c.value }))

export default function PortfolioForm({ open, onClose, portfolio, onCreate, onUpdate }: Props) {
  const [form, setForm] = useState<FormData>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(portfolio
        ? { name: portfolio.name, description: portfolio.description ?? '', portfolio_type: portfolio.portfolio_type, currency: portfolio.currency }
        : DEFAULTS
      )
      setError(null)
    }
  }, [open, portfolio])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (portfolio && onUpdate) {
        await onUpdate(portfolio.id, form)
      } else if (onCreate) {
        await onCreate(form)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const isEdit = !!portfolio

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Portfolio' : 'New Portfolio'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Name</Label>
            <Input
              id="pf-name"
              required
              placeholder="e.g. Brokerage Account"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="pf-desc"
              placeholder="Brief description"
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <SelectField
                value={form.portfolio_type}
                onChange={v => set('portfolio_type', v as FormData['portfolio_type'])}
                options={[...PORTFOLIO_TYPES]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <SelectField
                value={form.currency}
                onChange={v => set('currency', v)}
                options={CURRENCY_OPTIONS}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Portfolio'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
