import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Scenario } from '@/types/scenario'

interface Props {
  open: boolean
  onClose: () => void
  scenario?: Scenario
  onCreate?: (data: Pick<Scenario, 'name' | 'description'>) => Promise<unknown>
  onUpdate?: (id: string, data: Pick<Scenario, 'name' | 'description'>) => Promise<unknown>
}

export default function ScenarioForm({ open, onClose, scenario, onCreate, onUpdate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(scenario?.name ?? '')
      setDescription(scenario?.description ?? '')
      setError(null)
    }
  }, [open, scenario])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (scenario && onUpdate) {
        await onUpdate(scenario.id, { name, description: description || null })
      } else if (onCreate) {
        await onCreate({ name, description: description || null })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{scenario ? 'Edit Scenario' : 'New Scenario'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="sc-name">Name</Label>
            <Input
              id="sc-name"
              required
              placeholder="e.g. Conservative Retirement"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="sc-desc"
              rows={2}
              placeholder="What assumptions does this scenario model?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : scenario ? 'Save Changes' : 'Create Scenario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
