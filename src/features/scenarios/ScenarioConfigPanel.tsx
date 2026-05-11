import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/forms/NumericInput'
import { cn } from '@/lib/utils'
import HoldingSourcePicker from './HoldingSourcePicker'
import { formatCurrency } from '@/lib/formatters'
import type { ScenarioConfig, HoldingSource } from '@/types/scenario'

type ConfigDraft = Omit<ScenarioConfig, 'id' | 'scenario_id'>

interface Props {
  config: ScenarioConfig
  onSave: (updates: ConfigDraft) => Promise<void>
  holdingAllocation: Map<string, number>
  readOnly?: boolean
}

export default function ScenarioConfigPanel({ config, onSave, holdingAllocation, readOnly = false }: Props) {
  const [draft, setDraft] = useState<ConfigDraft>(toDraft(config))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDraft(toDraft(config)) }, [config])

  function set<K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function handleSourcesChange(sources: HoldingSource[]) {
    const totalAmount = sources.reduce((s, src) => s + src.snapshot * (src.pct / 100), 0)
    setDraft(prev => ({
      ...prev,
      starting_value_sources: sources,
      // Auto-populate initial_value from sources when sources exist
      initial_value: sources.length > 0 ? totalAmount : prev.initial_value,
    }))
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await onSave(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const sourcesTotal = draft.starting_value_sources.reduce(
    (s, src) => s + src.snapshot * (src.pct / 100), 0
  )

  return (
    <div className={`space-y-4${readOnly ? ' pointer-events-none select-none opacity-60' : ''}`}>
      {/* Start year — plain number input, no comma formatting */}
      <Row label="Start Year">
        <Input
          type="number"
          min={1900}
          max={2200}
          value={draft.start_year}
          onChange={e => set('start_year', parseInt(e.target.value) || new Date().getFullYear())}
          className="w-40 tabular-nums"
        />
      </Row>

      {/* Starting value with source toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="shrink-0 text-sm text-muted-foreground">Starting Value</Label>
          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs">
            <button
              onClick={() => setDraft(prev => ({ ...prev, starting_value_sources: [] }))}
              className={cn('rounded px-2 py-1 transition-colors', draft.starting_value_sources.length === 0 ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              Manual
            </button>
            <button
              onClick={() => {
                if (draft.starting_value_sources.length === 0) {
                  setDraft(prev => ({
                    ...prev,
                    starting_value_sources: [{
                      portfolioId: '', portfolioName: '', holdingId: '',
                      holdingName: '', pct: 100, snapshot: 0, snapshotDate: '',
                    }],
                  }))
                }
              }}
              className={cn('rounded px-2 py-1 transition-colors', draft.starting_value_sources.length > 0 ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              From Holdings
            </button>
          </div>
        </div>

        {draft.starting_value_sources.length === 0 ? (
          <div className="flex justify-end">
            <div className="w-40">
              <NumericInput value={draft.initial_value} onChange={v => set('initial_value', v)} currency />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-3 space-y-3">
            <HoldingSourcePicker
              sources={draft.starting_value_sources}
              onChange={handleSourcesChange}
              usedElsewhere={holdingAllocation}
            />
            {sourcesTotal > 0 && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                Simulation starting value: <span className="font-semibold text-foreground">{formatCurrency(sourcesTotal)}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Growth</p>
        <div className="space-y-3">
          <Row label="Annual Return (%)">
            <NumericInput value={draft.annual_return_pct} onChange={v => set('annual_return_pct', v)} placeholder="e.g. 7" />
          </Row>
          <Row label="Volatility / Std Dev (%)">
            <NumericInput value={draft.volatility_pct} onChange={v => set('volatility_pct', v)} placeholder="e.g. 12" />
          </Row>
          <Row label="Inflation Rate (%)">
            <NumericInput value={draft.inflation_pct} onChange={v => set('inflation_pct', v)} placeholder="e.g. 3" />
          </Row>
          <Row label="Time Horizon (years)">
            <NumericInput value={draft.time_horizon_years} onChange={v => set('time_horizon_years', Math.round(v))} placeholder="e.g. 20" />
          </Row>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contributions</p>
        <div className="space-y-3">
          <Row label="Annual Contribution ($)">
            <NumericInput value={draft.annual_contribution} onChange={v => set('annual_contribution', v)} currency />
          </Row>
          <Row label="Contribution Growth (%)">
            <NumericInput value={draft.contribution_growth_pct} onChange={v => set('contribution_growth_pct', v)} placeholder="e.g. 3" />
          </Row>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Withdrawals</p>
        <div className="space-y-3">
          <Row label="Withdrawal Start (year)">
            <NumericInput
              value={draft.withdrawal_start_year ?? 0}
              onChange={v => set('withdrawal_start_year', v > 0 ? Math.round(v) : null)}
              placeholder="0 = no withdrawals"
            />
          </Row>
          <Row label="Annual Withdrawal ($)">
            <NumericInput value={draft.annual_withdrawal} onChange={v => set('annual_withdrawal', v)} currency />
          </Row>
          <div className="flex items-center justify-between gap-4">
            <Label className="shrink-0 text-sm text-muted-foreground">Inflation-Adjusted</Label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.withdrawal_inflation_adjusted}
                onChange={e => set('withdrawal_inflation_adjusted', e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-xs text-muted-foreground">Grow with inflation</span>
            </label>
          </div>
        </div>
      </div>

      {!readOnly && (
        <>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3 border-t pt-4">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? 'Saving…' : 'Save Parameters'}
            </Button>
            {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="shrink-0 text-sm text-muted-foreground">{label}</Label>
      <div className="w-40">{children}</div>
    </div>
  )
}

function toDraft(config: ScenarioConfig): ConfigDraft {
  return {
    portfolio_id: config.portfolio_id,
    start_year: config.start_year ?? new Date().getFullYear(),
    initial_value: config.initial_value,
    annual_contribution: config.annual_contribution,
    contribution_growth_pct: config.contribution_growth_pct,
    annual_return_pct: config.annual_return_pct,
    volatility_pct: config.volatility_pct,
    inflation_pct: config.inflation_pct,
    time_horizon_years: config.time_horizon_years,
    withdrawal_start_year: config.withdrawal_start_year,
    annual_withdrawal: config.annual_withdrawal,
    withdrawal_inflation_adjusted: config.withdrawal_inflation_adjusted,
    starting_value_sources: config.starting_value_sources ?? [],
  }
}
