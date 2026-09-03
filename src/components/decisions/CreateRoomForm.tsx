import { useState } from 'react'
import { useMutations } from 'deepspace'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Textarea } from '../ui/Textarea'
import { useToast } from '../ui/Toast'
import type { DecisionRoom } from '../../types/decisions'

interface CreateRoomFormProps {
  userId: string
  onCreated: (roomId: string) => void
}

export function CreateRoomForm({ userId, onCreated }: CreateRoomFormProps) {
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { ready, createConfirmed } = useMutations<DecisionRoom>('decision-rooms')
  const { error } = useToast()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanQuestion = question.trim()
    if (!cleanTitle || !cleanQuestion) return

    setSubmitting(true)
    try {
      const roomId = await createConfirmed({
        title: cleanTitle,
        question: cleanQuestion,
        status: 'draft',
        participantIds: [userId],
        inviteToken: crypto.randomUUID(),
      })
      onCreated(roomId)
    } catch (cause) {
      error('Could not create the decision room', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      data-testid="create-room-form"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Plus aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Start a decision</h2>
          <p className="text-sm text-muted-foreground">Name the choice and the question behind it.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="room-title">Decision name</Label>
          <Input
            id="room-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Choose our next team offsite"
            maxLength={80}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="room-question">What are you deciding?</Label>
          <Textarea
            id="room-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Which option best balances travel time, cost, and team preferences?"
            maxLength={240}
            required
          />
        </div>
        <Button type="submit" disabled={!ready || !title.trim() || !question.trim()} loading={submitting}>
          Create room
        </Button>
      </div>
    </form>
  )
}
