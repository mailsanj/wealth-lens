import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import type { HistoricalSimResult } from '@/types/scenario'

interface Props {
  result: HistoricalSimResult
  currency?: string
  xAxisMode?: 'simulation' | 'calendar'
  startYear?: number
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number | number[]; color: string }[]; label?: number
}) {
  if (!active || !label) return null
  const band = payload?.find(p => p.name === 'band')
  const median = payload?.find(p => p.name === 'Median')
  const bandVals = Array.isArray(band?.value) ? band.value : null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium text-muted-foreground">Year {label}</div>
      {median && (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Median:</span>
          <span className="font-medium">{formatCurrency(median.value as number)}</span>
        </div>
      )}
      {bandVals && (
        <>
          <div className="text-muted-foreground/80 text-xs">P90: {formatCurrency(bandVals[1])}</div>
          <div className="text-muted-foreground/80 text-xs">P10: {formatCurrency(bandVals[0])}</div>
        </>
      )}
    </div>
  )
}

export default function HistoricalSimChart({ result, currency = 'USD', xAxisMode = 'simulation', startYear = new Date().getFullYear() }: Props) {
  if (result.windowCount === 0) {
    return <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Not enough historical data for this time horizon.</div>
  }

  const data = result.years.map(y => ({
    year: y.year,
    bandBase: Math.round(y.p10),
    bandTop: Math.round(y.p90 - y.p10),
    Median: Math.round(y.median),
    band: [Math.round(y.p10), Math.round(y.p90)],
  }))

  const yMax = Math.max(...result.years.map(y => y.p90))
  const yMin = Math.max(0, Math.min(...result.years.map(y => y.p10)) * 0.9)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="histBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#64748b" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => xAxisMode === 'calendar' ? String(startYear + v - 1) : String(v)}
          label={{ value: xAxisMode === 'calendar' ? 'Year' : 'Simulation Year', position: 'insideBottomRight', offset: -4, fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={v => formatCurrency(v, currency, true)}
          tickLine={false}
          axisLine={false}
          domain={[yMin, yMax * 1.05]}
          width={76}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'bandBase' || v === 'bandTop' ? null : v} />
        <Area type="monotone" dataKey="bandBase" stroke="none" fill="transparent" stackId="band" legendType="none" tooltipType="none" name="band" />
        <Area type="monotone" dataKey="bandTop" stroke="none" fill="url(#histBandGrad)" stackId="band" legendType="square" name="P10–P90 Range (Historical)" />
        <Line type="monotone" dataKey="Median" stroke="#0f766e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
