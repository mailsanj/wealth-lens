import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { useGrant } from '@/features/auth/GrantContext'

export interface Goal {
  id: string
  user_id: string
  name: string
  target_value: number
  target_date: string
  linked_scenario_id: string | null
  linked_portfolio_ids: string[]
  created_at: string
  updated_at: string
}

export type GoalInput = Pick<Goal, 'name' | 'target_value' | 'target_date' | 'linked_scenario_id' | 'linked_portfolio_ids'>

export function useGoals() {
  const { user } = useAuth()
  const { effectiveUserId } = useGrant()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('target_date', { ascending: true })
    setGoals((data ?? []) as unknown as Goal[])
    setLoading(false)
  }, [effectiveUserId])

  useEffect(() => { fetch() }, [fetch])

  async function createGoal(input: GoalInput) {
    const { data, error } = await supabase
      .from('goals')
      .insert({ ...input, user_id: user!.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    const g = data as unknown as Goal
    setGoals(prev => [...prev, g].sort((a, b) => a.target_date.localeCompare(b.target_date)))
    return g
  }

  async function updateGoal(id: string, input: GoalInput) {
    const { data, error } = await supabase
      .from('goals')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    const g = data as unknown as Goal
    setGoals(prev => prev.map(goal => goal.id === id ? g : goal))
    return g
  }

  async function duplicateGoal(id: string) {
    const source = goals.find(g => g.id === id)
    if (!source) return
    return createGoal({ name: `Copy of ${source.name}`, target_value: source.target_value, target_date: source.target_date, linked_scenario_id: source.linked_scenario_id, linked_portfolio_ids: source.linked_portfolio_ids })
  }

  async function deleteGoal(id: string) {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  return { goals, loading, createGoal, updateGoal, duplicateGoal, deleteGoal, refetch: fetch }
}
