import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Download, Eye, EyeOff, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useScenarioDetail, useScenarios } from '@/hooks/useScenarios'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useProfile } from '@/hooks/useProfile'
import { useScenarioOverlay } from '@/hooks/useScenarioOverlay'
import { runSimulation, runMonteCarlo, runHistoricalSimulation } from '@/lib/simulation'
import { useGrant } from '@/features/auth/GrantContext'
import ScenarioConfigPanel from '@/features/scenarios/ScenarioConfigPanel'
import ScenarioEventList from '@/features/scenarios/ScenarioEventList'
import FutureContributionsList from '@/features/scenarios/FutureContributionsList'
import YearRateOverrideList from '@/features/scenarios/YearRateOverrideList'
import ScenarioResultsChart from '@/features/scenarios/ScenarioResultsChart'
import ScenarioSummaryStats from '@/features/scenarios/ScenarioSummaryStats'
import MonteCarloChart from '@/components/charts/MonteCarloChart'
import HistoricalSimChart from '@/components/charts/HistoricalSimChart'
import ScenarioForm from '@/features/scenarios/ScenarioForm'
import { exportScenarioCsv } from '@/lib/export'
import { exportScenarioXlsx } from '@/lib/exportXlsx'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { HoldingSource } from '@/types/scenario'

type SimMode = 'deterministic' | 'montecarlo' | 'historical'
type XAxisMode = 'simulation' | 'calendar'

// ── Panel order persistence ───────────────────────────────────────────────────

const LEFT_PANELS  = ['parameters', 'year-overrides', 'future-contributions', 'events'] as const
const RIGHT_PANELS = ['chart', 'summary', 'allocation'] as const
type LeftPanelId  = typeof LEFT_PANELS[number]
type RightPanelId = typeof RIGHT_PANELS[number]

const LS_LEFT  = 'wealthlens:scenario-left-panels-v2'   // v2 — includes year-overrides
const LS_RIGHT = 'wealthlens:scenario-right-panels'

function loadOrder<T extends string>(key: string, defaults: readonly T[]): T[] {
  try {
    const s = localStorage.getItem(key)
    if (s) {
      const p = JSON.parse(s) as T[]
      if (p.length === defaults.length && defaults.every(id => p.includes(id))) return p
    }
  } catch { /* ignore */ }
  return [...defaults]
}

// ── Sortable panel wrapper ────────────────────────────────────────────────────

function SortablePanel({ id, title, children, headerRight }: {
  id: string; title: string; children: React.ReactNode; headerRight?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'z-10 opacity-60')}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <div className="flex items-center gap-2">
              {headerRight}
              <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing" onClick={e => e.preventDefault()}>
                <GripVertical className="h-4 w-4" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ScenarioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    scenario, config, events, futureContributions, yearRateOverrides, loading,
    saveConfig, addEvent, updateEvent, deleteEvent,
    addFutureContribution, updateFutureContribution, deleteFutureContribution,
    addYearRateOverride, updateYearRateOverride, deleteYearRateOverride,
  } = useScenarioDetail(id ?? '')
  const { updateScenario } = useScenarios()
  const { isViewer } = useGrant()
  const { portfolioStats, portfolioIds, totalValue } = useNetWorth()
  const { profile } = useProfile()

  const [showEdit, setShowEdit] = useState(false)
  const [simMode, setSimMode] = useState<SimMode>('deterministic')
  const [xAxisMode, setXAxisMode] = useState<XAxisMode>('simulation')
  const [leftOrder, setLeftOrder]   = useState<LeftPanelId[]>(() => loadOrder(LS_LEFT, LEFT_PANELS))
  const [rightOrder, setRightOrder] = useState<RightPanelId[]>(() => loadOrder(LS_RIGHT, RIGHT_PANELS))

  // Overlay state — empty array means "all portfolios"
  const [overlayEnabled, setOverlayEnabled] = useState(false)
  const [overlaySelectedIds, setOverlaySelectedIds] = useState<string[]>([])

  const currency = profile?.currency ?? 'USD'
  const startYear = config?.start_year ?? new Date().getFullYear()
  const horizonYears = config?.time_horizon_years ?? 20
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Empty overlaySelectedIds = use all portfolios
  const overlayPortfolioIds = overlaySelectedIds.length === 0 ? portfolioIds : overlaySelectedIds
  const { overlayData } = useScenarioOverlay(overlayPortfolioIds, startYear, overlayEnabled)

  function toggleOverlayPortfolio(pid: string) {
    setOverlaySelectedIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    )
  }

  function handleLeftDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setLeftOrder(prev => { const next = arrayMove(prev, prev.indexOf(active.id as LeftPanelId), prev.indexOf(over.id as LeftPanelId)); localStorage.setItem(LS_LEFT, JSON.stringify(next)); return next })
  }
  function handleRightDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setRightOrder(prev => { const next = arrayMove(prev, prev.indexOf(active.id as RightPanelId), prev.indexOf(over.id as RightPanelId)); localStorage.setItem(LS_RIGHT, JSON.stringify(next)); return next })
  }

  const simInput = useMemo(() => {
    if (!config || !scenario) return null
    return { config, events, futureContributions, yearRateOverrides, scenarioId: scenario.id, scenarioName: scenario.name }
  }, [config, events, futureContributions, yearRateOverrides, scenario])

  const deterministicResult = useMemo(() => simInput ? runSimulation(simInput) : null, [simInput])
  const monteCarloResult = useMemo(
    () => simMode === 'montecarlo' && simInput ? runMonteCarlo(simInput, 1000) : null,
    [simMode, simInput]
  )
  const historicalResult = useMemo(
    () => simMode === 'historical' && simInput ? runHistoricalSimulation(simInput) : null,
    [simMode, simInput]
  )

  // ── Holding allocation ────────────────────────────────────────────────────

  const holdingAllocation = useMemo(() => {
    const map = new Map<string, number>()
    for (const src of (config?.starting_value_sources ?? [])) map.set(src.holdingId, (map.get(src.holdingId) ?? 0) + src.pct)
    for (const ev of events) for (const src of (ev.linked_sources ?? [])) map.set(src.holdingId, (map.get(src.holdingId) ?? 0) + src.pct)
    return map
  }, [config, events])

  const allocationEntries = useMemo(() => {
    const m = new Map<string, { name: string; portfolio: string; usages: string[]; total: number }>()
    const add = (src: HoldingSource, label: string) => {
      const e = m.get(src.holdingId)
      if (e) { e.usages.push(label); e.total += src.pct }
      else m.set(src.holdingId, { name: src.holdingName, portfolio: src.portfolioName, usages: [label], total: src.pct })
    }
    for (const src of (config?.starting_value_sources ?? [])) add(src, `Starting Value (${src.pct}%)`)
    for (const ev of events) for (const src of (ev.linked_sources ?? [])) add(src, `Year ${ev.event_year} Event (${src.pct}%)`)
    return [...m.values()]
  }, [config, events])

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
  if (!scenario) return (
    <div className="p-6 text-sm text-muted-foreground">
      Scenario not found. <Link to="/scenarios" className="underline">Back to scenarios</Link>
    </div>
  )

  // ── Shared header controls ────────────────────────────────────────────────

  const chartTitle = simMode === 'deterministic'
    ? xAxisMode === 'calendar' ? `Projection · ${startYear}–${startYear + horizonYears - 1}` : `Projection · Yr 1–${horizonYears}`
    : simMode === 'montecarlo'
    ? `Monte Carlo · 1,000 simulations · volatility ${config?.volatility_pct ?? 12}%`
    : `Historical (S&P 500 1926–2024) · ${historicalResult?.windowCount ?? '…'} windows`

  const modeToggle = (
    <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5 text-xs">
      {(['deterministic', 'montecarlo', 'historical'] as SimMode[]).map(mode => (
        <button key={mode} onClick={() => setSimMode(mode)}
          className={cn('rounded px-2 py-1 transition-colors whitespace-nowrap', simMode === mode ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}
        >
          {mode === 'deterministic' ? 'Deterministic' : mode === 'montecarlo' ? 'Monte Carlo' : 'Historical'}
        </button>
      ))}
    </div>
  )

  const xToggle = (
    <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5 text-xs">
      <button onClick={() => setXAxisMode('simulation')} className={cn('rounded px-2 py-1 transition-colors', xAxisMode === 'simulation' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}>Yr 1, 2…</button>
      <button onClick={() => setXAxisMode('calendar')} className={cn('rounded px-2 py-1 transition-colors', xAxisMode === 'calendar' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}>{startYear}…</button>
    </div>
  )

  const overlayToggle = simMode === 'deterministic' ? (
    <button
      onClick={() => setOverlayEnabled(v => !v)}
      className={cn('flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors', overlayEnabled ? 'bg-emerald-100 text-emerald-700' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
      title={overlayEnabled ? 'Hide actual portfolio overlay' : 'Show actual portfolio history'}
    >
      {overlayEnabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      Actual
    </button>
  ) : null

  // ── Left panel renderers ──────────────────────────────────────────────────

  function renderLeftPanel(panelId: LeftPanelId) {
    switch (panelId) {
      case 'parameters':
        return (
          <SortablePanel key="parameters" id="parameters" title="Parameters">
            {config && <ScenarioConfigPanel config={config} onSave={saveConfig} holdingAllocation={holdingAllocation} readOnly={isViewer} />}
          </SortablePanel>
        )
      case 'year-overrides':
        return (
          <SortablePanel key="year-overrides" id="year-overrides" title="Year Rate Overrides">
            <YearRateOverrideList
              overrides={yearRateOverrides}
              timeHorizon={horizonYears}
              onAdd={addYearRateOverride}
              onUpdate={updateYearRateOverride}
              onDelete={deleteYearRateOverride}
              readOnly={isViewer}
            />
          </SortablePanel>
        )
      case 'future-contributions':
        return (
          <SortablePanel key="future-contributions" id="future-contributions" title="Future Annual Contributions">
            <FutureContributionsList contributions={futureContributions} timeHorizon={horizonYears} onAdd={addFutureContribution} onUpdate={updateFutureContribution} onDelete={deleteFutureContribution} readOnly={isViewer} />
          </SortablePanel>
        )
      case 'events':
        return (
          <SortablePanel key="events" id="events" title="One-off Events">
            <ScenarioEventList events={events} timeHorizon={horizonYears} holdingAllocation={holdingAllocation} onAdd={addEvent} onUpdate={updateEvent} onDelete={deleteEvent} readOnly={isViewer} />
          </SortablePanel>
        )
    }
  }

  // ── Right panel renderers ─────────────────────────────────────────────────

  function renderRightPanel(panelId: RightPanelId) {
    switch (panelId) {
      case 'chart':
        return (
          <SortablePanel key="chart" id="chart" title={chartTitle}>
            {/* Row 1: simulation mode toggle */}
            <div className="mb-2 flex items-center justify-between">
              {modeToggle}
            </div>
            {/* Row 2: year-axis toggle + overlay toggle */}
            <div className="mb-3 flex items-center gap-2">
              {xToggle}
              {overlayToggle}
            </div>
            {/* Overlay portfolio multi-select (shown when overlay is active) */}
            {overlayEnabled && simMode === 'deterministic' && portfolioStats.length > 0 && (
              <div className="mb-3 rounded-lg border p-2 space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">Overlay portfolios:</p>
                <label className="flex cursor-pointer items-center gap-2 text-xs hover:bg-muted/30 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={overlaySelectedIds.length === 0}
                    onChange={() => setOverlaySelectedIds([])}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  All portfolios (combined)
                </label>
                {portfolioStats.map(p => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-xs hover:bg-muted/30 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={overlaySelectedIds.includes(p.id)}
                      onChange={() => toggleOverlayPortfolio(p.id)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}

            {simMode === 'deterministic' && deterministicResult && (
              <ScenarioResultsChart
                result={deterministicResult}
                currentNetWorth={totalValue}
                currency={currency}
                xAxisMode={xAxisMode}
                startYear={startYear}
                overlayData={overlayEnabled ? overlayData : []}
                yearRateOverrides={yearRateOverrides}
              />
            )}
            {simMode === 'montecarlo' && (
              monteCarloResult
                ? <MonteCarloChart result={monteCarloResult} currentNetWorth={totalValue} currency={currency} xAxisMode={xAxisMode} startYear={startYear} />
                : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Running 1,000 simulations…</div>
            )}
            {simMode === 'historical' && (
              historicalResult
                ? <HistoricalSimChart result={historicalResult} currency={currency} xAxisMode={xAxisMode} startYear={startYear} />
                : <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Running historical simulation…</div>
            )}
          </SortablePanel>
        )

      case 'summary':
        return (
          <SortablePanel key="summary" id="summary" title={simMode === 'deterministic' ? 'Summary' : simMode === 'historical' ? 'Historical Summary' : 'Probability Summary'}>
            {simMode === 'deterministic' && deterministicResult && <ScenarioSummaryStats result={deterministicResult} currency={currency} />}
            {simMode === 'montecarlo' && monteCarloResult && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Nominal (Market Value)</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MCStat label="Median" value={formatCurrency(monteCarloResult.finalMedian, currency)} highlight />
                    <MCStat label="Pessimistic (P10)" value={formatCurrency(monteCarloResult.finalP10, currency)} />
                    <MCStat label="Optimistic (P90)" value={formatCurrency(monteCarloResult.finalP90, currency)} />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Inflation-Adjusted (Real Value)</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MCStat label="Median" value={formatCurrency(monteCarloResult.finalRealMedian, currency)} highlight />
                    <MCStat label="Pessimistic (P10)" value={formatCurrency(monteCarloResult.finalRealP10, currency)} />
                    <MCStat label="Optimistic (P90)" value={formatCurrency(monteCarloResult.finalRealP90, currency)} />
                  </div>
                </div>
                {totalValue > 0 && (
                  <div className="grid grid-cols-2 gap-3 border-t pt-3">
                    <MCStat label="Prob. ≥ Current Net Worth (Nominal)" value={formatPercent(monteCarloResult.successRate(totalValue))} />
                    <MCStat label="Prob. ≥ Current Net Worth (Real)" value={formatPercent(monteCarloResult.realSuccessRate(totalValue))} />
                  </div>
                )}
              </div>
            )}
            {simMode === 'historical' && historicalResult && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Nominal (Market Value)</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MCStat label="Median" value={formatCurrency(historicalResult.finalMedian, currency)} highlight />
                    <MCStat label="Pessimistic (P10)" value={formatCurrency(historicalResult.finalP10, currency)} />
                    <MCStat label="Optimistic (P90)" value={formatCurrency(historicalResult.finalP90, currency)} />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Inflation-Adjusted (Real Value)</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MCStat label="Median" value={formatCurrency(historicalResult.finalRealMedian, currency)} highlight />
                    <MCStat label="Pessimistic (P10)" value={formatCurrency(historicalResult.finalRealP10, currency)} />
                    <MCStat label="Optimistic (P90)" value={formatCurrency(historicalResult.finalRealP90, currency)} />
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Historical windows tested</span><span className="font-medium">{historicalResult.windowCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Best period started</span><span className="font-medium text-emerald-600">{historicalResult.bestStartYear}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Worst period started</span><span className="font-medium text-destructive">{historicalResult.worstStartYear}</span></div>
                </div>
              </div>
            )}
          </SortablePanel>
        )

      case 'allocation':
        if (allocationEntries.length === 0) return null
        return (
          <SortablePanel key="allocation" id="allocation" title="Holding Allocation">
            <div className="space-y-3">
              {allocationEntries.map((entry, i) => {
                const over = entry.total > 100; const full = entry.total === 100
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div><span className="font-medium">{entry.name}</span>{entry.portfolio && <span className="ml-1 text-xs text-muted-foreground">({entry.portfolio})</span>}</div>
                      <span className={cn('font-semibold tabular-nums', over ? 'text-destructive' : full ? 'text-amber-600' : 'text-emerald-600')}>{entry.total}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', over ? 'bg-destructive' : full ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(entry.total, 100)}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">{entry.usages.join(' · ')}</div>
                    {over && <p className="text-xs text-destructive">⚠ Exceeds 100%</p>}
                  </div>
                )
              })}
            </div>
          </SortablePanel>
        )
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link to="/scenarios" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All Scenarios
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{scenario.name}</h1>
            {!isViewer && (
              <button onClick={() => setShowEdit(true)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          {scenario.description && <p className="mt-1 text-sm text-muted-foreground">{scenario.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => deterministicResult && exportScenarioCsv(deterministicResult, scenario.name, startYear)} disabled={!deterministicResult}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!simInput || !deterministicResult) return
            const mc   = runMonteCarlo(simInput, 1000)
            const hist = runHistoricalSimulation(simInput)
            exportScenarioXlsx(scenario.name, startYear, currency, deterministicResult, mc, hist)
          }} disabled={!deterministicResult}>
            <Download className="mr-2 h-4 w-4" /> Export XLSX
          </Button>
          <Button variant="outline" onClick={() => navigate('/scenarios')}>Done</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLeftDragEnd}>
            <SortableContext items={leftOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">{leftOrder.map(renderLeftPanel)}</div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="lg:col-span-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRightDragEnd}>
            <SortableContext items={rightOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">{rightOrder.map(renderRightPanel)}</div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <ScenarioForm open={showEdit} onClose={() => setShowEdit(false)} scenario={scenario} onUpdate={async (id, data) => { await updateScenario(id, data) }} />
    </div>
  )
}

function MCStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', highlight && 'border-primary/30 bg-primary/5')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-sm font-semibold tabular-nums', highlight && 'text-primary')}>{value}</div>
    </div>
  )
}
