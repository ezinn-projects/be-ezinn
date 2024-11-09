import { HouseRuleStatus } from '~/constants/enum'

export interface AddHouseRuleRequestBody {
  rule: string
  description: string
  status: HouseRuleStatus
}
