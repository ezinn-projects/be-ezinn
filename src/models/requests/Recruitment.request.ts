export interface CreateRecruitmentRequest {
  fullName: string
  birthDate: Date
  gender: string
  phone: string
  email: string
  socialMedia: string
  currentStatus: string
  otherStatus: string
  workDays: string[]
  position: string
}

export interface UpdateRecruitmentRequest {
  status?: string
}

export interface GetRecruitmentsRequest {
  status?: string
  page?: number
  limit?: number
  search?: string
}
