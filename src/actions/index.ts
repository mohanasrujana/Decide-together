import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { DecisionRoom } from '../types/decisions'

interface RoomRecord {
  recordId: string
  createdBy: string
  data: DecisionRoom
}

interface RelatedRecord {
  recordId: string
  data: { participantIds?: string[] }
}

const ROOM_CHILD_COLLECTIONS = [
  'decision-options',
  'decision-criteria',
  'decision-scores',
  'decision-comments',
  'decision-votes',
] as const

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

export const actions: Record<string, ActionHandler<Env>> = {
  joinDecisionRoom,
  deleteDecisionRoom,
}
