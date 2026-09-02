import { useAuthProfileReady } from 'deepspace'

export default function HomePage() {
  const { user } = useAuthProfileReady({ requireUser: true })

  return (
    <section className="mx-auto flex min-h-full max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Structured decisions without groupthink
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Decide independently. Understand the disagreement. Choose together.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
        Welcome{user?.name ? `, ${user.name}` : ''}. Your decision rooms will appear here after
        the creation flow is added in the next milestone.
      </p>

      <div
        data-testid="decision-dashboard"
        className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-8"
      >
        <h2 className="text-lg font-medium text-foreground">No decision rooms yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Next, we will add the room creation flow with options, weighted criteria, and blind
          participant scoring.
        </p>
      </div>
    </section>
  )
}
