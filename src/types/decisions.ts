export type DecisionStatus = 'draft' | 'scoring' | 'revealed' | 'closed'

export interface DecisionRoom {
  title: string
  question: string
  status: DecisionStatus
  participantIds: string[]
  inviteToken: string
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
  participantIds: string[]
}

export interface DecisionComment {
  roomId: string
  userId: string
  content: string
  participantIds: string[]
}

export interface DecisionVote {
  roomId: string
  optionId: string
  userId: string
  participantIds: string[]
}

export interface DecisionAiSummary {
  leadingOption: string
  evidence: string[]
  majorDisagreement: string
  missingInformation: string[]
  suggestedNextAction: string
}

export interface DecisionEntity<T> {
  recordId: string
  data: T
}
