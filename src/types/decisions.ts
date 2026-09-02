export type DecisionStatus = 'draft' | 'scoring' | 'revealed' | 'closed'

export interface DecisionRoom {
  title: string
  question: string
  status: DecisionStatus
  participantIds: string[]
}

export interface DecisionOption {
  roomId: string
  title: string
  description?: string
  participantIds: string[]
}

export interface DecisionCriterion {
  roomId: string
  name: string
  weight: number
  participantIds: string[]
}

export interface DecisionScore {
  roomId: string
  optionId: string
  criterionId: string
  userId: string
  value: number
}

export interface DecisionEntity<T> {
  recordId: string
  data: T
}
