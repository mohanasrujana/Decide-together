import { useMemo, useState } from 'react'
import { useAuth, useMutations, useQuery } from 'deepspace'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react'
import { CriteriaEditor } from '../../../../components/decisions/CriteriaEditor'
import { OptionEditor } from '../../../../components/decisions/OptionEditor'
import { ScoringMatrix } from '../../../../components/decisions/ScoringMatrix'
import { Button } from '../../../../components/ui/Button'
import { useToast } from '../../../../components/ui/Toast'
import type { DecisionCriterion, DecisionOption, DecisionRoom, DecisionScore } from '../../../../types/decisions'

export default function DecisionRoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { records: rooms, status: roomStatus } = useQuery<DecisionRoom>('decision-rooms')
  const { records: options } = useQuery<DecisionOption>('decision-options', { where: { roomId } })
  const { records: criteria } = useQuery<DecisionCriterion>('decision-criteria', { where: { roomId } })
  const { records: scores } = useQuery<DecisionScore>('decision-scores', { where: { roomId, userId } })
  const { ready, putConfirmed, removeConfirmed: removeRoom } =
    useMutations<DecisionRoom>('decision-rooms')
  const { removeConfirmed: removeOption } = useMutations<DecisionOption>('decision-options')
  const { removeConfirmed: removeCriterion } =
    useMutations<DecisionCriterion>('decision-criteria')
  const { removeConfirmed: removeScore } = useMutations<DecisionScore>('decision-scores')
  const [completing, setCompleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { success, error } = useToast()
  const room = rooms.find((candidate) => candidate.recordId === roomId)

  const scoredCellCount = useMemo(() => {
    const optionIds = new Set(options.map((option) => option.recordId))
    const criterionIds = new Set(criteria.map((criterion) => criterion.recordId))
    return scores.filter((score) => optionIds.has(score.data.optionId) && criterionIds.has(score.data.criterionId)).length
  }, [criteria, options, scores])
  const expectedCellCount = options.length * criteria.length
  const canComplete = options.length >= 2 && criteria.length > 0 && scoredCellCount === expectedCellCount

  async function completeDecision() {
    if (!room) return
    setCompleting(true)
    try {
      await putConfirmed(room.recordId, { status: 'closed' })
      success('Decision completed', 'The final weighted ranking is ready.')
    } catch (cause) {
      error('Could not complete decision', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setCompleting(false)
    }
  }

  async function deleteDecision() {
    if (!room) return
    setDeleting(true)
    try {
      await Promise.all([
        ...scores.map((score) => removeScore(score.recordId)),
        ...options.map((option) => removeOption(option.recordId)),
        ...criteria.map((criterion) => removeCriterion(criterion.recordId)),
      ])
      await removeRoom(room.recordId)
      navigate('/home')
    } catch (cause) {
      error('Could not delete decision', cause instanceof Error ? cause.message : String(cause))
      setDeleting(false)
    }
  }

  if (roomStatus === 'loading') {
    return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading decision room…</div>
  }

  if (!room || !userId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Decision room not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed, or you may not have access.</p>
        <Button className="mt-6" onClick={() => window.location.assign('/home')}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10" data-testid="decision-room">
      <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to decisions
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{room.data.status}</span>
            <span className="text-xs text-muted-foreground">Private room</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{room.data.title}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{room.data.question}</p>
        </div>
        <Button
          disabled={!ready || !canComplete || room.data.status === 'closed'}
          loading={completing}
          onClick={() => void completeDecision()}
        >
          <CheckCircle2 aria-hidden />
          {room.data.status === 'closed' ? 'Decision complete' : 'Complete decision'}
        </Button>
      </header>

      {!canComplete && room.data.status !== 'closed' ? (
        <p className="mt-5 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          To complete this decision, add at least two options, one criterion, and score every cell.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <OptionEditor roomId={roomId} participantIds={room.data.participantIds} options={options} />
        <CriteriaEditor roomId={roomId} participantIds={room.data.participantIds} criteria={criteria} />
      </div>
      <div className="mt-6">
        <ScoringMatrix roomId={roomId} userId={userId} options={options} criteria={criteria} />
      </div>

      <section className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground">Delete this decision</h2>
            <p className="mt-1 text-sm text-muted-foreground">Removes this room and your current options, criteria, and scores.</p>
          </div>
          {confirmingDelete ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" loading={deleting} onClick={() => void deleteDecision()}>Confirm delete</Button>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
              <Trash2 aria-hidden /> Delete room
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}
