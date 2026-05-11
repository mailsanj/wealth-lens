export const ASSET_TYPES = [
  { value: 'stock',               label: 'Stock' },
  { value: 'etf',                 label: 'ETF' },
  { value: 'mutual_fund',         label: 'Mutual Fund' },
  { value: 'cash',                label: 'Cash' },
  { value: 'real_estate',         label: 'Real Estate' },
  { value: 'retirement_account',  label: 'Retirement Account' },
  { value: 'education_plan',      label: 'Education Plan' },
  { value: 'bond',                label: 'Bond' },
  { value: 'crypto',              label: 'Crypto' },
  { value: 'other',               label: 'Other' },
] as const

export type AssetTypeValue = typeof ASSET_TYPES[number]['value']

export const PORTFOLIO_TYPES = [
  { value: 'investment',  label: 'Investment' },
  { value: 'retirement',  label: 'Retirement' },
  { value: 'education',   label: 'Education' },
  { value: 'general',     label: 'General' },
] as const

export type PortfolioTypeValue = typeof PORTFOLIO_TYPES[number]['value']

export const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
] as const

export type CurrencyValue = typeof CURRENCIES[number]['value']

export const RETIREMENT_ACCOUNT_TYPES = ['401k', 'IRA', 'Roth IRA', 'Pension', 'Other'] as const
export const CASH_ACCOUNT_TYPES = ['Checking', 'Savings', 'Money Market', 'CD'] as const
export const EDUCATION_PLAN_TYPES = ['529', 'Coverdell ESA', 'Other'] as const
export const PROPERTY_TYPES = ['Primary Residence', 'Rental', 'Commercial', 'Land', 'Other'] as const

export const SCENARIO_EVENT_TYPES = [
  { value: 'withdrawal',   label: 'Withdrawal' },
  { value: 'contribution', label: 'One-time Contribution' },
  { value: 'shock',        label: 'Market Shock' },
  { value: 'rebalance',    label: 'Rebalance' },
] as const
