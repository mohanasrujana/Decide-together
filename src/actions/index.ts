import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { calculateWeightedRankings } from '../lib/ranking'
import type { DecisionAiSummary,
  DecisionCriterion, DecisionOption, DecisionRoom, 
  DecisionScore, DecisionVote} from '../types/decisions'

interface RoomRecord {
  recordId: string
  createdBy: string
  data: DecisionRoom
}

interface RelatedRecord {
  recordId: string
  data: { participantIds?: string[] }
}

interface ActionRecord<T> {
  recordId: string
  createdBy: string
  data: T
}

interface AnthropicResponse {
  content?: Array<{
    type?: string
    text?: string
  }>
}

const ROOM_CHILD_COLLECTIONS = [
  'decision-options',
  'decision-criteria',
  'decision-scores',
  'decision-comments',
  'decision-votes',
] as const

function parseDecisionAiSummary(text: string): DecisionAiSummary | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')

  let value: unknown

  try {
    value = JSON.parse(cleaned)
  } catch {
    return null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (
    typeof candidate.leadingOption !== 'string' ||
    !Array.isArray(candidate.evidence) ||
    !candidate.evidence.every((item) => typeof item === 'string') ||
    typeof candidate.majorDisagreement !== 'string' ||
    !Array.isArray(candidate.missingInformation) ||
    !candidate.missingInformation.every((item) => typeof item === 'string') ||
    typeof candidate.suggestedNextAction !== 'string'
  ) {
    return null
  }

  return {
    leadingOption: candidate.leadingOption,
    evidence: candidate.evidence,
    majorDisagreement: candidate.majorDisagreement,
    missingInformation: candidate.missingInformation,
    suggestedNextAction: candidate.suggestedNextAction,
  }
}

function canAccessRoom(room: RoomRecord, userId: string, ownerUserId: string): boolean {
  return (
    room.createdBy === userId ||
    room.data.participantIds.includes(userId) ||
    userId === ownerUserId
  )
}

const joinDecisionRoom: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const roomId = typeof params.roomId === 'string' ? params.roomId : ''
  const inviteToken = typeof params.inviteToken === 'string' ? params.inviteToken : ''
  if (!roomId || !inviteToken) return { success: false, error: 'Invalid invite link' }

  const loadedRoom = await tools.get('decision-rooms', roomId)
  if (!loadedRoom.success) return { success: false, error: 'Invalid invite link' }

  const room = loadedRoom.data.record as unknown as RoomRecord
  if (room.data.inviteToken !== inviteToken) {
    return { success: false, error: 'Invalid invite link' }
  }
  if (room.data.status === 'closed') {
    return { success: false, error: 'This decision is already closed' }
  }

  const participantIds = [...new Set([...(room.data.participantIds ?? []), userId])]
  if (participantIds.length > 20) {
    return { success: false, error: 'This room has reached its participant limit' }
  }
  if (participantIds.length === room.data.participantIds.length) {
    return { success: true, data: { roomId, joined: false } }
  }

  // Update existing children before exposing the room to the new participant.
  // When the room becomes visible, its child subscriptions start with complete access.
  for (const collection of ROOM_CHILD_COLLECTIONS) {
    const result = await tools.query(collection, { where: { roomId }, limit: 500 })
    if (!result.success) return result
    for (const record of result.data.records as RelatedRecord[]) {
      const updated = await tools.update(collection, record.recordId, { participantIds })
      if (!updated.success) return updated
    }
  }

  const updatedRoom = await tools.update('decision-rooms', roomId, { participantIds })
  if (!updatedRoom.success) return updatedRoom
  return { success: true, data: { roomId, joined: true } }
}

const deleteDecisionRoom: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const roomId = typeof params.roomId === 'string' ? params.roomId : ''
  if (!roomId) return { success: false, error: 'Room id is required' }

  const loadedRoom = await tools.get('decision-rooms', roomId)
  if (!loadedRoom.success) return { success: false, error: 'Decision room not found' }
  const room = loadedRoom.data.record as unknown as RoomRecord
  if (room.createdBy !== userId && userId !== env.OWNER_USER_ID) {
    return { success: false, error: 'Only the room owner can delete this decision' }
  }

  for (const collection of ROOM_CHILD_COLLECTIONS) {
    while (true) {
      const removed = await tools.deleteWhere(collection, { roomId }, 500)
      if (!removed.success) return removed
      if (removed.data.deleted < 500) break
    }
  }

  return tools.remove('decision-rooms', roomId)
}

const generateDecisionSummary: ActionHandler<Env> = async ({
  userId,
  params,
  tools,
  env,
}) => {
  const roomId = typeof params.roomId === 'string' ? params.roomId : ''
  if (!roomId) return { success: false, error: 'Room id is required' }

  const loadedRoom = await tools.get('decision-rooms', roomId)
  if (!loadedRoom.success) {
    return { success: false, error: 'Decision room not found' }
  }

  const room = loadedRoom.data.record as unknown as RoomRecord
  if (!canAccessRoom(room, userId, env.OWNER_USER_ID)) {
    return { success: false, error: 'You do not have access to this room' }
  }

  const optionsResult = await tools.query('decision-options', {
    where: { roomId },
    limit: 100,
  })
  if (!optionsResult.success) return optionsResult

  const criteriaResult = await tools.query('decision-criteria', {
    where: { roomId },
    limit: 100,
  })
  if (!criteriaResult.success) return criteriaResult

  const scoresResult = await tools.query('decision-scores', {
    where: { roomId },
    limit: 500,
  })
  if (!scoresResult.success) return scoresResult

  const votesResult = await tools.query('decision-votes', {
    where: { roomId },
    limit: 100,
  })
  if (!votesResult.success) return votesResult

  const options =
    optionsResult.data.records as unknown as ActionRecord<DecisionOption>[]
  const criteria =
    criteriaResult.data.records as unknown as ActionRecord<DecisionCriterion>[]
  const scores =
    scoresResult.data.records as unknown as ActionRecord<DecisionScore>[]
  const votes =
    votesResult.data.records as unknown as ActionRecord<DecisionVote>[]

  if (options.length === 0 || criteria.length === 0 || scores.length === 0) {
    return {
      success: false,
      error: 'Add options, criteria, and scores before generating an explanation',
    }
  }

  const rankings = calculateWeightedRankings(options, criteria, scores)
  const leadingOption = rankings[0]?.title
  if (!leadingOption) {
    return { success: false, error: 'No ranked option is available' }
  }

  const optionNames = new Map(
    options.map((option) => [option.recordId, option.data.title]),
  )
  const criterionNames = new Map(
    criteria.map((criterion) => [criterion.recordId, criterion.data.name]),
  )
  const participantNames = new Map(
    room.data.participantIds.map((id, index) => [
      id,
      `Participant ${index + 1}`,
    ]),
  )

  const structuredRoomData = {
    question: room.data.question,
    options: options.map((option) => ({
      id: option.recordId,
      title: option.data.title,
      description: option.data.description ?? '',
    })),
    criteria: criteria.map((criterion) => ({
      id: criterion.recordId,
      name: criterion.data.name,
      weight: criterion.data.weight,
    })),
    deterministicRanking: rankings.map((ranking, index) => ({
      rank: index + 1,
      option: ranking.title,
      score: Number(ranking.score.toFixed(2)),
      contributors: ranking.contributorCount,
    })),
    individualScores: scores.map((score) => ({
      participant:
        participantNames.get(score.data.userId) ?? 'Participant',
      option: optionNames.get(score.data.optionId) ?? 'Unknown option',
      criterion:
        criterionNames.get(score.data.criterionId) ?? 'Unknown criterion',
      value: score.data.value,
    })),
    votes: options.map((option) => ({
      option: option.data.title,
      count: votes.filter(
        (vote) => vote.data.optionId === option.recordId,
      ).length,
    })),
  }

  const generated = await tools.integration<AnthropicResponse>(
    'anthropic/chat-completion',
    {
      model: 'claude-sonnet-5',
      max_tokens: 900,
      temperature: 0.2,
      system: [
        'You explain a deterministic group-decision result.',
        'The supplied ranking is authoritative. Never recalculate, reorder, or override it.',
        'Return JSON only, without Markdown fences.',
        'Use exactly these keys: leadingOption, evidence, majorDisagreement, missingInformation, suggestedNextAction.',
        'evidence and missingInformation must be arrays of concise strings.',
        `leadingOption must be exactly: ${JSON.stringify(leadingOption)}.`,
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: JSON.stringify(structuredRoomData),
        },
      ],
    },
  )

  if (!generated.success) return generated

  const text = generated.data.content?.find(
    (block) => block.type === 'text',
  )?.text

  if (!text) {
    return { success: false, error: 'The AI returned no explanation' }
  }

  const summary = parseDecisionAiSummary(text)
  if (!summary) {
    return { success: false, error: 'The AI returned an invalid explanation' }
  }

  return {
    success: true,
    data: {
      ...summary,
      leadingOption,
    },
  }
}

export const actions: Record<string, ActionHandler<Env>> = {
  joinDecisionRoom,
  generateDecisionSummary,
  deleteDecisionRoom,
}
