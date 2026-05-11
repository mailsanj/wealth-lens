// Auto-generated types will go here after: npx supabase gen types typescript
// For now this is a placeholder that satisfies the supabase client import.
// Run `npx supabase gen types typescript --project-id <your-id> > src/types/database.ts`
// after linking your Supabase project.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          currency: string
          date_format: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      portfolios: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          portfolio_type: string
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['portfolios']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['portfolios']['Insert']>
      }
      holdings: {
        Row: {
          id: string
          portfolio_id: string
          asset_type: string
          name: string
          symbol: string | null
          quantity: number
          cost_basis: number
          current_value: number
          purchase_date: string | null
          notes: string | null
          metadata: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['holdings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['holdings']['Insert']>
      }
      portfolio_snapshots: {
        Row: {
          id: string
          portfolio_id: string
          snapshot_date: string
          total_value: number
          breakdown: Record<string, number>
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['portfolio_snapshots']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['portfolio_snapshots']['Insert']>
      }
      scenarios: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['scenarios']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['scenarios']['Insert']>
      }
      scenario_configs: {
        Row: {
          id: string
          scenario_id: string
          portfolio_id: string | null
          initial_value: number
          annual_contribution: number
          contribution_growth_pct: number
          annual_return_pct: number
          inflation_pct: number
          time_horizon_years: number
          withdrawal_start_year: number | null
          annual_withdrawal: number
        }
        Insert: Omit<Database['public']['Tables']['scenario_configs']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['scenario_configs']['Insert']>
      }
      scenario_events: {
        Row: {
          id: string
          scenario_id: string
          event_year: number
          event_type: string
          amount: number
          description: string | null
        }
        Insert: Omit<Database['public']['Tables']['scenario_events']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['scenario_events']['Insert']>
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_value: number
          target_date: string
          linked_scenario_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['goals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['goals']['Insert']>
      }
    }
  }
}
