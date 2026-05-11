import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { NumericInput } from '@/components/forms/NumericInput'
import { SelectField } from '@/components/forms/SelectField'
import {
  ASSET_TYPES, CASH_ACCOUNT_TYPES, RETIREMENT_ACCOUNT_TYPES,
  EDUCATION_PLAN_TYPES, PROPERTY_TYPES, type AssetTypeValue,
} from '@/lib/constants'
import type { Holding } from '@/types/holding'

interface Props {
  open: boolean
  onClose: () => void
  portfolioId: string
  currency?: string
  holding?: Holding
  onSave: (data: Omit<Holding, 'id' | 'created_at' | 'updated_at'>) => Promise<unknown>
}

const SYMBOL_REQUIRED: AssetTypeValue[] = ['stock', 'etf', 'mutual_fund', 'crypto']
const SYMBOL_OPTIONAL: AssetTypeValue[] = ['bond']
const SHOW_SYMBOL: AssetTypeValue[] = [...SYMBOL_REQUIRED, ...SYMBOL_OPTIONAL]
const HIDE_QUANTITY: AssetTypeValue[] = ['cash', 'real_estate', 'retirement_account', 'education_plan']

const BLANK: Omit<Holding, 'id' | 'created_at' | 'updated_at'> = {
  portfolio_id: '',
  asset_type: 'stock',
  name: '',
  symbol: null,
  quantity: 1,
  cost_basis: 0,
  current_value: 0,
  purchase_date: null,
  notes: null,
  metadata: {},
}

// Convert plain string arrays to {value, label} for SelectField
function toOptions(items: readonly string[]) {
  return items.map(s => ({ value: s, label: s }))
}

export default function HoldingForm({ open, onClose, portfolioId, currency = 'USD', holding, onSave }: Props) {
  const [form, setForm] = useState({ ...BLANK, portfolio_id: portfolioId })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (holding) {
      setForm({ ...holding })
    } else {
      setForm({ ...BLANK, portfolio_id: portfolioId })
    }
    setError(null)
  }, [holding, portfolioId, open])

  function setField<K extends keyof typeof BLANK>(key: K, value: typeof BLANK[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setMeta(key: string, value: unknown) {
    setForm(prev => ({ ...prev, metadata: { ...prev.metadata, [key]: value } }))
  }

  function handleAssetTypeChange(type: AssetTypeValue) {
    setForm(prev => ({
      ...prev,
      asset_type: type,
      symbol: null,
      quantity: HIDE_QUANTITY.includes(type) ? 1 : prev.quantity,
      metadata: {},
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (SYMBOL_REQUIRED.includes(form.asset_type) && !form.symbol?.trim()) {
      setError('Symbol is required for this asset type.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const meta = form.metadata as Record<string, unknown>

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{holding ? 'Edit Holding' : 'Add Holding'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Asset type */}
          <div className="space-y-1.5">
            <Label>Asset Type</Label>
            <SelectField
              value={form.asset_type}
              onChange={v => handleAssetTypeChange(v as AssetTypeValue)}
              options={[...ASSET_TYPES]}
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="h-name">Name</Label>
            <Input
              id="h-name"
              required
              placeholder={namePlaceholder(form.asset_type)}
              value={form.name}
              onChange={e => setField('name', e.target.value)}
            />
          </div>

          {/* Symbol — required for stock/etf/mutual_fund/crypto, optional for bond */}
          {SHOW_SYMBOL.includes(form.asset_type) && (
            <div className="space-y-1.5">
              <Label htmlFor="h-symbol">
                Symbol{' '}
                {SYMBOL_OPTIONAL.includes(form.asset_type)
                  ? <span className="text-muted-foreground">(optional — for bond ETFs/funds)</span>
                  : <span className="text-destructive">*</span>
                }
              </Label>
              <Input
                id="h-symbol"
                placeholder={form.asset_type === 'crypto' ? 'e.g. BTC, ETH, SOL' : 'e.g. AAPL, SPY, VFIAX'}
                value={form.symbol ?? ''}
                onChange={e => setField('symbol', e.target.value.toUpperCase() || null)}
              />
              {form.asset_type === 'crypto' && (
                <p className="text-xs text-muted-foreground">Enter ticker only — e.g. BTC not BTC/USD</p>
              )}
            </div>
          )}

          {/* Value fields */}
          <div className="grid grid-cols-2 gap-4">
            {!HIDE_QUANTITY.includes(form.asset_type) && (
              <div className="space-y-1.5">
                <Label htmlFor="h-qty">{quantityLabel(form.asset_type)}</Label>
                <NumericInput
                  id="h-qty"
                  value={form.quantity}
                  onChange={v => setField('quantity', v)}
                  placeholder="0"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="h-cost">Cost Basis ({currency})</Label>
              <NumericInput
                id="h-cost"
                value={form.cost_basis}
                onChange={v => setField('cost_basis', v)}
                currency
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-value">Current Value ({currency})</Label>
              <NumericInput
                id="h-value"
                value={form.current_value}
                onChange={v => setField('current_value', v)}
                currency
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="h-date">
              Purchase Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="h-date"
              type="date"
              value={form.purchase_date ?? ''}
              onChange={e => setField('purchase_date', e.target.value || null)}
            />
          </div>

          {/* Asset-type specific metadata */}
          <MetadataFields assetType={form.asset_type} meta={meta} onChange={setMeta} />

          <div className="space-y-1.5">
            <Label htmlFor="h-notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="h-notes"
              rows={2}
              placeholder="Any additional notes"
              value={form.notes ?? ''}
              onChange={e => setField('notes', e.target.value || null)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : holding ? 'Save Changes' : 'Add Holding'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Metadata section ──────────────────────────────────────────────────────────

interface MetaProps {
  assetType: AssetTypeValue
  meta: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

function MetadataFields({ assetType, meta, onChange }: MetaProps) {
  const str = (key: string) => (meta[key] as string | undefined) ?? ''
  const num = (key: string) => (meta[key] as number | undefined) ?? ''

  const fields: React.ReactNode = (() => {
    switch (assetType) {
      case 'stock':
      case 'etf':
        return (
          <div className="grid grid-cols-2 gap-4">
            <MF label="Exchange" value={str('exchange')} onChange={v => onChange('exchange', v)} placeholder="e.g. NASDAQ" />
            <MF label="Sector" value={str('sector')} onChange={v => onChange('sector', v)} placeholder="e.g. Technology" />
          </div>
        )
      case 'mutual_fund':
        return (
          <div className="grid grid-cols-2 gap-4">
            <MF label="Fund House" value={str('fund_house')} onChange={v => onChange('fund_house', v)} />
            <MF label="Category" value={str('category')} onChange={v => onChange('category', v)} />
          </div>
        )
      case 'cash':
        return (
          <>
            <MF label="Institution" value={str('institution')} onChange={v => onChange('institution', v)} placeholder="e.g. Chase" />
            <div className="grid grid-cols-2 gap-4">
              <SF label="Account Type" value={str('account_type')} options={CASH_ACCOUNT_TYPES} onChange={v => onChange('account_type', v)} />
              <MF label="Interest Rate (%)" type="number" value={String(num('interest_rate'))} onChange={v => onChange('interest_rate', parseFloat(v) || 0)} placeholder="e.g. 4.5" />
            </div>
          </>
        )
      case 'real_estate':
        return (
          <>
            <MF label="Address" value={str('address')} onChange={v => onChange('address', v)} />
            <SF label="Property Type" value={str('property_type')} options={PROPERTY_TYPES} onChange={v => onChange('property_type', v)} />
            <div className="grid grid-cols-2 gap-4">
              <MF label="Mortgage Balance ($)" type="number" value={String(num('mortgage_balance'))} onChange={v => onChange('mortgage_balance', parseFloat(v) || 0)} />
              <MF label="HELOC Balance ($)" type="number" value={String(num('heloc_balance'))} onChange={v => onChange('heloc_balance', parseFloat(v) || 0)} />
            </div>
            <MF label="Monthly Rental Income ($)" type="number" value={String(num('rental_income'))} onChange={v => onChange('rental_income', parseFloat(v) || 0)} />
          </>
        )
      case 'retirement_account':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <SF label="Account Type" value={str('account_type')} options={RETIREMENT_ACCOUNT_TYPES} onChange={v => onChange('account_type', v)} />
              <MF label="Institution" value={str('institution')} onChange={v => onChange('institution', v)} />
            </div>
            <MF label="Employer Match (%)" type="number" value={String(num('employer_match_pct'))} onChange={v => onChange('employer_match_pct', parseFloat(v) || 0)} placeholder="e.g. 50" />
          </>
        )
      case 'education_plan':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <SF label="Plan Type" value={str('plan_type')} options={EDUCATION_PLAN_TYPES} onChange={v => onChange('plan_type', v)} />
              <MF label="State" value={str('state')} onChange={v => onChange('state', v)} placeholder="e.g. California" />
            </div>
            <MF label="Beneficiary Name" value={str('beneficiary_name')} onChange={v => onChange('beneficiary_name', v)} />
          </>
        )
      case 'bond':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <MF label="Issuer" value={str('issuer')} onChange={v => onChange('issuer', v)} />
              <MF label="Coupon Rate (%)" type="number" value={String(num('coupon_rate'))} onChange={v => onChange('coupon_rate', parseFloat(v) || 0)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MF label="Face Value ($)" type="number" value={String(num('face_value'))} onChange={v => onChange('face_value', parseFloat(v) || 0)} />
              <MF label="Maturity Date" type="date" value={str('maturity_date')} onChange={v => onChange('maturity_date', v)} />
            </div>
          </>
        )
      default:
        return null
    }
  })()

  if (!fields) return null

  return (
    <>
      <Separator />
      <div className="space-y-4">{fields}</div>
    </>
  )
}

// ── Small field sub-components ────────────────────────────────────────────────

function MF({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SF({ label, value, options, onChange }: {
  label: string; value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <SelectField value={value} onChange={onChange} options={toOptions(options)} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function namePlaceholder(type: AssetTypeValue): string {
  const MAP: Partial<Record<AssetTypeValue, string>> = {
    stock: 'e.g. Apple Inc.',
    etf: 'e.g. Vanguard S&P 500 ETF',
    mutual_fund: 'e.g. Fidelity 500 Index Fund',
    cash: 'e.g. Chase Savings',
    real_estate: 'e.g. 123 Main St',
    retirement_account: 'e.g. Fidelity 401(k)',
    education_plan: 'e.g. Vanguard 529',
    bond: 'e.g. US Treasury 10-Year',
    crypto: 'e.g. Bitcoin',
  }
  return MAP[type] ?? 'Name'
}

function quantityLabel(type: AssetTypeValue): string {
  if (['stock', 'etf', 'mutual_fund'].includes(type)) return 'Shares / Units'
  if (type === 'crypto') return 'Coins / Tokens'
  if (type === 'bond') return 'Units'
  return 'Quantity'
}
