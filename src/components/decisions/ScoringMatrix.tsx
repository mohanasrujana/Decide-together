import { useMemo, useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import type { RecordData } from 'deepspace'
import { BarChart3, CheckCircle2 } from 'lucide-react'
import { calculateWeightedRankings } from '../../lib/ranking'
import type { DecisionCriterion, DecisionOption, DecisionScore } from '../../types/decisions'
import { useToast } from '../ui/Toast'

interface ScoringMatrixProps {
  roomId: string
  userId: string
  options: RecordData<DecisionOption>[]
  criteria: RecordData<DecisionCriterion>[]
}

export function ScoringMatrix({ roomId, userId, options, criteria }: ScoringMatrixProps) {
  const { records: scores, status } = useQuery<DecisionScore>('decision-scores', {
    where: { roomId, userId },
  })
  const { ready, createConfirmed, putConfirmed } = useMutations<DecisionScore>('decision-scores')
  const [pendingCell, setPendingCell] = useState<string | null>(null)
  const { error } = useToast()

  const scoresByCell = useMemo(
    () => new Map(scores.map((score) => [`${score.data.optionId}:${score.data.criterionId}`, score])),
    [scores],
  )
  const rankings = useMemo(
    () => calculateWeightedRankings(options, criteria, scores),
    [options, criteria, scores],
  )
  const expectedScores = options.length * criteria.length
  const completedScores = useMemo(() => {
    const optionIds = new Set(options.map((option) => option.recordId))
    const criterionIds = new Set(criteria.map((criterion) => criterion.recordId))
    return scores.filter(
      (score) =>
        optionIds.has(score.data.optionId) && criterionIds.has(score.data.criterionId),
    ).length
  }, [criteria, options, scores])

  async function setScore(optionId: string, criterionId: string, value: number) {
    const cellId = `${optionId}:${criterionId}`
    const existing = scoresByCell.get(cellId)
    setPendingCell(cellId)
    try {
      if (existing) {
        await putConfirmed(existing.recordId, { value })
      } else {
        await createConfirmed({ roomId, optionId, criterionId, userId, value })
      }
    } catch (cause) {
      error('Could not save score', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPendingCell(null)
    }
  }

  if (options.length < 2 || criteria.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">Score independently</h2>
        <p className="mt-3 text-sm text-muted-foreground">Add at least two options and one criterion to unlock the scoring matrix.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Score independently</h2>
          <p className="mt-1 text-sm text-muted-foreground">Rate every option from 1 (weak) to 5 (strong).</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {completedScores}/{expectedScores} scored
        </span>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium text-foreground">Option</th>
              {criteria.map((criterion) => (
                <th key={criterion.recordId} scope="col" className="px-4 py-3 text-center font-medium text-foreground">
                  {criterion.data.name}
                  <span className="block text-xs font-normal text-muted-foreground">weight {criterion.data.weight}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {options.map((option) => (
              <tr key={option.recordId}>
                <th scope="row" className="px-4 py-4 text-left font-medium text-foreground">{option.data.title}</th>
                {criteria.map((criterion) => {
                  const cellId = `${option.recordId}:${criterion.recordId}`
                  const score = scoresByCell.get(cellId)
                  return (
                    <td key={criterion.recordId} className="px-4 py-3 text-center">
                      <select
                        aria-label={`${option.data.title} score for ${criterion.data.name}`}
                        value={score?.data.value ?? ''}
                        disabled={!ready || status !== 'ready' || pendingCell === cellId}
                        onChange={(event) => void setScore(option.recordId, criterion.recordId, Number(event.target.value))}
                        className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="" disabled>Score</option>
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8" data-testid="weighted-ranking">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 aria-hidden /></span>
          <div>
            <h3 className="font-semibold text-foreground">Weighted ranking</h3>
            <p className="text-sm text-muted-foreground">Score × weight, divided by total criterion weight.</p>
          </div>
        </div>
        <ol className="mt-4 grid gap-3">
          {rankings.map((ranking, index) => (
            <li key={ranking.optionId} className="flex items-center gap-4 rounded-xl border border-border bg-background/70 p-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{ranking.title}</p>
                <p className="text-xs text-muted-foreground">{ranking.completedCriteria}/{ranking.totalCriteria} criteria scored</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold tabular-nums text-foreground">{ranking.score.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">out of 5</p>
              </div>
              {ranking.completedCriteria === ranking.totalCriteria ? <CheckCircle2 className="size-5 text-emerald-500" aria-label="Complete" /> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
