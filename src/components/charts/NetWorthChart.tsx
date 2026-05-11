import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { ChartPoint } from '@/hooks/useSnapshots'

interface Props {
  data: ChartPoint[]
  currency?: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="text-muted-foreground">{formatDate(label)}</div>
      <div className="mt-0.5 font-semibold">{formatCurrency(payload[0].value)}</div>
    </div>
  )
}

export default function NetWorthChart({ data, currency = 'USD' }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
        <p>Not enough data to show a chart yet.</p>
        <p>Take a snapshot today, then check back after your next update.</p>
      </div>
    )
  }

  const formatted = data.map(d => ({ ...d, displayDate: d.date }))
  const min = Math.min(...data.map(d => d.value))
  const yMin = Math.max(0, min * 0.95)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 11 }}
          tickFormatter={v => {
            const d = new Date(v)
            return `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
          }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={v => formatCurrency(v, currency, true)}
          tickLine={false}
          axisLine={false}
          domain={[yMin, 'auto']}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#0f766e"
          strokeWidth={2}
          fill="url(#netWorthGradient)"
          dot={data.length <= 12}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
