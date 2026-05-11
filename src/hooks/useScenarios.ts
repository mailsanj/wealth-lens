import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { useGrant } from '@/features/auth/GrantContext'
import type { Scenario, ScenarioConfig, ScenarioEvent, FutureContribution, YearRateOverride } from '@/types/scenario'

// ── Multi-scenario fetch (for comparison page) ────────────────────────────────

export interface ScenarioBundle {
  scenario: Scenario
  config: ScenarioConfig
  events: ScenarioEvent[]
  futureContributions: FutureContribution[]
}

export function useMultipleScenarios(ids: string[]) {
  const [bundles, setBundles] = useState<ScenarioBundle[]>([])
  const [loading, setLoading] = useState(true)
  const key = ids.slice().sort().join(',')

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return }
    setLoading(true)
    Promise.all(ids.map(async id => {
      const [{ data: sc }, { data: cfgs }, { data: evts }, { data: fcs }] = await Promise.all([
        supabase.from('scenarios').select('*').eq('id', id).single(),
        supabase.from('scenario_configs').select('*').eq('scenario_id', id),
        supabase.from('scenario_events').select('*').eq('scenario_id', id).order('event_year'),
        supabase.from('scenario_future_contributions').select('*').eq('scenario_id', id).order('start_year'),
      ])
      const cfgArr = (cfgs ?? []) as unknown as ScenarioConfig[]
      if (!sc || cfgArr.length === 0) return null
      return {
        scenario: sc as unknown as Scenario,
        config: cfgArr[0],
        events: (evts ?? []) as unknown as ScenarioEvent[],
        futureContributions: (fcs ?? []) as unknown as FutureContribution[],
      } as ScenarioBundle
    })).then(results => {
      setBundles(results.filter(Boolean) as ScenarioBundle[])
      setLoading(false)
    })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return { bundles, loading }
}

// ── Scenario list ─────────────────────────────────────────────────────────────

export function useScenarios() {
  const { user } = useAuth()
  const { effectiveUserId } = useGrant()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    const { data } = await supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
    setScenarios((data ?? []) as unknown as Scenario[])
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { fetch() }, [fetch])

  async function createScenario(input: Pick<Scenario, 'name' | 'description'>) {
    const { data, error } = await supabase
      .from('scenarios')
      .insert({ ...input, user_id: user!.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const s = data as unknown as Scenario
    setScenarios(prev => [s, ...prev])
    return s
  }

  async function updateScenario(id: string, input: Pick<Scenario, 'name' | 'description'>) {
    const { data, error } = await supabase
      .from('scenarios')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const s = data as unknown as Scenario
    setScenarios(prev => prev.map(sc => sc.id === id ? s : sc))
    return s
  }

  async function duplicateScenario(id: string) {
    const source = scenarios.find(s => s.id === id)
    if (!source) return
    // Create new scenario
    const newScenario = await createScenario({ name: `Copy of ${source.name}`, description: source.description })
    // Copy config
    const { data: cfgs } = await supabase.from('scenario_configs').select('*').eq('scenario_id', id)
    if (cfgs && (cfgs as unknown[]).length > 0) {
      const { id: _id, scenario_id: _sid, ...cfg } = (cfgs as unknown as ({ id: string; scenario_id: string } & object)[])[0]
      await supabase.from('scenario_configs').insert({ ...cfg, scenario_id: newScenario.id } as never)
    }
    // Copy events
    const { data: evts } = await supabase.from('scenario_events').select('*').eq('scenario_id', id)
    if (evts && (evts as unknown[]).length > 0) {
      const copies = (evts as unknown as { id: string; scenario_id: string }[]).map(({ id: _i, scenario_id: _s, ...e }) => ({ ...e, scenario_id: newScenario.id }))
      await supabase.from('scenario_events').insert(copies as never)
    }
    // Copy future contributions
    const { data: fcs } = await supabase.from('scenario_future_contributions').select('*').eq('scenario_id', id)
    if (fcs && (fcs as unknown[]).length > 0) {
      const copies = (fcs as unknown as { id: string; scenario_id: string; created_at: string }[]).map(({ id: _i, scenario_id: _s, created_at: _c, ...f }) => ({ ...f, scenario_id: newScenario.id }))
      await supabase.from('scenario_future_contributions').insert(copies as never)
    }
    return newScenario
  }

  async function deleteScenario(id: string) {
    const { error } = await supabase.from('scenarios').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setScenarios(prev => prev.filter(s => s.id !== id))
  }

  return { scenarios, loading, createScenario, updateScenario, duplicateScenario, deleteScenario, refetch: fetch }
}

// ── Scenario detail (config + events + future contributions) ──────────────────

const DEFAULT_CONFIG: Omit<ScenarioConfig, 'id' | 'scenario_id'> = {
  portfolio_id: null,
  start_year: new Date().getFullYear(),
  initial_value: 100000,
  annual_contribution: 12000,
  contribution_growth_pct: 3,
  annual_return_pct: 7,
  volatility_pct: 12,
  inflation_pct: 3,
  time_horizon_years: 20,
  withdrawal_start_year: null,
  annual_withdrawal: 0,
  withdrawal_inflation_adjusted: false,
  starting_value_sources: [],
}

export function useScenarioDetail(scenarioId: string) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [config, setConfig] = useState<ScenarioConfig | null>(null)
  const [events, setEvents] = useState<ScenarioEvent[]>([])
  const [futureContributions, setFutureContributions] = useState<FutureContribution[]>([])
  const [yearRateOverrides, setYearRateOverrides] = useState<YearRateOverride[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!scenarioId) return
    setLoading(true)

    const [{ data: sc }, { data: cfgs }, { data: evts }, { data: fcs }, { data: yro }] = await Promise.all([
      supabase.from('scenarios').select('*').eq('id', scenarioId).single(),
      supabase.from('scenario_configs').select('*').eq('scenario_id', scenarioId),
      supabase.from('scenario_events').select('*').eq('scenario_id', scenarioId).order('event_year'),
      supabase.from('scenario_future_contributions').select('*').eq('scenario_id', scenarioId).order('start_year'),
      supabase.from('scenario_year_rate_overrides').select('*').eq('scenario_id', scenarioId).order('from_year'),
    ])

    setScenario(sc as unknown as Scenario)

    if (cfgs && (cfgs as unknown[]).length > 0) {
      setConfig((cfgs as unknown as ScenarioConfig[])[0])
    } else {
      const { data: newCfg } = await supabase
        .from('scenario_configs')
        .insert({ ...DEFAULT_CONFIG, scenario_id: scenarioId })
        .select()
        .single()
      setConfig(newCfg as unknown as ScenarioConfig)
    }

    setEvents((evts ?? []) as unknown as ScenarioEvent[])
    setFutureContributions((fcs ?? []) as unknown as FutureContribution[])
    setYearRateOverrides((yro ?? []) as unknown as YearRateOverride[])
    setLoading(false)
  }, [scenarioId])

  useEffect(() => { fetch() }, [fetch])

  // ── Config ──────────────────────────────────────────────────────────────────

  async function saveConfig(updates: Omit<ScenarioConfig, 'id' | 'scenario_id'>) {
    if (!config) return
    const { data, error } = await supabase
      .from('scenario_configs')
      .update(updates)
      .eq('id', config.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setConfig(data as unknown as ScenarioConfig)
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  const sortEvents = (evts: ScenarioEvent[]) => [...evts].sort((a, b) => a.event_year - b.event_year)

  async function addEvent(input: Omit<ScenarioEvent, 'id' | 'scenario_id'>) {
    const { data, error } = await supabase
      .from('scenario_events')
      .insert({ ...input, scenario_id: scenarioId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const ev = data as unknown as ScenarioEvent
    setEvents(prev => sortEvents([...prev, ev]))
    return ev
  }

  async function updateEvent(id: string, input: Omit<ScenarioEvent, 'id' | 'scenario_id'>) {
    const { data, error } = await supabase
      .from('scenario_events')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const ev = data as unknown as ScenarioEvent
    setEvents(prev => sortEvents(prev.map(e => e.id === id ? ev : e)))
    return ev
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.from('scenario_events').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  // ── Future contributions ────────────────────────────────────────────────────

  const sortFCs = (fcs: FutureContribution[]) => [...fcs].sort((a, b) => a.start_year - b.start_year)

  async function addFutureContribution(input: Omit<FutureContribution, 'id' | 'scenario_id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('scenario_future_contributions')
      .insert({ ...input, scenario_id: scenarioId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const fc = data as unknown as FutureContribution
    setFutureContributions(prev => sortFCs([...prev, fc]))
    return fc
  }

  async function updateFutureContribution(id: string, input: Omit<FutureContribution, 'id' | 'scenario_id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('scenario_future_contributions')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const fc = data as unknown as FutureContribution
    setFutureContributions(prev => sortFCs(prev.map(f => f.id === id ? fc : f)))
    return fc
  }

  async function deleteFutureContribution(id: string) {
    const { error } = await supabase.from('scenario_future_contributions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setFutureContributions(prev => prev.filter(f => f.id !== id))
  }

  // ── Year rate overrides ────────────────────────────────────────────────────

  const sortYRO = (list: YearRateOverride[]) => [...list].sort((a, b) => a.from_year - b.from_year)

  async function addYearRateOverride(input: Omit<YearRateOverride, 'id' | 'scenario_id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('scenario_year_rate_overrides')
      .insert({ ...input, scenario_id: scenarioId })
      .select().single()
    if (error) throw new Error(error.message)
    const o = data as unknown as YearRateOverride
    setYearRateOverrides(prev => sortYRO([...prev, o]))
    return o
  }

  async function updateYearRateOverride(id: string, input: Omit<YearRateOverride, 'id' | 'scenario_id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('scenario_year_rate_overrides')
      .update(input).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    const o = data as unknown as YearRateOverride
    setYearRateOverrides(prev => sortYRO(prev.map(x => x.id === id ? o : x)))
    return o
  }

  async function deleteYearRateOverride(id: string) {
    const { error } = await supabase.from('scenario_year_rate_overrides').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setYearRateOverrides(prev => prev.filter(x => x.id !== id))
  }

  return {
    scenario, config, events, futureContributions, yearRateOverrides, loading,
    saveConfig,
    addEvent, updateEvent, deleteEvent,
    addFutureContribution, updateFutureContribution, deleteFutureContribution,
    addYearRateOverride, updateYearRateOverride, deleteYearRateOverride,
  }
}
