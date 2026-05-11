import type { PortfolioTypeValue } from '@/lib/constants'

export interface Portfolio {
  id: string
  user_id: string
  name: string
  description: string | null
  portfolio_type: PortfolioTypeValue
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PortfolioSnapshot {
  id: string
  portfolio_id: string
  snapshot_date: string
  total_value: number
  breakdown: Record<string, number>
  created_at: string
}

export interface PortfolioWithStats extends Portfolio {
  total_value: number
  total_cost_basis: number
  gain_loss: number
  gain_loss_pct: number
  holdings_count: number
}
