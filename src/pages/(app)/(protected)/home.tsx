import { useAuth, useQuery } from 'deepspace'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Layers3 } from 'lucide-react'
import { CreateRoomForm } from '../../../components/decisions/CreateRoomForm'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { DecisionRoom } from '../../../types/decisions'

export default function HomePage() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const { records: rooms, status } = useQuery<DecisionRoom>('decision-rooms', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  if (!userId) return null

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12" data-testid="decision-dashboard">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Structured decisions without groupthink</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Your decision rooms</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Frame the choice, weigh what matters, then score each option on the same terms.</p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent decisions</h2>
            <span className="text-sm text-muted-foreground">{rooms.length} total</span>
          </div>
          {status === 'loading' ? (
            <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" aria-label="Loading rooms" />
          ) : rooms.length === 0 ? (
            <EmptyState
              data-testid="rooms-empty-state"
              icon={<Layers3 aria-hidden />}
              title="No decisions yet"
              description="Create your first room and turn a fuzzy choice into a comparable set of options."
              className="rounded-2xl border border-dashed border-border bg-card/40"
            />
          ) : (
            <div className="grid gap-3">
              {rooms.map((room) => (
                <button
                  key={room.recordId}
                  type="button"
                  data-testid="decision-room-card"
                  onClick={() => navigate(`/decisions/${room.recordId}`)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">{room.data.title}</h3>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-secondary-foreground">{room.data.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{room.data.question}</p>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>

        <CreateRoomForm userId={userId} onCreated={(roomId) => navigate(`/decisions/${roomId}`)} />
      </div>
    </section>
  )
}
