import type { CollectionSchema } from 'deepspace/schema'

export const decisionRoomsSchema: CollectionSchema = {
  name: 'decision-rooms',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'question', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['draft', 'scoring', 'revealed', 'closed'],
      },
      required: true,
    },
    {
      name: 'participantIds',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
    },
    { name: 'inviteToken', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  collaboratorsField: 'participantIds',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'shared', create: false, update: false, delete: false },
    member: { read: 'shared', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
