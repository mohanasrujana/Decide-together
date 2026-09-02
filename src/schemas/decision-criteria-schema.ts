import type { CollectionSchema } from 'deepspace/schema'

export const decisionCriteriaSchema: CollectionSchema = {
  name: 'decision-criteria',
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
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'weight', storage: 'number', interpretation: 'plain', required: true },
    {
      name: 'participantIds',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
      immutable: true,
    },
  ],
  collaboratorsField: 'participantIds',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'shared', create: false, update: false, delete: false },
    member: { read: 'shared', create: true, update: 'shared', delete: 'shared' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
