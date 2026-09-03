import type { CollectionSchema } from 'deepspace/schema'

export const decisionCommentsSchema: CollectionSchema = {
  name: 'decision-comments',
  columns: [
    {
      name: 'roomId',
      storage: 'text',
      interpretation: {
        kind: 'reference',
        targetTable: 'decision-rooms',
        displayColumn: 'title',
      },
      required: true,
      immutable: true,
    },
    {
      name: 'userId',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      immutable: true,
      userBound: true,
    },
    { name: 'content', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'participantIds',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
    },
  ],
  ownerField: 'userId',
  collaboratorsField: 'participantIds',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'shared', create: false, update: false, delete: false },
    member: { read: 'shared', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
