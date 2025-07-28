import { ObjectId } from 'mongodb'
import { RecruitmentStatus, CurrentStatus, WorkTimeSlot } from '~/constants/enum'

export interface IRecruitment {
  _id?: ObjectId
  fullName: string
  birthYear: number // Chỉ lưu năm sinh để tính tuổi
  phoneNumber: string
  socialMedia: string // Facebook/Zalo
  currentStatus: CurrentStatus
  currentStatusOther?: string // Nếu chọn "Khác"
  area: string // Phường/xã + Quận/huyện
  availableWorkTimes: WorkTimeSlot[] // Có thể chọn nhiều khung giờ
  status: RecruitmentStatus
  notes?: string // Ghi chú của admin
  createdAt: Date
  updatedAt?: Date
}

export class Recruitment {
  _id?: ObjectId
  fullName: string
  birthYear: number
  phoneNumber: string
  socialMedia: string
  currentStatus: CurrentStatus
  currentStatusOther?: string
  area: string
  availableWorkTimes: WorkTimeSlot[]
  status: RecruitmentStatus
  notes?: string
  createdAt: Date
  updatedAt?: Date

  constructor(recruitment: IRecruitment) {
    const date = new Date()

    this._id = recruitment._id
    this.fullName = recruitment.fullName
    this.birthYear = recruitment.birthYear
    this.phoneNumber = recruitment.phoneNumber
    this.socialMedia = recruitment.socialMedia
    this.currentStatus = recruitment.currentStatus
    this.currentStatusOther = recruitment.currentStatusOther
    this.area = recruitment.area
    this.availableWorkTimes = recruitment.availableWorkTimes || []
    this.status = recruitment.status || RecruitmentStatus.Pending
    this.notes = recruitment.notes
    this.createdAt = recruitment.createdAt || date
    this.updatedAt = recruitment.updatedAt || date
  }

  // Tính tuổi từ năm sinh
  getAge(): number {
    const currentYear = new Date().getFullYear()
    return currentYear - this.birthYear
  }

  // Kiểm tra xem có đủ tuổi không (18-25 tuổi)
  isValidAge(): boolean {
    const age = this.getAge()
    return age >= 18 && age <= 25
  }
}
