import type { AssetTypeValue } from '@/lib/constants'

// Per-asset-type metadata shapes stored in holdings.metadata (JSONB)
export interface StockMetadata {
  exchange?: string
  sector?: string
  dividend_yield?: number
}

export interface MutualFundMetadata {
  fund_house?: string
  category?: string
}

export interface CashMetadata {
  institution?: string
  account_type?: string
  interest_rate?: number
}

export interface RealEstateMetadata {
  address?: string
  property_type?: string
  mortgage_balance?: number
  heloc_balance?: number
  rental_income?: number
}

export interface RetirementAccountMetadata {
  account_type?: string
  institution?: string
  employer_match_pct?: number
}

export interface EducationPlanMetadata {
  plan_type?: string
  beneficiary_name?: string
  state?: string
}

export interface BondMetadata {
  face_value?: number
  coupon_rate?: number
  maturity_date?: string
  issuer?: string
}

export type HoldingMetadata =
  | StockMetadata
  | MutualFundMetadata
  | CashMetadata
  | RealEstateMetadata
  | RetirementAccountMetadata
  | EducationPlanMetadata
  | BondMetadata
  | Record<string, unknown>

export interface Holding {
  id: string
  portfolio_id: string
  asset_type: AssetTypeValue
  name: string
  symbol: string | null
  quantity: number
  cost_basis: number
  current_value: number
  purchase_date: string | null
  notes: string | null
  metadata: HoldingMetadata
  last_price_updated_at?: string | null
  created_at: string
  updated_at: string
}
