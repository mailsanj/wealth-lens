import { useState } from 'react'
import { Plus, Pencil, Trash2, Copy, Bell, BellOff, Mail, MessageSquare, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SelectField } from '@/components/forms/SelectField'
import { NumericInput } from '@/components/forms/NumericInput'
import { useAlerts, type AlertRule, type AlertRuleInput } from '@/hooks/useAlerts'
import { usePortfolios } from '@/hooks/usePortfolios'
import { useAuth } from '@/features/auth/AuthContext'
import { formatDate } from '@/lib/formatters'

const BLANK: AlertRuleInput = {
  alert_type: 'holding_stock',
  symbol: '',
  portfolio_id: null,
  direction: 'down',
  amount_type: 'percent',
  amount: 5,
  notify_email: true,
  notify_sms: false,
  email: '',
  phone: '',
  cooldown_value: 24,
  cooldown_unit: 'hours',
  is_active: true,
  label: '',
}

export default function Alerts() {
  const { user } = useAuth()
  const { alerts, loading, createAlert, updateAlert, toggleAlert, duplicateAlert, deleteAlert } = useAlerts()
  const { portfolios } = usePortfolios()

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<AlertRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null)
  const [form, setForm] = useState<AlertRuleInput>({ ...BLANK, email: user?.email ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditTarget(null)
    setForm({ ...BLANK, email: user?.email ?? '' })
    setShowForm(true)
  }

  function openEdit(alert: AlertRule) {
    setEditTarget(alert)
    setForm({
      alert_type: alert.alert_type,
      symbol: alert.symbol ?? '',
      portfolio_id: alert.portfolio_id,
      direction: alert.direction,
      amount_type: alert.amount_type,
      amount: alert.amount,
      notify_email: alert.notify_email,
      notify_sms: alert.notify_sms,
      email: alert.email ?? '',
      phone: alert.phone ?? '',
      cooldown_value: alert.cooldown_value,
      cooldown_unit: alert.cooldown_unit,
      is_active: alert.is_active,
      label: alert.label ?? '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
    setError(null)
  }

  function set<K extends keyof AlertRuleInput>(key: K, value: AlertRuleInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (form.alert_type === 'holding_stock' && !form.symbol?.trim()) {
      setError('Symbol is required for stock alerts.')
      return
    }
    if (form.alert_type === 'holding_portfolio' && !form.portfolio_id) {
      setError('Select a portfolio.')
      return
    }
    if (!form.notify_email && !form.notify_sms) {
      setError('Select at least one notification channel.')
      return
    }
    if (form.notify_email && !form.email?.trim()) {
      setError('Email address is required.')
      return
    }
    if (form.notify_sms && !form.phone?.trim()) {
      setError('Phone number is required for SMS.')
      return
    }

    setError(null)
    setSaving(true)
    try {
      const payload: AlertRuleInput = {
        ...form,
        symbol: form.alert_type === 'holding_stock' ? (form.symbol ?? '').trim().toUpperCase() : null,
        portfolio_id: form.alert_type === 'holding_portfolio' ? form.portfolio_id : null,
        email: form.notify_email ? (form.email ?? '').trim() : null,
        phone: form.notify_sms ? (form.phone ?? '').trim() : null,
        label: form.label?.trim() || null,
      }
      if (editTarget) await updateAlert(editTarget.id, payload)
      else await createAlert(payload)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const portfolioOptions = portfolios.map(p => ({ value: p.id, label: p.name }))

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Get notified when your holdings or portfolios hit a threshold.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> New Alert
        </Button>
      </div>

      {/* Alert form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">{editTarget ? 'Edit Alert' : 'New Alert'}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Label */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label <span className="opacity-60">(optional)</span></Label>
              <Input placeholder="e.g. AAPL crash guard" value={form.label ?? ''} onChange={e => set('label', e.target.value)} />
            </div>

            {/* Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alert Type</Label>
                <SelectField
                  value={form.alert_type}
                  onChange={v => set('alert_type', v as AlertRuleInput['alert_type'])}
                  options={[
                    { value: 'holding_stock', label: 'Individual Stock' },
                    { value: 'holding_portfolio', label: 'Portfolio' },
                  ]}
                />
              </div>
              {form.alert_type === 'holding_stock' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Symbol</Label>
                  <Input
                    placeholder="e.g. AAPL"
                    value={form.symbol ?? ''}
                    onChange={e => set('symbol', e.target.value.toUpperCase())}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Portfolio</Label>
                  <SelectField
                    value={form.portfolio_id ?? ''}
                    onChange={v => set('portfolio_id', v || null)}
                    options={[{ value: '', label: 'Select portfolio…' }, ...portfolioOptions]}
                  />
                </div>
              )}
            </div>

            {/* Condition */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Direction</Label>
                <SelectField
                  value={form.direction}
                  onChange={v => set('direction', v as AlertRuleInput['direction'])}
                  options={[
                    { value: 'down', label: 'Goes Down' },
                    { value: 'up',   label: 'Goes Up' },
                    { value: 'either', label: 'Either Direction' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">By</Label>
                <SelectField
                  value={form.amount_type}
                  onChange={v => set('amount_type', v as AlertRuleInput['amount_type'])}
                  options={[
                    { value: 'percent', label: '% Percent' },
                    { value: 'dollars', label: '$ Dollars' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Threshold {form.amount_type === 'percent' ? '(%)' : '($)'}
                </Label>
                <NumericInput
                  value={form.amount}
                  onChange={v => set('amount', v)}
                  placeholder={form.amount_type === 'percent' ? 'e.g. 5' : 'e.g. 1000'}
                />
              </div>
            </div>

            {/* Notification channels */}
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Notification Channels</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded" checked={form.notify_email} onChange={e => set('notify_email', e.target.checked)} />
                    <Mail className="h-3.5 w-3.5" /> Email
                  </label>
                  {form.notify_email && (
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={form.email ?? ''}
                      onChange={e => set('email', e.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded" checked={form.notify_sms} onChange={e => set('notify_sms', e.target.checked)} />
                    <MessageSquare className="h-3.5 w-3.5" /> SMS
                  </label>
                  {form.notify_sms && (
                    <Input
                      type="tel"
                      placeholder="+14155552671"
                      value={form.phone ?? ''}
                      onChange={e => set('phone', e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Cooldown */}
            <div className="flex items-center gap-3">
              <Label className="shrink-0 text-sm text-muted-foreground">Re-alert after</Label>
              <div className="w-24">
                <NumericInput value={form.cooldown_value} onChange={v => set('cooldown_value', Math.max(1, Math.round(v)))} placeholder="24" />
              </div>
              <div className="w-32">
                <SelectField
                  value={form.cooldown_unit}
                  onChange={v => set('cooldown_unit', v as AlertRuleInput['cooldown_unit'])}
                  options={[
                    { value: 'minutes', label: 'Minutes' },
                    { value: 'hours',   label: 'Hours' },
                    { value: 'days',    label: 'Days' },
                  ]}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Alert'}
              </Button>
              <Button size="sm" variant="outline" onClick={closeForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : alerts.length === 0 && !showForm ? (
        <div className="rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-muted-foreground">No alerts configured.</p>
          <Button className="mt-4" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Create your first alert
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const portfolioName = portfolios.find(p => p.id === alert.portfolio_id)?.name
            const target = alert.alert_type === 'holding_stock' ? alert.symbol : portfolioName
            const dirIcon = alert.direction === 'up'
              ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              : alert.direction === 'down'
              ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            const thresholdStr = alert.amount_type === 'percent'
              ? `${alert.amount}%`
              : `$${alert.amount.toLocaleString()}`

            return (
              <div key={alert.id} className={`group rounded-lg border px-4 py-3 transition-colors ${alert.is_active ? '' : 'opacity-50'}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {alert.label && <span className="font-medium">{alert.label}</span>}
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        {dirIcon}
                        <span className="font-medium text-foreground">{target}</span>
                        moves {alert.direction === 'either' ? '' : alert.direction + ' '}
                        by {thresholdStr}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {alert.notify_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{alert.email}</span>}
                      {alert.notify_sms && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{alert.phone}</span>}
                      <span>· cooldown {alert.cooldown_value} {alert.cooldown_unit}</span>
                      {alert.last_triggered_at && (
                        <span>· last fired {formatDate(alert.last_triggered_at)}</span>
                      )}
                    </div>
                  </div>

                  <div className="ml-3 flex shrink-0 items-center gap-1">
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleAlert(alert.id, !alert.is_active)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      title={alert.is_active ? 'Pause alert' : 'Enable alert'}
                    >
                      {alert.is_active
                        ? <Bell className="h-3.5 w-3.5 text-primary" />
                        : <BellOff className="h-3.5 w-3.5" />
                      }
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => openEdit(alert)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => duplicateAlert(alert.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(alert)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alert{deleteTarget?.label ? ` "${deleteTarget.label}"` : ''}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the alert rule. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { await deleteAlert(deleteTarget!.id); setDeleteTarget(null) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
