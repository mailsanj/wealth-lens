import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { usePortfolios, type PortfolioWithValue } from '@/hooks/usePortfolios'
import { useGrant } from '@/features/auth/GrantContext'
import PortfolioCard from '@/features/portfolios/PortfolioCard'
import PortfolioForm from '@/features/portfolios/PortfolioForm'
import type { Portfolio } from '@/types/portfolio'

function SortableCard({
  portfolio,
  onEdit,
  onDuplicate,
}: {
  portfolio: PortfolioWithValue
  onEdit: (p: PortfolioWithValue) => void
  onDuplicate: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: portfolio.id,
  })

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <PortfolioCard
        portfolio={portfolio}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  )
}

export default function Portfolios() {
  const { portfolios, loading, createPortfolio, updatePortfolio, reorderPortfolios, duplicatePortfolio } = usePortfolios()
  const { isViewer } = useGrant()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<PortfolioWithValue | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleEdit(portfolio: PortfolioWithValue) {
    setEditTarget(portfolio)
    setShowForm(true)
  }

  function handleClose() {
    setShowForm(false)
    setEditTarget(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = portfolios.findIndex(p => p.id === active.id)
    const newIndex = portfolios.findIndex(p => p.id === over.id)
    const reordered = arrayMove(portfolios, oldIndex, newIndex)
    reorderPortfolios(reordered.map(p => p.id))
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isViewer && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Portfolio
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : portfolios.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-16 text-center">
          <p className="text-muted-foreground">No portfolios yet.</p>
          {!isViewer && (
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create your first portfolio
            </Button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={portfolios.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 sm:grid-cols-2">
              {portfolios.map(p => (
                <SortableCard
                  key={p.id}
                  portfolio={p}
                  onEdit={handleEdit}
                  onDuplicate={duplicatePortfolio}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <PortfolioForm
        open={showForm}
        onClose={handleClose}
        portfolio={editTarget as Portfolio | undefined}
        onCreate={createPortfolio}
        onUpdate={updatePortfolio}
      />
    </div>
  )
}
