import { useState } from 'react'
import { useMutations } from 'deepspace'
import type { RecordData } from 'deepspace'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useToast } from '../ui/Toast'
import type { DecisionCriterion } from '../../types/decisions'

interface CriteriaEditorProps {
  roomId: string
  participantIds: string[]
  criteria: RecordData<DecisionCriterion>[]
}

export function CriteriaEditor({ roomId, participantIds, criteria }: CriteriaEditorProps) {
  const [name, setName] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { ready, createConfirmed, putConfirmed, removeConfirmed } =
    useMutations<DecisionCriterion>('decision-criteria')
  const { error } = useToast()

  async function addCriterion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    setBusyId('new')
    try {
      await createConfirmed({ roomId, name: cleanName, weight: 3, participantIds })
      setName('')
    } catch (cause) {
      error('Could not add criterion', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyId(null)
    }
  }

  async function changeWeight(criterion: RecordData<DecisionCriterion>, nextWeight: number) {
    const weight = Math.min(5, Math.max(1, nextWeight))
    if (weight === criterion.data.weight) return
    setBusyId(criterion.recordId)
    try {
      await putConfirmed(criterion.recordId, { weight })
    } catch (cause) {
      error('Could not update weight', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyId(null)
    }
  }

  async function deleteCriterion(criterion: RecordData<DecisionCriterion>) {
    setBusyId(criterion.recordId)
    try {
      await removeConfirmed(criterion.recordId)
    } catch (cause) {
      error('Could not delete criterion', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Criteria</h2>
          <p className="mt-1 text-sm text-muted-foreground">Weight what matters from 1 to 5.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {criteria.length} added
        </span>
      </div>

      <form onSubmit={addCriterion} className="mt-5 flex gap-2" data-testid="criterion-form">
        <Input
          aria-label="Criterion name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Cost, quality, speed…"
          maxLength={60}
          required
        />
        <Button type="submit" size="sm" disabled={!ready || !name.trim()} loading={busyId === 'new'}>
          <Plus aria-hidden /> Add
        </Button>
      </form>

      <div className="mt-5 grid gap-3">
        {criteria.map((criterion) => (
          <article key={criterion.recordId} className="flex items-center gap-3 rounded-xl border border-border bg-background/70 p-4">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-foreground">{criterion.data.name}</h3>
              <p className="text-xs text-muted-foreground">Weight {criterion.data.weight} of 5</p>
            </div>
            <div className="flex items-center rounded-lg border border-border bg-background">
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Decrease ${criterion.data.name} weight`}
                disabled={!ready || busyId !== null || criterion.data.weight <= 1}
                onClick={() => void changeWeight(criterion, criterion.data.weight - 1)}
              >
                <Minus aria-hidden />
              </Button>
              <output className="w-8 text-center text-sm font-semibold text-foreground" aria-label={`${criterion.data.name} weight`}>
                {criterion.data.weight}
              </output>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Increase ${criterion.data.name} weight`}
                disabled={!ready || busyId !== null || criterion.data.weight >= 5}
                onClick={() => void changeWeight(criterion, criterion.data.weight + 1)}
              >
                <Plus aria-hidden />
              </Button>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${criterion.data.name}`}
              disabled={!ready || busyId !== null}
              onClick={() => void deleteCriterion(criterion)}
            >
              <Trash2 aria-hidden />
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
