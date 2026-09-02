import type {
  DecisionCriterion,
  DecisionEntity,
  DecisionOption,
  DecisionScore,
} from '../types/decisions'

export interface OptionRanking {
  optionId: string
  title: string
  score: number
  completedCriteria: number
  totalCriteria: number
}

export function calculateWeightedRankings(
  options: DecisionEntity<DecisionOption>[],
  criteria: DecisionEntity<DecisionCriterion>[],
  scores: DecisionEntity<DecisionScore>[],
): OptionRanking[] {
  const scoreByCell = new Map(
    scores.map((score) => [
      `${score.data.optionId}:${score.data.criterionId}`,
      score.data.value,
    ]),
  )
  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + Math.max(0, criterion.data.weight),
    0,
  )

  return options
    .map((option) => {
      let weightedTotal = 0
      let completedCriteria = 0

      for (const criterion of criteria) {
        const value = scoreByCell.get(`${option.recordId}:${criterion.recordId}`)
        if (value === undefined) continue
        completedCriteria += 1
        weightedTotal += value * Math.max(0, criterion.data.weight)
      }

      return {
        optionId: option.recordId,
        title: option.data.title,
        score: totalWeight > 0 ? weightedTotal / totalWeight : 0,
        completedCriteria,
        totalCriteria: criteria.length,
      }
    })
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
}
