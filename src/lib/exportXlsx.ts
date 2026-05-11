import * as XLSX from 'xlsx'
import type { Holding } from '@/types/holding'
import type { SimulationResult, MonteCarloResult, HistoricalSimResult } from '@/types/scenario'
import { ASSET_TYPES } from '@/lib/constants'

function slugDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// Apply an Excel number format code to all data cells in a column (skips header row 0)
function applyFmt(ws: XLSX.WorkSheet, colIndex: number, rowCount: number, fmt: string) {
  for (let r = 1; r <= rowCount; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: colIndex })
    if (ws[addr]) ws[addr].z = fmt
  }
}

interface PercentileSummary {
  p10: number; p25: number; median: number; p75: number; p90: number
}

// Appends nominal + inflation-adjusted summary rows below year data and applies currency format
function appendPercentileSummary(
  ws: XLSX.WorkSheet,
  nominal: PercentileSummary,
  real: PercentileSummary,
  currency: string,
  startRow: number,
  extraRows: (string | number)[][] = [],
) {
  const rows = [
    [`Summary — Nominal (${currency})`],
    ['P10 (Pessimistic)', nominal.p10],
    ['P25', nominal.p25],
    ['Median', nominal.median],
    ['P75', nominal.p75],
    ['P90 (Optimistic)', nominal.p90],
    [],
    [`Summary — Inflation-Adjusted (${currency})`],
    ['P10 (Pessimistic)', real.p10],
    ['P25', real.p25],
    ['Median', real.median],
    ['P75', real.p75],
    ['P90 (Optimistic)', real.p90],
    ...extraRows,
  ]
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: { r: startRow, c: 0 } })
  rows.forEach((row, i) => {
    if (row.length < 2) return
    const addr = XLSX.utils.encode_cell({ r: startRow + i, c: 1 })
    if (ws[addr]) ws[addr].z = CURRENCY_FMT
  })
}

// "#,##0.00" → 1,234.56   |   "0.00" → plain 2dp   |   "0.00%" → percentage
const CURRENCY_FMT = '#,##0.00'
const PCT_FMT      = '0.00'

// ── Holdings export ───────────────────────────────────────────────────────────

export function exportHoldingsXlsx(holdings: Holding[], portfolioName: string, currency = 'USD') {
  const rows = holdings.map(h => {
    const gainLoss = h.current_value - h.cost_basis
    const gainLossPct = h.cost_basis > 0 ? (gainLoss / h.cost_basis) * 100 : 0
    const typeLabel = ASSET_TYPES.find(a => a.value === h.asset_type)?.label ?? h.asset_type
    return {
      Name: h.name,
      Symbol: h.symbol ?? '',
      'Asset Type': typeLabel,
      Quantity: h.quantity,
      [`Cost Basis (${currency})`]: h.cost_basis,
      [`Current Value (${currency})`]: h.current_value,
      [`Gain / Loss (${currency})`]: gainLoss,
      'Gain / Loss %': gainLossPct,
      'Purchase Date': h.purchase_date ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const n = rows.length

  // Currency format on cost basis, current value, gain/loss columns (4, 5, 6)
  applyFmt(ws, 4, n, CURRENCY_FMT)
  applyFmt(ws, 5, n, CURRENCY_FMT)
  applyFmt(ws, 6, n, CURRENCY_FMT)
  // Percentage column (7)
  applyFmt(ws, 7, n, PCT_FMT)

  ws['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Holdings')
  download(wb, `${portfolioName.replace(/\s+/g, '_')}_holdings_${slugDate()}.xlsx`)
}

// ── Scenario export ───────────────────────────────────────────────────────────

export function exportScenarioXlsx(
  scenarioName: string,
  startYear: number,
  currency: string,
  deterministicResult: SimulationResult | null,
  monteCarloResult: MonteCarloResult | null,
  historicalResult: HistoricalSimResult | null,
) {
  const wb = XLSX.utils.book_new()
  const slug = scenarioName.replace(/\s+/g, '_')

  // ── Sheet 1: Deterministic ────────────────────────────────────────────────
  if (deterministicResult) {
    const rows = deterministicResult.years.map(y => ({
      'Calendar Year': startYear + (y.year - 1),
      'Sim Year': y.year,
      'Growth Rate %': y.annualReturnPct,
      'Inflation Rate %': y.inflationPct,
      [`Start Value (${currency})`]: y.startValue,
      [`Contribution (${currency})`]: y.contribution,
      [`Recurring (${currency})`]: y.futureContribAmount,
      [`One-off Contrib (${currency})`]: y.eventContribution,
      [`Growth (${currency})`]: y.growth,
      [`Withdrawal (${currency})`]: y.withdrawal,
      [`One-off Withdrawal (${currency})`]: y.eventWithdrawal,
      [`Shock Loss (${currency})`]: y.shockAmount,
      [`End Value (${currency})`]: y.endValue,
      [`Inflation-Adj Value (${currency})`]: y.inflationAdjustedValue,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const n = rows.length

    // Rate columns (2, 3) — plain 2dp; currency columns (4–13)
    applyFmt(ws, 2, n, PCT_FMT)
    applyFmt(ws, 3, n, PCT_FMT)
    for (let c = 4; c <= 13; c++) applyFmt(ws, c, n, CURRENCY_FMT)

    ws['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 13 }, { wch: 14 },
      ...Array(10).fill({ wch: 22 }),
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Deterministic')
  }

  // ── Sheet 2: Monte Carlo ──────────────────────────────────────────────────
  if (monteCarloResult) {
    const yearRows = monteCarloResult.years.map(y => ({
      'Calendar Year': startYear + (y.year - 1),
      'Sim Year': y.year,
      [`P10 Pessimistic (${currency})`]: y.p10,
      [`P25 (${currency})`]: y.p25,
      [`Median P50 (${currency})`]: y.median,
      [`P75 (${currency})`]: y.p75,
      [`P90 Optimistic (${currency})`]: y.p90,
    }))

    const ws = XLSX.utils.json_to_sheet(yearRows)
    const n = yearRows.length
    for (let c = 2; c <= 6; c++) applyFmt(ws, c, n, CURRENCY_FMT)

    appendPercentileSummary(
      ws,
      { p10: monteCarloResult.finalP10, p25: monteCarloResult.finalP25, median: monteCarloResult.finalMedian, p75: monteCarloResult.finalP75, p90: monteCarloResult.finalP90 },
      { p10: monteCarloResult.finalRealP10, p25: monteCarloResult.finalRealP25, median: monteCarloResult.finalRealMedian, p75: monteCarloResult.finalRealP75, p90: monteCarloResult.finalRealP90 },
      currency, n + 3,
    )

    ws['!cols'] = Array(7).fill({ wch: 24 })
    XLSX.utils.book_append_sheet(wb, ws, 'Monte Carlo')
  }

  // ── Sheet 3: Historical ───────────────────────────────────────────────────
  if (historicalResult) {
    const yearRows = historicalResult.years.map(y => ({
      'Calendar Year': startYear + (y.year - 1),
      'Sim Year': y.year,
      [`P10 Pessimistic (${currency})`]: y.p10,
      [`P25 (${currency})`]: y.p25,
      [`Median P50 (${currency})`]: y.median,
      [`P75 (${currency})`]: y.p75,
      [`P90 Optimistic (${currency})`]: y.p90,
    }))

    const ws = XLSX.utils.json_to_sheet(yearRows)
    const n = yearRows.length
    for (let c = 2; c <= 6; c++) applyFmt(ws, c, n, CURRENCY_FMT)

    appendPercentileSummary(
      ws,
      { p10: historicalResult.finalP10, p25: historicalResult.finalP25, median: historicalResult.finalMedian, p75: historicalResult.finalP75, p90: historicalResult.finalP90 },
      { p10: historicalResult.finalRealP10, p25: historicalResult.finalRealP25, median: historicalResult.finalRealMedian, p75: historicalResult.finalRealP75, p90: historicalResult.finalRealP90 },
      currency, n + 3,
      [
        [],
        ['Historical Windows'],
        ['Windows tested', historicalResult.windowCount],
        ['Best starting year', historicalResult.bestStartYear],
        ['Worst starting year', historicalResult.worstStartYear],
      ],
    )

    ws['!cols'] = Array(7).fill({ wch: 24 })
    XLSX.utils.book_append_sheet(wb, ws, 'Historical')
  }

  if (wb.SheetNames.length === 0) return
  download(wb, `${slug}_projection_${slugDate()}.xlsx`)
}
