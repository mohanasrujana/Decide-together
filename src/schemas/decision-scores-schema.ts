import type { CollectionSchema } from 'deepspace/schema'

export const decisionScoresSchema: CollectionSchema = {
  name: 'decision-scores',
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
      immutable: true,
    },
    {
      name: 'criterionId',
      storage: 'text',
      interpretation: {
        kind: 'reference',
        targetTable: 'decision-criteria',
        displayColumn: 'name',
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
    { name: 'value', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['roomId', 'optionId', 'criterionId', 'userId'],
  ownerField: 'userId',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
