import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ASSET_TYPES } from '@/lib/constants'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import type { AssetTypeValue } from '@/lib/constants'

const COLORS: Record<string, string> = {
  stock:              '#2563eb',  /* blue-600 */
  etf:                '#0284c7',  /* sky-600 */
  mutual_fund:        '#7c3aed',  /* violet-600 */
  cash:               '#059669',  /* emerald-600 */
  real_estate:        '#ea580c',  /* orange-600 */
  retirement_account: '#d97706',  /* amber-600  (brand accent) */
  education_plan:     '#db2777',  /* pink-600 */
  bond:               '#475569',  /* slate-600 */
  crypto:             '#4f46e5',  /* indigo-600 (moved from teal to avoid brand clash) */
  other:              '#6b7280',  /* gray-500 */
}

interface DataPoint {
  type: AssetTypeValue
  value: number
  pct: number
}

interface Props {
  data: DataPoint[]
  currency?: string
}

function CustomTooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: DataPoint }[]; currency: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const label = ASSET_TYPES.find(a => a.value === d.type)?.label ?? d.type
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">{formatCurrency(d.value, currency)} · {formatPercent(d.pct)}</div>
    </div>
  )
}

function CustomLegend({ payload }: { payload?: { value: string; color: string }[] }) {
  if (!payload) return null
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {payload.map(entry => (
        <li key={entry.value} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

export default function AllocationChart({ data, currency = 'USD' }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No holdings data yet.
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    name: ASSET_TYPES.find(a => a.value === d.type)?.label ?? d.type,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
        >
          {chartData.map(entry => (
            <Cell key={entry.type} fill={COLORS[entry.type] ?? COLORS.other} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip currency={currency} />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

