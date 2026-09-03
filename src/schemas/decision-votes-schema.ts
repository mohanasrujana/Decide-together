import type { CollectionSchema } from 'deepspace/schema'

export const decisionVotesSchema: CollectionSchema = {
  name: 'decision-votes',
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
      name: 'optionId',
      storage: 'text',
      interpretation: {
        kind: 'reference',
        targetTable: 'decision-options',
        displayColumn: 'title',
      },
      required: true,
    },
    {
      name: 'userId',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      immutable: true,
      userBound: true,
    },
    {
      name: 'participantIds',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
    },
  ],
  uniqueOn: ['roomId', 'userId'],
  ownerField: 'userId',
  collaboratorsField: 'participantIds',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'shared', create: false, update: false, delete: false },
    member: { read: 'shared', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
