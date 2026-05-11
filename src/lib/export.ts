import type { Holding } from '@/types/holding'
import type { SimulationResult } from '@/types/scenario'
import { ASSET_TYPES } from '@/lib/constants'

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvCell(c: string | number | null | undefined): string {
  const s = c === null || c === undefined ? '' : String(c)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',')
}

/** Format a number with thousands separators and 2 decimal places (no $ prefix) */
function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slugDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Holdings export ───────────────────────────────────────────────────────────

export function exportHoldingsCsv(holdings: Holding[], portfolioName: string) {
  const header = row([
    'Name', 'Symbol', 'Asset Type', 'Quantity',
    'Cost Basis', 'Current Value', 'Gain/Loss', 'Gain/Loss %',
    'Purchase Date',
  ])

  const rows = holdings.map(h => {
    const gainLoss = h.current_value - h.cost_basis
    const gainLossPct = h.cost_basis > 0 ? (gainLoss / h.cost_basis) * 100 : 0
    const typeLabel = ASSET_TYPES.find(a => a.value === h.asset_type)?.label ?? h.asset_type
    return row([
      h.name,
      h.symbol ?? '',
      typeLabel,
      fmtNum(h.quantity),
      fmtNum(h.cost_basis),
      fmtNum(h.current_value),
      fmtNum(gainLoss),
      gainLossPct.toFixed(2) + '%',
      h.purchase_date ?? '',
    ])
  })

  const csv = [header, ...rows].join('\n')
  download(`${portfolioName.replace(/\s+/g, '_')}_holdings_${slugDate()}.csv`, csv)
}

// ── Scenario export ───────────────────────────────────────────────────────────

export function exportScenarioCsv(
  result: SimulationResult,
  scenarioName: string,
  startYear: number,
) {
  const header = row([
    'Calendar Year',
    'Simulation Year',
    'Growth Rate (%)',
    'Inflation Rate (%)',
    'Start Value',
    'Regular Contribution',
    'Recurring Contributions',
    'One-off Contributions',
    'Growth',
    'One-off Withdrawals',
    'Shock Losses',
    'Regular Withdrawal',
    'End Value',
    'Inflation-Adjusted Value',
  ])

  const dataRows = result.years.map(y => row([
    startYear + (y.year - 1),
    y.year,
    y.annualReturnPct.toFixed(2) + '%',
    y.inflationPct.toFixed(2) + '%',
    fmtNum(y.startValue),
    fmtNum(y.contribution),
    fmtNum(y.futureContribAmount),
    fmtNum(y.eventContribution),
    fmtNum(y.growth),
    fmtNum(y.eventWithdrawal),
    fmtNum(y.shockAmount),
    fmtNum(y.withdrawal),
    fmtNum(y.endValue),
    fmtNum(y.inflationAdjustedValue),
  ]))

  const csv = [header, ...dataRows].join('\n')
  download(`${scenarioName.replace(/\s+/g, '_')}_projection_${slugDate()}.csv`, csv)
}
