import { describe, expect, it } from 'vitest'
import { calculateWeightedRankings } from './ranking'

describe('calculateWeightedRankings', () => {
  it('ranks options using score times criterion weight over total weight', () => {
    const options = [
      { recordId: 'option-a', data: { roomId: 'room', title: 'A', participantIds: [] } },
      { recordId: 'option-b', data: { roomId: 'room', title: 'B', participantIds: [] } },
    ]
    const criteria = [
      { recordId: 'quality', data: { roomId: 'room', name: 'Quality', weight: 3, participantIds: [] } },
      { recordId: 'cost', data: { roomId: 'room', name: 'Cost', weight: 1, participantIds: [] } },
    ]
    const scores = [
      { recordId: '1', data: { roomId: 'room', optionId: 'option-a', criterionId: 'quality', userId: 'me', value: 5, participantIds: [] } },
      { recordId: '2', data: { roomId: 'room', optionId: 'option-a', criterionId: 'cost', userId: 'me', value: 1, participantIds: [] } },
      { recordId: '3', data: { roomId: 'room', optionId: 'option-b', criterionId: 'quality', userId: 'me', value: 3, participantIds: [] } },
      { recordId: '4', data: { roomId: 'room', optionId: 'option-b', criterionId: 'cost', userId: 'me', value: 5, participantIds: [] } },
    ]

    const result = calculateWeightedRankings(options, criteria, scores)

    expect(result.map((entry) => entry.optionId)).toEqual(['option-a', 'option-b'])
    expect(result[0].score).toBe(4)
    expect(result[1].score).toBe(3.5)
  })

  it('reports incomplete scoring without changing the denominator', () => {
    const result = calculateWeightedRankings(
      [{ recordId: 'option', data: { roomId: 'room', title: 'Option', participantIds: [] } }],
      [
        { recordId: 'a', data: { roomId: 'room', name: 'A', weight: 1, participantIds: [] } },
        { recordId: 'b', data: { roomId: 'room', name: 'B', weight: 1, participantIds: [] } },
      ],
      [{ recordId: '1', data: { roomId: 'room', optionId: 'option', criterionId: 'a', userId: 'me', value: 4, participantIds: [] } }],
    )

    expect(result[0]).toMatchObject({ score: 2, completedCriteria: 1, totalCriteria: 2 })
  })

  it('averages independent weighted scores without users overwriting each other', () => {
    const options = [
      { recordId: 'option', data: { roomId: 'room', title: 'A', participantIds: ['a', 'b'] } },
    ]
    const criteria = [
      { recordId: 'quality', data: { roomId: 'room', name: 'Quality', weight: 3, participantIds: ['a', 'b'] } },
      { recordId: 'cost', data: { roomId: 'room', name: 'Cost', weight: 1, participantIds: ['a', 'b'] } },
    ]
    const scores = [
      { recordId: '1', data: { roomId: 'room', optionId: 'option', criterionId: 'quality', userId: 'a', value: 5, participantIds: ['a', 'b'] } },
      { recordId: '2', data: { roomId: 'room', optionId: 'option', criterionId: 'cost', userId: 'a', value: 1, participantIds: ['a', 'b'] } },
      { recordId: '3', data: { roomId: 'room', optionId: 'option', criterionId: 'quality', userId: 'b', value: 3, participantIds: ['a', 'b'] } },
      { recordId: '4', data: { roomId: 'room', optionId: 'option', criterionId: 'cost', userId: 'b', value: 5, participantIds: ['a', 'b'] } },
    ]

    expect(calculateWeightedRankings(options, criteria, scores)[0]).toMatchObject({
      score: 3.75,
      completedCriteria: 4,
      totalCriteria: 4,
      contributorCount: 2,
    })
  })
})
