import type { CollectionSchema } from 'deepspace/schema'

export const decisionOptionsSchema: CollectionSchema = {
  name: 'decision-options',
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
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'description', storage: 'text', interpretation: 'plain' },
    {
      name: 'participantIds',
      storage: 'text',
      interpretation: { kind: 'json' },
      required: true,
    },
  ],
  collaboratorsField: 'participantIds',
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: 'shared', create: false, update: false, delete: false },
    member: { read: 'shared', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
