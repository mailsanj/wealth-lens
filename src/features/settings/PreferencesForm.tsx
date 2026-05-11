import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/forms/SelectField'
import { useProfile } from '@/hooks/useProfile'
import { CURRENCIES } from '@/lib/constants'

const CURRENCY_OPTIONS = CURRENCIES.map(c => ({ value: c.value, label: c.label }))

const DATE_FORMAT_OPTIONS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY  (US)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY  (EU)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD  (ISO)' },
]

export default function PreferencesForm() {
  const { profile, loading, updateProfile } = useProfile()
  const [currency, setCurrency] = useState('USD')
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setCurrency(profile.currency)
      setDateFormat(profile.date_format)
    }
  }, [profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await updateProfile({ currency, date_format: dateFormat })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Default Currency</Label>
            <SelectField value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
            <p className="text-xs text-muted-foreground">Used as the display currency across the dashboard.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <SelectField value={dateFormat} onChange={setDateFormat} options={DATE_FORMAT_OPTIONS} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Preferences'}
            </Button>
            {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
