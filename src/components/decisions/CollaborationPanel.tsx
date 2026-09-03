import { useMemo, useState } from 'react'
import { useMutations, usePresenceRoom, useQuery, useUserLookup } from 'deepspace'
import type { RecordData } from 'deepspace'
import { Check, Copy, MessageCircle, Send, Users, Vote } from 'lucide-react'
import type { DecisionComment, DecisionOption, DecisionVote } from '../../types/decisions'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { useToast } from '../ui/Toast'

interface CollaborationPanelProps {
  roomId: string
  inviteToken: string
  userId: string
  participantIds: string[]
  options: RecordData<DecisionOption>[]
}

export function CollaborationPanel({
  roomId,
  inviteToken,
  userId,
  participantIds,
  options,
}: CollaborationPanelProps) {
  const { peers, connected } = usePresenceRoom(`decision:${roomId}`)
  const { getName } = useUserLookup()
  const { records: comments } = useQuery<DecisionComment>('decision-comments', {
    where: { roomId },
    orderBy: 'createdAt',
    orderDir: 'asc',
    limit: 100,
  })
  const { records: votes } = useQuery<DecisionVote>('decision-votes', { where: { roomId } })
  const commentMutations = useMutations<DecisionComment>('decision-comments')
  const voteMutations = useMutations<DecisionVote>('decision-votes')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [votingFor, setVotingFor] = useState<string | null>(null)
  const { success, error } = useToast()

  const inviteLink = `${window.location.origin}/decisions/${roomId}?invite=${encodeURIComponent(inviteToken)}`
  const ownVote = votes.find((vote) => vote.data.userId === userId)
  const voteCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const vote of votes) counts.set(vote.data.optionId, (counts.get(vote.data.optionId) ?? 0) + 1)
    return counts
  }, [votes])

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      success('Invite link copied', 'Anyone who signs in with this link can join the room.')
    } catch (cause) {
      error('Could not copy link', cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = message.trim()
    if (!content) return
    setSending(true)
    try {
      await commentMutations.createConfirmed({ roomId, userId, content, participantIds })
      setMessage('')
    } catch (cause) {
      error('Could not send message', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSending(false)
    }
  }

  async function castVote(optionId: string) {
    setVotingFor(optionId)
    try {
      if (ownVote) {
        await voteMutations.putConfirmed(ownVote.recordId, { optionId })
      } else {
        await voteMutations.createConfirmed({ roomId, optionId, userId, participantIds })
      }
    } catch (cause) {
      error('Could not save vote', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setVotingFor(null)
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm" data-testid="room-discussion">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-primary" aria-hidden />
              <h2 className="text-xl font-semibold text-foreground">Room discussion</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Messages appear for everyone in real time.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
            {comments.length} message{comments.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto" aria-live="polite">
          {comments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              No messages yet. Start the conversation.
            </p>
          ) : (
            comments.map((comment) => (
              <article key={comment.recordId} className="rounded-xl border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{getName(comment.data.userId) ?? 'Participant'}</span>
                  <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.data.content}</p>
              </article>
            ))
          )}
        </div>

        <form onSubmit={sendMessage} className="mt-4 flex items-end gap-2">
          <Textarea
            aria-label="Room message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Share context or ask a question…"
            maxLength={500}
            rows={2}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={!commentMutations.ready || !message.trim()}
            loading={sending}
          >
            <Send aria-hidden />
          </Button>
        </form>
      </section>

      <div className="grid gap-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden />
            <h2 className="font-semibold text-foreground">Collaboration</h2>
          </div>
          <div className="mt-4 flex items-center justify-between" data-testid="room-presence" aria-live="polite">
            <span className="text-sm text-foreground">{connected ? `${peers.length + 1} online` : 'Connecting…'}</span>
            <span className={`size-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
          </div>
          {peers.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">With {peers.map((peer) => peer.userName).join(', ')}</p>
          ) : null}
          <label htmlFor="room-invite-link" className="mt-5 block text-xs font-medium text-muted-foreground">Shareable room link</label>
          <div className="mt-2 flex gap-2">
            <input
              id="room-invite-link"
              aria-label="Shareable room link"
              data-testid="shareable-room-link"
              value={inviteLink}
              readOnly
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-xs text-muted-foreground"
            />
            <Button size="icon" variant="outline" aria-label="Copy invite link" onClick={() => void copyInvite()}>
              <Copy aria-hidden />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{participantIds.length} participant{participantIds.length === 1 ? '' : 's'} can access this room.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="room-voting">
          <div className="flex items-center gap-2">
            <Vote className="size-5 text-primary" aria-hidden />
            <h2 className="font-semibold text-foreground">Final vote</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">One vote per person. You can change yours.</p>
          <div className="mt-4 grid gap-2">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add an option before voting.</p>
            ) : (
              options.map((option) => {
                const selected = ownVote?.data.optionId === option.recordId
                return (
                  <Button
                    key={option.recordId}
                    variant={selected ? 'secondary' : 'outline'}
                    className="justify-between"
                    aria-label={`Vote for ${option.data.title}`}
                    aria-pressed={selected}
                    disabled={!voteMutations.ready || votingFor !== null}
                    loading={votingFor === option.recordId}
                    onClick={() => void castVote(option.recordId)}
                  >
                    <span className="truncate">{option.data.title}</span>
                    <span className="flex items-center gap-2">
                      {voteCounts.get(option.recordId) ?? 0}
                      {selected ? <Check aria-hidden /> : null}
                    </span>
                  </Button>
                )
              })
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground" data-testid="vote-total">{votes.length} total vote{votes.length === 1 ? '' : 's'}</p>
        </section>
      </div>
    </div>
  )
}
