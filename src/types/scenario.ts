export interface Scenario {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

// A single portfolio holding used as a value source (starting value or event amount)
export interface HoldingSource {
  portfolioId: string
  portfolioName: string
  holdingId: string
  holdingName: string
  pct: number         // % of the holding's snapshot to use
  snapshot: number    // holding current_value at time of snapshot
  snapshotDate: string
}

export interface ScenarioConfig {
  id: string
  scenario_id: string
  portfolio_id: string | null
  start_year: number
  initial_value: number
  annual_contribution: number
  contribution_growth_pct: number
  annual_return_pct: number
  volatility_pct: number
  inflation_pct: number
  time_horizon_years: number
  withdrawal_start_year: number | null
  annual_withdrawal: number
  withdrawal_inflation_adjusted: boolean
  // Multi-holding sources for the starting value (JSONB array)
  starting_value_sources: HoldingSource[]
}

export type ScenarioEventType = 'withdrawal' | 'contribution' | 'shock' | 'rebalance'

export interface ScenarioEvent {
  id: string
  scenario_id: string
  event_year: number
  event_type: ScenarioEventType
  amount: number
  description: string | null
  // Multi-holding sources for contribution events (JSONB array)
  linked_sources: HoldingSource[]
}

export interface YearRateOverride {
  id: string
  scenario_id: string
  from_year: number
  to_year: number | null   // null = single year
  annual_return_pct: number | null  // null = use flat config rate
  inflation_pct: number | null      // null = use flat config rate
  note: string | null
  created_at: string
}

export interface FutureContribution {
  id: string
  scenario_id: string
  name: string
  annual_amount: number
  start_year: number
  end_year: number | null
  created_at: string
}

// ── Simulation output types ───────────────────────────────────────────────────

export interface SimulationYearResult {
  year: number
  startValue: number
  contribution: number
  futureContribAmount: number
  eventContribution: number
  growth: number
  withdrawal: number
  eventWithdrawal: number
  shockAmount: number
  endValue: number
  inflationAdjustedValue: number
  annualReturnPct: number
  inflationPct: number
}

export interface SimulationResult {
  scenarioId: string
  scenarioName: string
  years: SimulationYearResult[]
  finalValue: number
  finalInflationAdjustedValue: number
}

export interface MonteCarloYearResult {
  year: number
  p10: number
  p25: number
  median: number
  p75: number
  p90: number
}

export interface HistoricalSimYearResult {
  year: number
  p10: number
  p25: number
  median: number
  p75: number
  p90: number
}

export interface HistoricalSimResult {
  years: HistoricalSimYearResult[]
  // Nominal (market value) percentiles
  finalP10: number
  finalP25: number
  finalMedian: number
  finalP75: number
  finalP90: number
  // Inflation-adjusted (real value) percentiles
  finalRealP10: number
  finalRealP25: number
  finalRealMedian: number
  finalRealP75: number
  finalRealP90: number
  worstStartYear: number
  bestStartYear: number
  windowCount: number
}

export interface MonteCarloResult {
  years: MonteCarloYearResult[]
  // Nominal (market value) percentiles
  finalP10: number
  finalP25: number
  finalMedian: number
  finalP75: number
  finalP90: number
  // Inflation-adjusted (real value) percentiles
  finalRealP10: number
  finalRealP25: number
  finalRealMedian: number
  finalRealP75: number
  finalRealP90: number
  successRate: (target: number) => number
  realSuccessRate: (target: number) => number
}
