import type { ScenarioConfig, ScenarioEvent, FutureContribution, YearRateOverride, SimulationYearResult, SimulationResult, MonteCarloResult, HistoricalSimResult } from '@/types/scenario'
import { SP500_ANNUAL_RETURNS } from '@/lib/historicalReturns'

export interface SimulationInput {
  config: ScenarioConfig
  events: ScenarioEvent[]
  futureContributions: FutureContribution[]
  yearRateOverrides?: YearRateOverride[]
  scenarioId: string
  scenarioName: string
}

/**
 * Resolves the effective annual return and inflation rates for a given simulation year.
 * Single-year overrides (to_year === null) take precedence over ranges.
 */
function resolveRates(
  year: number,
  overrides: YearRateOverride[],
  baseReturnPct: number,
  baseInflationPct: number,
): { returnPct: number; inflationPct: number } {
  const single = overrides.find(o => o.from_year === year && o.to_year === null)
  const range = overrides.find(o => o.to_year !== null && o.from_year <= year && o.to_year! >= year)
  const hit = single ?? range
  return {
    returnPct:     hit?.annual_return_pct ?? baseReturnPct,
    inflationPct:  hit?.inflation_pct     ?? baseInflationPct,
  }
}

/**
 * Runs a deterministic compound-growth simulation year by year.
 *
 * Shock events: `amount` is a percentage loss (e.g. 30 = 30% drop applied to
 * the value after regular contributions and growth for that year).
 * All other event amounts are absolute dollar values.
 *
 * Future contributions: recurring income streams (Social Security, annuities)
 * defined by start/end year. They apply regardless of withdrawal phase.
 *
 * Inflation-adjusted withdrawals: when enabled, the annual withdrawal grows
 * with the inflation rate each year to maintain real purchasing power.
 */
export function runSimulation(input: SimulationInput): SimulationResult {
  const { config, events, futureContributions, yearRateOverrides = [], scenarioId, scenarioName } = input
  const {
    initial_value,
    annual_contribution,
    contribution_growth_pct,
    annual_return_pct,
    inflation_pct,
    time_horizon_years,
    withdrawal_start_year,
    annual_withdrawal,
    withdrawal_inflation_adjusted,
  } = config

  const years: SimulationYearResult[] = []
  let currentValue = initial_value
  let currentContribution = annual_contribution
  let cumulativeInflation = 1

  for (let year = 1; year <= time_horizon_years; year++) {
    // Apply year-rate overrides if any
    const { returnPct, inflationPct: yearInflationPct } = resolveRates(
      year, yearRateOverrides, annual_return_pct, inflation_pct
    )
    const inflationRate = 1 + yearInflationPct / 100

    const startValue = currentValue
    const isWithdrawalPhase = withdrawal_start_year !== null && year >= withdrawal_start_year

    // Regular contribution (stops during withdrawal phase)
    const contribution = isWithdrawalPhase ? 0 : currentContribution

    // Future recurring contributions (Social Security, annuities, etc.)
    // These continue regardless of withdrawal phase
    const futureContribAmount = futureContributions
      .filter(fc => year >= fc.start_year && (fc.end_year === null || year <= fc.end_year))
      .reduce((sum, fc) => sum + fc.annual_amount, 0)

    // Growth applied to start value + all contributions this year
    const growth = (startValue + contribution + futureContribAmount) * (returnPct / 100)

    // Withdrawal — optionally inflation-adjusted to maintain real purchasing power
    let withdrawal = 0
    if (isWithdrawalPhase) {
      if (withdrawal_inflation_adjusted && withdrawal_start_year !== null) {
        const yearsIntoWithdrawal = year - withdrawal_start_year
        // Use config inflation_pct for withdrawal indexing (not per-year override)
        withdrawal = annual_withdrawal * Math.pow(1 + inflation_pct / 100, yearsIntoWithdrawal)
      } else {
        withdrawal = annual_withdrawal
      }
    }

    // One-off events for this year
    const yearEvents = events.filter(e => e.event_year === year)
    let shockAmount = 0
    let eventContribution = 0
    let eventWithdrawal = 0

    for (const ev of yearEvents) {
      switch (ev.event_type) {
        case 'contribution':
          eventContribution += ev.amount
          break
        case 'withdrawal':
          eventWithdrawal += ev.amount
          break
        case 'shock':
          shockAmount += (startValue + contribution + futureContribAmount + growth) * (ev.amount / 100)
          break
        case 'rebalance':
          break
      }
    }

    const endValue = Math.max(0,
      startValue
      + contribution
      + futureContribAmount
      + growth
      - shockAmount
      + eventContribution
      - withdrawal
      - eventWithdrawal
    )

    cumulativeInflation *= inflationRate
    const inflationAdjustedValue = endValue / cumulativeInflation

    years.push({
      year,
      startValue,
      contribution,
      futureContribAmount,
      eventContribution,
      growth,
      withdrawal,
      eventWithdrawal,
      shockAmount,
      endValue,
      inflationAdjustedValue,
      annualReturnPct: returnPct,
      inflationPct: yearInflationPct,
    })

    currentValue = endValue
    if (!isWithdrawalPhase) {
      currentContribution *= (1 + contribution_growth_pct / 100)
    }
  }

  const last = years.at(-1)
  return {
    scenarioId,
    scenarioName,
    years,
    finalValue: last?.endValue ?? 0,
    finalInflationAdjustedValue: last?.inflationAdjustedValue ?? 0,
  }
}

/**
 * Returns the projected value at a given year (1-based).
 * Returns the final value if the year exceeds the horizon.
 */
export function projectedValueAtYear(result: SimulationResult, year: number): number {
  return result.years.find(y => y.year === year)?.endValue ?? result.finalValue
}

/**
 * Estimates how many years until the portfolio reaches a target value.
 * Returns null if it never reaches the target within the horizon.
 */
export function yearsToTarget(result: SimulationResult, target: number): number | null {
  const hit = result.years.find(y => y.endValue >= target)
  return hit ? hit.year : null
}

/**
 * Monte Carlo simulation using per-year random returns drawn from a normal
 * distribution (Box-Muller transform). Each iteration draws a fresh return
 * for every year, modelling sequence-of-returns risk.
 *
 * Returns percentile bands (p10/p25/median/p75/p90) for each year plus a
 * successRate function that estimates the probability of reaching a target.
 */
export function runMonteCarlo(input: SimulationInput, iterations = 1000): MonteCarloResult {
  const { config, events, futureContributions, yearRateOverrides = [] } = input
  const {
    initial_value, annual_contribution, contribution_growth_pct,
    annual_return_pct, volatility_pct = 12, inflation_pct,
    time_horizon_years, withdrawal_start_year, annual_withdrawal,
    withdrawal_inflation_adjusted,
  } = config

  const mean = annual_return_pct / 100
  const stdDev = volatility_pct / 100
  const inflationRate = 1 + inflation_pct / 100

  // Each row = one iteration's end-values across all years
  const allIterations: number[][] = []

  for (let i = 0; i < iterations; i++) {
    const yearValues: number[] = []
    let value = initial_value
    let contribution = annual_contribution

    for (let year = 1; year <= time_horizon_years; year++) {
      // Box-Muller: normally distributed random return for this year
      // Year-rate overrides are applied deterministically even in Monte Carlo
      const override = resolveRates(year, yearRateOverrides, annual_return_pct, inflation_pct)
      const hasReturnOverride = yearRateOverrides.some(o =>
        o.annual_return_pct !== null &&
        o.from_year <= year && (o.to_year === null ? o.from_year === year : o.to_year >= year)
      )
      const u1 = Math.max(Math.random(), 1e-10)
      const u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      // If override exists for this year, use it exactly (no randomisation)
      const yearReturn = hasReturnOverride
        ? override.returnPct / 100
        : mean + stdDev * z

      const isWithdrawal = withdrawal_start_year !== null && year >= withdrawal_start_year
      const contrib = isWithdrawal ? 0 : contribution
      const futureContrib = futureContributions
        .filter(fc => year >= fc.start_year && (fc.end_year === null || year <= fc.end_year))
        .reduce((s, fc) => s + fc.annual_amount, 0)

      const growth = (value + contrib + futureContrib) * yearReturn

      let withdrawal = 0
      if (isWithdrawal) {
        withdrawal = withdrawal_inflation_adjusted && withdrawal_start_year
          ? annual_withdrawal * Math.pow(inflationRate, year - withdrawal_start_year)
          : annual_withdrawal
      }

      // One-off events
      let eventContrib = 0, eventWithdraw = 0, shock = 0
      for (const ev of events.filter(e => e.event_year === year)) {
        if (ev.event_type === 'contribution') eventContrib += ev.amount
        else if (ev.event_type === 'withdrawal') eventWithdraw += ev.amount
        else if (ev.event_type === 'shock')
          shock += (value + contrib + futureContrib + growth) * (ev.amount / 100)
      }

      value = Math.max(0,
        value + contrib + futureContrib + growth
        - shock + eventContrib - withdrawal - eventWithdraw
      )
      yearValues.push(value)

      if (!isWithdrawal) contribution *= (1 + contribution_growth_pct / 100)
    }
    allIterations.push(yearValues)
  }

  // Compute percentiles for each year
  const years = Array.from({ length: time_horizon_years }, (_, i) => {
    const sorted = allIterations.map(r => r[i]).sort((a, b) => a - b)
    return {
      year: i + 1,
      p10: pct(sorted, 10),
      p25: pct(sorted, 25),
      median: pct(sorted, 50),
      p75: pct(sorted, 75),
      p90: pct(sorted, 90),
    }
  })

  const finalSorted = allIterations.map(r => r[r.length - 1]).sort((a, b) => a - b)

  // Inflation-adjusted final values: divide nominal by cumulative inflation over horizon
  const cumulativeInflation = Math.pow(inflationRate, time_horizon_years)
  const finalRealSorted = finalSorted.map(v => v / cumulativeInflation)

  return {
    years,
    finalP10:   pct(finalSorted, 10),
    finalP25:   pct(finalSorted, 25),
    finalMedian: pct(finalSorted, 50),
    finalP75:   pct(finalSorted, 75),
    finalP90:   pct(finalSorted, 90),
    finalRealP10:    pct(finalRealSorted, 10),
    finalRealP25:    pct(finalRealSorted, 25),
    finalRealMedian: pct(finalRealSorted, 50),
    finalRealP75:    pct(finalRealSorted, 75),
    finalRealP90:    pct(finalRealSorted, 90),
    successRate: (target: number) =>
      (allIterations.filter(r => r[r.length - 1] >= target).length / iterations) * 100,
    realSuccessRate: (target: number) =>
      (finalRealSorted.filter(v => v >= target).length / iterations) * 100,
  }
}

/**
 * Runs the scenario against every possible historical S&P 500 return sequence
 * (rolling windows). Returns percentile bands per simulation year and metadata
 * identifying the best/worst historical starting years.
 *
 * Inflation uses the flat config rate for all paths (CPI data not embedded).
 * Year-rate overrides are NOT applied — this mode shows unmodified historical sequences.
 */
export function runHistoricalSimulation(input: SimulationInput): HistoricalSimResult {
  const { config, events, futureContributions } = input
  const {
    initial_value, annual_contribution, contribution_growth_pct,
    inflation_pct, time_horizon_years, withdrawal_start_year, annual_withdrawal,
    withdrawal_inflation_adjusted,
  } = config

  const inflationRate = 1 + inflation_pct / 100
  const returns = SP500_ANNUAL_RETURNS.map(r => r.return)
  const maxStart = returns.length - time_horizon_years

  if (maxStart < 1) {
    // Not enough history for this horizon — return empty
    const empty = Array.from({ length: time_horizon_years }, (_, i) => ({
      year: i + 1, p10: 0, p25: 0, median: 0, p75: 0, p90: 0,
    }))
    return { years: empty, finalP10: 0, finalP25: 0, finalMedian: 0, finalP75: 0, finalP90: 0, finalRealP10: 0, finalRealP25: 0, finalRealMedian: 0, finalRealP75: 0, finalRealP90: 0, worstStartYear: 0, bestStartYear: 0, windowCount: 0 }
  }

  // Each row = one historical window's end-values across all simulation years
  const allPaths: number[][] = []
  const startYears: number[] = []

  for (let startIdx = 0; startIdx <= maxStart; startIdx++) {
    const yearValues: number[] = []
    let value = initial_value
    let contribution = annual_contribution
    let cumulativeInflation = 1

    for (let year = 1; year <= time_horizon_years; year++) {
      const histReturn = returns[startIdx + year - 1] / 100
      cumulativeInflation *= inflationRate

      const isWithdrawal = withdrawal_start_year !== null && year >= withdrawal_start_year
      const contrib = isWithdrawal ? 0 : contribution
      const futureContrib = futureContributions
        .filter(fc => year >= fc.start_year && (fc.end_year === null || year <= fc.end_year))
        .reduce((s, fc) => s + fc.annual_amount, 0)

      const growth = (value + contrib + futureContrib) * histReturn

      let withdrawal = 0
      if (isWithdrawal) {
        withdrawal = withdrawal_inflation_adjusted && withdrawal_start_year
          ? annual_withdrawal * Math.pow(inflationRate, year - withdrawal_start_year)
          : annual_withdrawal
      }

      let eventContrib = 0, eventWithdraw = 0, shock = 0
      for (const ev of events.filter(e => e.event_year === year)) {
        if (ev.event_type === 'contribution') eventContrib += ev.amount
        else if (ev.event_type === 'withdrawal') eventWithdraw += ev.amount
        else if (ev.event_type === 'shock')
          shock += (value + contrib + futureContrib + growth) * (ev.amount / 100)
      }

      value = Math.max(0,
        value + contrib + futureContrib + growth - shock + eventContrib - withdrawal - eventWithdraw
      )
      yearValues.push(value)
      if (!isWithdrawal) contribution *= (1 + contribution_growth_pct / 100)
    }
    allPaths.push(yearValues)
    startYears.push(SP500_ANNUAL_RETURNS[startIdx].year)
  }

  // Percentiles per year
  const years = Array.from({ length: time_horizon_years }, (_, i) => {
    const sorted = allPaths.map(r => r[i]).sort((a, b) => a - b)
    return { year: i + 1, p10: pct(sorted, 10), p25: pct(sorted, 25), median: pct(sorted, 50), p75: pct(sorted, 75), p90: pct(sorted, 90) }
  })

  const finalValues = allPaths.map(r => r[r.length - 1])
  const finalSorted = [...finalValues].sort((a, b) => a - b)
  const worstIdx = finalValues.indexOf(Math.min(...finalValues))
  const bestIdx = finalValues.indexOf(Math.max(...finalValues))

  // Inflation-adjusted final values using config inflation rate
  const cumulativeInflation = Math.pow(1 + inflation_pct / 100, time_horizon_years)
  const finalRealSorted = finalSorted.map(v => v / cumulativeInflation)

  return {
    years,
    finalP10:   pct(finalSorted, 10),
    finalP25:   pct(finalSorted, 25),
    finalMedian: pct(finalSorted, 50),
    finalP75:   pct(finalSorted, 75),
    finalP90:   pct(finalSorted, 90),
    finalRealP10:    pct(finalRealSorted, 10),
    finalRealP25:    pct(finalRealSorted, 25),
    finalRealMedian: pct(finalRealSorted, 50),
    finalRealP75:    pct(finalRealSorted, 75),
    finalRealP90:    pct(finalRealSorted, 90),
    worstStartYear: startYears[worstIdx],
    bestStartYear: startYears[bestIdx],
    windowCount: allPaths.length,
  }
}

function pct(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
