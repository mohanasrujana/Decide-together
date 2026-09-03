import { useMemo, useState } from 'react'
import { getAuthToken, useAuth, useMutations, useQuery } from 'deepspace'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, LogIn, Trash2 } from 'lucide-react'
import { CollaborationPanel } from '../../../../components/decisions/CollaborationPanel'
import { CriteriaEditor } from '../../../../components/decisions/CriteriaEditor'
import { OptionEditor } from '../../../../components/decisions/OptionEditor'
import { ScoringMatrix } from '../../../../components/decisions/ScoringMatrix'
import { Button } from '../../../../components/ui/Button'
import { useToast } from '../../../../components/ui/Toast'
import type { DecisionCriterion, DecisionOption, DecisionRoom, DecisionScore } from '../../../../types/decisions'

export default function DecisionRoomPage() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? ''
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { records: rooms, status: roomStatus } = useQuery<DecisionRoom>('decision-rooms')
  const { records: options } = useQuery<DecisionOption>('decision-options', { where: { roomId } })
  const { records: criteria } = useQuery<DecisionCriterion>('decision-criteria', { where: { roomId } })
  const { records: scores } = useQuery<DecisionScore>('decision-scores', { where: { roomId } })
  const { ready, putConfirmed } = useMutations<DecisionRoom>('decision-rooms')
  const [completing, setCompleting] = useState(false)
  const [joining, setJoining] = useState(false)
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
  const requiredScoreCount = expectedCellCount * (room?.data.participantIds.length ?? 1)
  const canComplete = options.length >= 2 && criteria.length > 0 && scoredCellCount === requiredScoreCount

  async function callAction(name: string, params: Record<string, unknown>) {
    const token = await getAuthToken()
    if (!token) throw new Error('Please sign in again')
    const response = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    const result = (await response.json()) as { success?: boolean; error?: string }
    if (!response.ok || !result.success) throw new Error(result.error ?? 'Action failed')
  }

  async function joinDecision() {
    setJoining(true)
    try {
      await callAction('joinDecisionRoom', { roomId, inviteToken })
      success('Room joined', 'You can now collaborate in real time.')
    } catch (cause) {
      error('Could not join room', cause instanceof Error ? cause.message : String(cause))
      setJoining(false)
    }
  }

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
      await callAction('deleteDecisionRoom', { roomId: room.recordId })
      navigate('/home')
    } catch (cause) {
      error('Could not delete decision', cause instanceof Error ? cause.message : String(cause))
      setDeleting(false)
    }
  }

  if (roomStatus === 'loading') {
    return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading decision room…</div>
  }

  if (!room && userId && inviteToken) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-20">
        <section className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm" data-testid="join-room-prompt">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><LogIn aria-hidden /></span>
          <h1 className="mt-5 text-2xl font-semibold text-foreground">Join this decision room</h1>
          <p className="mt-2 text-sm text-muted-foreground">This invite grants your signed-in account access to the room and its live discussion.</p>
          <Button className="mt-6" loading={joining} onClick={() => void joinDecision()}>Join room</Button>
        </section>
      </main>
    )
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

  const isOwner = room.createdBy === userId

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10" data-testid="decision-room">
      <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to decisions
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{room.data.status}</span>
            <span className="text-xs text-muted-foreground">Invite-only room · {room.data.participantIds.length} participant{room.data.participantIds.length === 1 ? '' : 's'}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{room.data.title}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{room.data.question}</p>
        </div>
        {isOwner ? (
          <Button
            disabled={!ready || !canComplete || room.data.status === 'closed'}
            loading={completing}
            onClick={() => void completeDecision()}
          >
            <CheckCircle2 aria-hidden />
            {room.data.status === 'closed' ? 'Decision complete' : 'Complete decision'}
          </Button>
        ) : null}
      </header>

      {!canComplete && room.data.status !== 'closed' ? (
        <p className="mt-5 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          To complete this decision, add at least two options, one criterion, and score every cell.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <OptionEditor roomId={roomId} userId={userId} participantIds={room.data.participantIds} options={options} />
        <CriteriaEditor roomId={roomId} userId={userId} participantIds={room.data.participantIds} criteria={criteria} />
      </div>
      <div className="mt-6">
        <ScoringMatrix
          roomId={roomId}
          userId={userId}
          participantIds={room.data.participantIds}
          options={options}
          criteria={criteria}
        />
      </div>

      <CollaborationPanel
        roomId={roomId}
        inviteToken={room.data.inviteToken}
        userId={userId}
        participantIds={room.data.participantIds}
        options={options}
      />

      {isOwner ? <section className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
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
      </section> : null}
    </main>
  )
}
