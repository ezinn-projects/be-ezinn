export interface CreateRecruitmentRequest {
  fullName: string
  birthDate: Date
  gender: string // "male" | "female" | "other"
  phone: string // Format: 0xxxxxxxxx
  email?: string | null // Optional
  socialMedia: string // Facebook/Zalo link
  currentStatus: string // "student" | "working" | "other"
  otherStatus?: string | null // Thông tin khác (nếu currentStatus = "other")
  position: string[] // ["cashier", "server", "parking"] - có thể chọn nhiều
  workShifts: string[] // ["morning", "evening"] - có thể chọn nhiều
}

export interface UpdateRecruitmentRequest {
  status?: string
}

export interface GetRecruitmentsRequest {
  status?: string
  position?: string
  gender?: string
  page?: number
  limit?: number
  search?: string
}
