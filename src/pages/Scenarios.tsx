import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Pencil, Trash2, Copy, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useScenarios } from '@/hooks/useScenarios'
import ScenarioForm from '@/features/scenarios/ScenarioForm'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useGrant } from '@/features/auth/GrantContext'
import type { Scenario } from '@/types/scenario'

export default function Scenarios() {
  const { scenarios, loading, createScenario, updateScenario, duplicateScenario, deleteScenario } = useScenarios()
  const { isViewer } = useGrant()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Scenario | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function handleEdit(e: React.MouseEvent, sc: Scenario) {
    e.preventDefault(); e.stopPropagation()
    setEditTarget(sc); setShowForm(true)
  }

  function handleDeleteClick(e: React.MouseEvent, sc: Scenario) {
    e.preventDefault(); e.stopPropagation()
    setDeleteTarget(sc)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try { await deleteScenario(deleteTarget.id) } finally {
      setDeleting(false); setDeleteTarget(null)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitCompare() {
    setCompareMode(false)
    setSelectedIds(new Set())
  }

  function goToCompare() {
    navigate(`/scenarios/compare?ids=${[...selectedIds].join(',')}`)
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scenarios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Model different investment outcomes and compare projections.
          </p>
        </div>
        <div className="flex gap-2">
          {compareMode ? (
            <>
              <Button variant="outline" onClick={exitCompare}>Cancel</Button>
              <Button onClick={goToCompare} disabled={selectedIds.size < 2}>
                <GitCompare className="mr-2 h-4 w-4" />
                Compare ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              {scenarios.length >= 2 && (
                <Button variant="outline" onClick={() => setCompareMode(true)}>
                  <GitCompare className="mr-2 h-4 w-4" /> Compare
                </Button>
              )}
              {!isViewer && (
                <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
                  <Plus className="mr-2 h-4 w-4" /> New Scenario
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {compareMode && (
        <p className="mb-4 text-sm text-muted-foreground">
          Select 2–5 scenarios to compare side by side.
        </p>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : scenarios.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center">
          <p className="text-muted-foreground">No scenarios yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to start projecting your portfolio's future.</p>
          <Button className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create your first scenario
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map(sc => {
            const isSelected = selectedIds.has(sc.id)
            const isDisabled = compareMode && !isSelected && selectedIds.size >= 5

            return (
              <div key={sc.id} className="relative">
                {compareMode && (
                  <button
                    className="absolute inset-0 z-10 w-full"
                    onClick={() => !isDisabled && toggleSelect(sc.id)}
                  />
                )}
                <Link to={compareMode ? '#' : `/scenarios/${sc.id}`}>
                  <Card className={cn(
                    'group cursor-pointer transition-colors',
                    compareMode && isSelected && 'border-primary ring-2 ring-primary/30',
                    compareMode && isDisabled && 'opacity-40',
                    !compareMode && 'hover:border-primary/50',
                  )}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {compareMode && (
                          <div className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                          )}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <CardTitle className="text-base font-medium">{sc.name}</CardTitle>
                          {sc.description && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">{sc.description}</p>
                          )}
                        </div>
                      </div>
                      {!compareMode && (
                        <div className="ml-4 flex shrink-0 items-center gap-1">
                          <span className="text-xs text-muted-foreground">{formatDate(sc.created_at)}</span>
                          {!isViewer && (
                            <>
                              <button onClick={e => handleEdit(e, sc)} className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={e => { e.preventDefault(); e.stopPropagation(); duplicateScenario(sc.id) }} className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100" title="Duplicate">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={e => handleDeleteClick(e, sc)} className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <ScenarioForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null) }}
        scenario={editTarget ?? undefined}
        onCreate={createScenario}
        onUpdate={updateScenario}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the scenario and all its configuration. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
