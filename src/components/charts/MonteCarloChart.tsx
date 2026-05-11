import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import type { MonteCarloResult } from '@/types/scenario'

interface Props {
  result: MonteCarloResult
  currentNetWorth?: number
  currency?: string
  xAxisMode?: 'simulation' | 'calendar'
  startYear?: number
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number | number[]; color: string }[]
  label?: number
}) {
  if (!active || !label) return null
  const band = payload?.find(p => p.name === 'band')
  const median = payload?.find(p => p.name === 'Median')
  if (!band && !median) return null

  const bandVals = Array.isArray(band?.value) ? band.value : null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium text-muted-foreground">Year {label}</div>
      {median && (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#0f766e' }} />
          <span className="text-muted-foreground">Median:</span>
          <span className="font-medium tabular-nums">{formatCurrency(median.value as number)}</span>
        </div>
      )}
      {bandVals && (
        <>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground/80">
            <span className="w-2" />
            <span>P90:</span>
            <span className="tabular-nums">{formatCurrency(bandVals[1])}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground/80">
            <span className="w-2" />
            <span>P10:</span>
            <span className="tabular-nums">{formatCurrency(bandVals[0])}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function MonteCarloChart({ result, currency = 'USD', xAxisMode = 'simulation', startYear = new Date().getFullYear() }: Props) {
  // Stacked area trick: transparent base (p10) + teal band (p90 - p10)
  const data = result.years.map(y => ({
    year: y.year,
    bandBase: Math.round(y.p10),
    bandTop: Math.round(y.p90 - y.p10),
    Median: Math.round(y.median),
    // For tooltip only
    band: [Math.round(y.p10), Math.round(y.p90)],
  }))

  const yMax = Math.max(...result.years.map(y => y.p90))
  const yMin = Math.max(0, Math.min(...result.years.map(y => y.p10)) * 0.9)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="mcBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#0f766e" stopOpacity={0.06} />
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
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => value === 'bandBase' || value === 'bandTop' ? null : value}
        />
        {/* Transparent base up to P10 */}
        <Area
          type="monotone"
          dataKey="bandBase"
          stroke="none"
          fill="transparent"
          stackId="band"
          legendType="none"
          tooltipType="none"
          name="band"
        />
        {/* Teal band from P10 to P90 */}
        <Area
          type="monotone"
          dataKey="bandTop"
          stroke="none"
          fill="url(#mcBandGrad)"
          stackId="band"
          legendType="square"
          name="P10–P90 Range"
        />
        {/* Median line */}
        <Line
          type="monotone"
          dataKey="Median"
          stroke="#0f766e"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
