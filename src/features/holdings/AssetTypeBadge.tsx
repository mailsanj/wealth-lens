import { Badge } from '@/components/ui/badge'
import { ASSET_TYPES, type AssetTypeValue } from '@/lib/constants'
import { cn } from '@/lib/utils'

const COLOR_MAP: Record<AssetTypeValue, string> = {
  stock:               'bg-blue-100 text-blue-800 border-blue-200',
  etf:                 'bg-sky-100 text-sky-800 border-sky-200',
  mutual_fund:         'bg-violet-100 text-violet-800 border-violet-200',
  cash:                'bg-emerald-100 text-emerald-800 border-emerald-200',
  real_estate:         'bg-orange-100 text-orange-800 border-orange-200',
  retirement_account:  'bg-amber-100 text-amber-800 border-amber-200',
  education_plan:      'bg-pink-100 text-pink-800 border-pink-200',
  bond:                'bg-slate-100 text-slate-800 border-slate-200',
  crypto:              'bg-teal-100 text-teal-800 border-teal-200',
  other:               'bg-gray-100 text-gray-800 border-gray-200',
}

export default function AssetTypeBadge({ type }: { type: AssetTypeValue }) {
  const label = ASSET_TYPES.find(a => a.value === type)?.label ?? type
  return (
    <Badge variant="outline" className={cn('font-normal', COLOR_MAP[type])}>
      {label}
    </Badge>
  )
}
