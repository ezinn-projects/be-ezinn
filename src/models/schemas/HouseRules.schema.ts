import { ObjectId } from 'mongodb'
import { HouseRuleStatus } from '~/constants/enum'

// src/interfaces/HouseRule.ts
export interface HouseRule {
  id?: ObjectId
  rule: string
  description: string
  status: HouseRuleStatus
}

export class HouseRule {
  constructor(houseRule: HouseRule) {
    this.id = houseRule.id
    this.rule = houseRule.rule
    this.description = houseRule.description
    this.status = houseRule.status
  }
}
