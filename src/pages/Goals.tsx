import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGrant } from '@/features/auth/GrantContext'
import { useGoals, type Goal } from '@/hooks/useGoals'
import { useScenarios } from '@/hooks/useScenarios'
import { useScenarioDetail } from '@/hooks/useScenarios'
import { useNetWorth } from '@/hooks/useNetWorth'
import { useProfile } from '@/hooks/useProfile'
import { runSimulation } from '@/lib/simulation'
import GoalCard from '@/features/goals/GoalCard'
import GoalForm from '@/features/goals/GoalForm'
import type { SimulationResult } from '@/types/scenario'

function useLinkedSimulation(scenarioId: string | null): SimulationResult | null {
  const { config, events, futureContributions, scenario } = useScenarioDetail(scenarioId ?? '')
  return useMemo(() => {
    if (!scenarioId || !config || !scenario) return null
    return runSimulation({ config, events, futureContributions, scenarioId: scenario.id, scenarioName: scenario.name })
  }, [scenarioId, config, events, futureContributions, scenario])
}

function GoalCardWrapper({ goal, allPortfolios, totalNetWorth, currency, onEdit, onDuplicate, onDelete }: {
  goal: Goal
  allPortfolios: { id: string; name: string; total_value: number }[]
  totalNetWorth: number
  currency: string
  onEdit: (g: Goal) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => Promise<void>
}) {
  const simResult = useLinkedSimulation(goal.linked_scenario_id)
  return (
    <GoalCard
      goal={goal}
      allPortfolios={allPortfolios}
      totalNetWorth={totalNetWorth}
      simulationResult={simResult ?? undefined}
      currency={currency}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
  )
}

export default function Goals() {
  const { goals, loading, createGoal, updateGoal, duplicateGoal, deleteGoal } = useGoals()
  const { isViewer } = useGrant()
  const { scenarios } = useScenarios()
  const { portfolioStats, totalValue } = useNetWorth()
  const { profile } = useProfile()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Goal | null>(null)

  const currency = profile?.currency ?? 'USD'

  const portfolioList = portfolioStats.map(p => ({ id: p.id, name: p.name, total_value: p.total_value }))

  function handleEdit(goal: Goal) {
    setEditTarget(goal)
    setShowForm(true)
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Goals</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Track your financial milestones and see if you're on track.</p>
        </div>
        {!isViewer && (
          <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" /> New Goal
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center">
          <p className="text-muted-foreground">No goals yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Set a target and track your progress toward it.</p>
          {!isViewer && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create your first goal
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map(goal => (
            <GoalCardWrapper
              key={goal.id}
              goal={goal}
              allPortfolios={portfolioList}
              totalNetWorth={totalValue}
              currency={currency}
              onEdit={handleEdit}
              onDuplicate={duplicateGoal}
              onDelete={deleteGoal}
            />
          ))}
        </div>
      )}

      <GoalForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null) }}
        goal={editTarget ?? undefined}
        scenarios={scenarios}
        portfolios={portfolioList}
        onCreate={createGoal}
        onUpdate={updateGoal}
      />
    </div>
  )
}
