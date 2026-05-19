import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'

export interface AlertRule {
  id: string
  user_id: string
  alert_type: 'holding_stock' | 'holding_portfolio'
  symbol: string | null
  portfolio_id: string | null
  direction: 'up' | 'down' | 'either'
  amount_type: 'dollars' | 'percent'
  amount: number
  notify_email: boolean
  notify_sms: boolean
  email: string | null
  phone: string | null
  cooldown_value: number
  cooldown_unit: 'minutes' | 'hours' | 'days'
  is_active: boolean
  last_triggered_at: string | null
  label: string | null
  created_at: string
}

export type AlertRuleInput = Omit<AlertRule, 'id' | 'user_id' | 'created_at' | 'last_triggered_at'>

export function useAlerts() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setAlerts((data ?? []) as unknown as AlertRule[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function createAlert(input: AlertRuleInput) {
    const { data, error: err } = await supabase
      .from('alert_rules')
      .insert({ ...input, user_id: user!.id })
      .select()
      .single()
    if (err) throw new Error(err.message)
    await fetch()
    return data as unknown as AlertRule
  }

  async function updateAlert(id: string, input: AlertRuleInput) {
    const { error: err } = await supabase
      .from('alert_rules')
      .update(input)
      .eq('id', id)
    if (err) throw new Error(err.message)
    await fetch()
  }

  async function toggleAlert(id: string, is_active: boolean) {
    const { error: err } = await supabase
      .from('alert_rules')
      .update({ is_active })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active } : a))
  }

  async function duplicateAlert(id: string) {
    const source = alerts.find(a => a.id === id)
    if (!source) return
    const { id: _, created_at: __, last_triggered_at: ___, user_id: ____, ...rest } = source
    await createAlert({ ...rest, label: rest.label ? `Copy of ${rest.label}` : null, is_active: false })
  }

  async function deleteAlert(id: string) {
    const { error: err } = await supabase.from('alert_rules').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  return { alerts, loading, error, createAlert, updateAlert, toggleAlert, duplicateAlert, deleteAlert, refetch: fetch }
}
