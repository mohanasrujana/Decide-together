import { useState } from 'react'
import { getAuthToken } from 'deepspace'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import type { DecisionAiSummary } from '../../types/decisions'
import { Button } from '../ui/Button'

interface DecisionAiSummaryPanelProps {
  roomId: string
  hasScores: boolean
}

export function DecisionAiSummaryPanel({
  roomId,
  hasScores,
}: DecisionAiSummaryPanelProps) {
  const [summary, setSummary] = useState<DecisionAiSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateSummary() {
    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Please sign in again')

      const response = await fetch(
        '/api/actions/generateDecisionSummary',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roomId }),
        },
      )

      const result = (await response.json()) as {
        success?: boolean
        data?: DecisionAiSummary
        error?: string
      }

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? 'Could not generate explanation')
      }

      setSummary(result.data)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not generate explanation',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
      data-testid="ai-summary-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            <h2 className="text-xl font-semibold text-foreground">
              AI decision explanation
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AI explains the deterministic ranking; it does not calculate or
            change it.
          </p>
        </div>

        {hasScores && !loading ? (
          <Button onClick={() => void generateSummary()}>
            <Sparkles aria-hidden />
            {summary ? 'Regenerate explanation' : 'Generate explanation'}
          </Button>
        ) : null}
      </div>

      {!hasScores ? (
        <div
          className="mt-5 rounded-xl border border-dashed border-border p-6 text-center"
          data-testid="ai-summary-empty"
        >
          <p className="font-medium text-foreground">
            No scores to explain yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Score at least one option before requesting an AI explanation.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div
          className="mt-5 flex items-center gap-3 rounded-xl bg-secondary/50 p-5 text-sm text-muted-foreground"
          data-testid="ai-summary-loading"
          aria-live="polite"
        >
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          Analyzing the deterministic ranking…
        </div>
      ) : null}

      {error && !loading ? (
        <div
          className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-5"
          data-testid="ai-summary-error"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 size-5 text-destructive"
              aria-hidden
            />
            <div>
              <p className="font-medium text-foreground">
                Explanation unavailable
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => void generateSummary()}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {summary && !loading && !error ? (
        <div
          className="mt-5 grid gap-4"
        data-testid="ai-summary-result"
          aria-live="polite"
        >
          <SummarySection
            title="Leading option"
            text={summary.leadingOption}
          />
          <SummaryList title="Evidence supporting it" items={summary.evidence} />
          <SummarySection
            title="Major disagreement"
            text={summary.majorDisagreement}
          />
          <SummaryList
            title="Missing information"
            items={summary.missingInformation}
          />
          <SummarySection
            title="Suggested next action"
            text={summary.suggestedNextAction}
          />
        </div>
      ) : null}
    </section>
  )
}

function SummarySection({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  )
}

function SummaryList({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">None identified.</p>
      )}
    </div>
  )
}
