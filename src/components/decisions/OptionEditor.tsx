import { useState } from 'react'
import { useMutations } from 'deepspace'
import type { RecordData } from 'deepspace'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { useToast } from '../ui/Toast'
import type { DecisionOption } from '../../types/decisions'

interface OptionEditorProps {
  roomId: string
  participantIds: string[]
  options: RecordData<DecisionOption>[]
}

export function OptionEditor({ roomId, participantIds, options }: OptionEditorProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { ready, createConfirmed, putConfirmed, removeConfirmed } =
    useMutations<DecisionOption>('decision-options')
  const { error } = useToast()

  function resetForm() {
    setTitle('')
    setDescription('')
    setEditingId(null)
  }

  async function saveOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setBusyId(editingId ?? 'new')
    try {
      if (editingId) {
        await putConfirmed(editingId, { title: cleanTitle, description: description.trim() })
      } else {
        await createConfirmed({
          roomId,
          title: cleanTitle,
          description: description.trim(),
          participantIds,
        })
      }
      resetForm()
    } catch (cause) {
      error('Could not save option', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyId(null)
    }
  }

  async function deleteOption(option: RecordData<DecisionOption>) {
    setBusyId(option.recordId)
    try {
      await removeConfirmed(option.recordId)
      if (editingId === option.recordId) resetForm()
    } catch (cause) {
      error('Could not delete option', cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Options</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add at least two choices to compare.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {options.length} added
        </span>
      </div>

      <form onSubmit={saveOption} className="mt-5 grid gap-3" data-testid="option-form">
        <Input
          aria-label="Option title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Option name"
          maxLength={80}
          required
        />
        <Textarea
          aria-label="Option description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short context (optional)"
          maxLength={240}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!ready || !title.trim()} loading={busyId === (editingId ?? 'new')}>
            {editingId ? <Pencil aria-hidden /> : <Plus aria-hidden />}
            {editingId ? 'Save option' : 'Add option'}
          </Button>
          {editingId ? (
            <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
              <X aria-hidden /> Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-5 grid gap-3">
        {options.map((option) => (
          <article key={option.recordId} className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-4">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground">{option.data.title}</h3>
              {option.data.description ? <p className="mt-1 text-sm text-muted-foreground">{option.data.description}</p> : null}
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Edit ${option.data.title}`}
              disabled={!ready || busyId !== null}
              onClick={() => {
                setEditingId(option.recordId)
                setTitle(option.data.title)
                setDescription(option.data.description ?? '')
              }}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${option.data.title}`}
              disabled={!ready || busyId !== null}
              onClick={() => void deleteOption(option)}
            >
              <Trash2 aria-hidden />
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}
