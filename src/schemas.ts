/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { decisionRoomsSchema } from './schemas/decision-rooms-schema'
import { decisionOptionsSchema } from './schemas/decision-options-schema'
import { decisionCriteriaSchema } from './schemas/decision-criteria-schema'
import { decisionScoresSchema } from './schemas/decision-scores-schema'
import { decisionCommentsSchema } from './schemas/decision-comments-schema'
import { decisionVotesSchema } from './schemas/decision-votes-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  decisionRoomsSchema,
  decisionOptionsSchema,
  decisionCriteriaSchema,
  decisionScoresSchema,
  decisionCommentsSchema,
  decisionVotesSchema,
]
