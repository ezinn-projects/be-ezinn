import { CurrentStatus, WorkTimeSlot } from '~/constants/enum'

export interface CreateRecruitmentRequest {
  fullName: string
  birthYear: number
  phoneNumber: string
  socialMedia: string
  currentStatus: CurrentStatus
  currentStatusOther?: string
  area: string
  availableWorkTimes: WorkTimeSlot[]
}

export interface UpdateRecruitmentRequest {
  status?: string
  notes?: string
}

export interface GetRecruitmentsRequest {
  status?: string
  page?: number
  limit?: number
  search?: string
}
