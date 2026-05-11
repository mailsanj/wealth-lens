import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import type { SimulationResult, YearRateOverride } from '@/types/scenario'
import type { OverlayPoint } from '@/hooks/useScenarioOverlay'

interface Props {
  result: SimulationResult
  currentNetWorth?: number
  currency?: string
  xAxisMode?: 'simulation' | 'calendar'
  startYear?: number
  overlayData?: OverlayPoint[]
  yearRateOverrides?: YearRateOverride[]
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium text-muted-foreground">Year {label}</div>
      {payload.filter(p => typeof p.value === 'number').map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ScenarioResultsChart({
  result, currentNetWorth, currency = 'USD',
  xAxisMode = 'simulation', startYear = new Date().getFullYear(),
  overlayData = [], yearRateOverrides = [],
}: Props) {
  // Merge projection data + overlay into a unified dataset keyed by year
  const overlayMap = new Map(overlayData.map(p => [p.year, p.value]))

  const data = result.years.map(y => ({
    year: y.year,
    Nominal: Math.round(y.endValue),
    'Inflation-Adjusted': Math.round(y.inflationAdjustedValue),
    ...(overlayMap.has(y.year) ? { Actual: Math.round(overlayMap.get(y.year)!) } : {}),
  }))

  const allValues = result.years.flatMap(y => [y.endValue, y.inflationAdjustedValue])
  if (overlayData.length > 0) allValues.push(...overlayData.map(p => p.value))
  const yMax = Math.max(...allValues)
  const yMin = Math.max(0, Math.min(...allValues) * 0.9)

  // Compute reference areas for year-rate override ranges
  type Band = { x1: number; x2: number }
  const overrideBands: Band[] = yearRateOverrides.map(o => ({
    x1: o.from_year,
    x2: o.to_year ?? o.from_year,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="nominalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Shade override year ranges in amber */}
        {overrideBands.map((band, i) => (
          <ReferenceArea key={i} x1={band.x1} x2={band.x2} fill="#d97706" fillOpacity={0.08} stroke="none" />
        ))}

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
        <Legend wrapperStyle={{ fontSize: 12 }} />

        {currentNetWorth !== undefined && currentNetWorth > 0 && (
          <ReferenceLine
            y={currentNetWorth}
            stroke="#10b981"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: 'Current', position: 'insideTopRight', fontSize: 10, fill: '#10b981' }}
          />
        )}

        <Area type="monotone" dataKey="Nominal" stroke="#0f766e" strokeWidth={2} fill="url(#nominalGrad)" dot={false} activeDot={{ r: 3 }} />
        <Area type="monotone" dataKey="Inflation-Adjusted" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#realGrad)" dot={false} activeDot={{ r: 3 }} />

        {/* Actual portfolio overlay — only rendered when data exists */}
        {overlayData.length > 0 && (
          <Line
            type="monotone"
            dataKey="Actual"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
