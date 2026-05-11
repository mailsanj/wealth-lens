import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import type { SimulationResult } from '@/types/scenario'

// Up to 5 scenarios — colors chosen for distinctness against the teal brand
const COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#db2777']

interface Props {
  results: SimulationResult[]
  currentNetWorth?: number
  currency?: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: number
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="mb-1.5 font-medium text-muted-foreground">Year {label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="truncate max-w-[140px] text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ScenarioCompareChart({ results, currency = 'USD' }: Props) {
  if (results.length === 0) return null

  const horizon = Math.max(...results.map(r => r.years.length))

  const data = Array.from({ length: horizon }, (_, i) => {
    const year = i + 1
    const point: Record<string, number> = { year }
    results.forEach(r => {
      const y = r.years.find(yr => yr.year === year)
      point[r.scenarioName] = y ? Math.round(y.endValue) : 0
    })
    return point
  })

  const allValues = results.flatMap(r => r.years.map(y => y.endValue))
  const yMax = Math.max(...allValues)
  const yMin = Math.max(0, Math.min(...allValues) * 0.9)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={{ value: 'Year', position: 'insideBottomRight', offset: -4, fontSize: 11 }}
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
        {results.map((r, i) => (
          <Line
            key={r.scenarioId}
            type="monotone"
            dataKey={r.scenarioName}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
