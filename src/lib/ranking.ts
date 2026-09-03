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
  contributorCount: number
}

export function calculateWeightedRankings(
  options: DecisionEntity<DecisionOption>[],
  criteria: DecisionEntity<DecisionCriterion>[],
  scores: DecisionEntity<DecisionScore>[],
): OptionRanking[] {
  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + Math.max(0, criterion.data.weight),
    0,
  )
  const criterionWeightById = new Map(
    criteria.map((criterion) => [criterion.recordId, Math.max(0, criterion.data.weight)]),
  )

  return options
    .map((option) => {
      let weightedTotal = 0
      let completedCriteria = 0
      const contributorIds = new Set<string>()
      for (const score of scores) {
        if (score.data.optionId !== option.recordId) continue
        const weight = criterionWeightById.get(score.data.criterionId)
        if (weight === undefined) continue
        contributorIds.add(score.data.userId)
        completedCriteria += 1
        weightedTotal += score.data.value * weight
      }

      const contributorCount = contributorIds.size
      const denominator = totalWeight * contributorCount

      return {
        optionId: option.recordId,
        title: option.data.title,
        score: denominator > 0 ? weightedTotal / denominator : 0,
        completedCriteria,
        totalCriteria: criteria.length * Math.max(1, contributorCount),
        contributorCount,
      }
    })
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
}
