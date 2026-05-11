export const GRANTABLE_PAGES = [
  { id: 'dashboard',  label: 'Dashboard',  path: '/' },
  { id: 'portfolios', label: 'Portfolios', path: '/portfolios' },
  { id: 'scenarios',  label: 'Scenarios',  path: '/scenarios' },
  { id: 'goals',      label: 'Goals',      path: '/goals' },
] as const

export type GrantablePage = typeof GRANTABLE_PAGES[number]['id']

export interface AccessGrant {
  id: string
  owner_id: string
  grantee_email: string
  grantee_id: string | null
  pages: GrantablePage[]
  label: string | null
  created_at: string
}
