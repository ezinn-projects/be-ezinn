import { ObjectId } from 'mongodb'
import { RecruitmentStatus } from '~/constants/enum'

export interface IRecruitment {
  _id?: ObjectId
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
  submittedAt: Date
  status: RecruitmentStatus
}

export class Recruitment {
  _id?: ObjectId
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
  submittedAt: Date
  status: RecruitmentStatus

  constructor(recruitment: IRecruitment) {
    const date = new Date()

    this._id = recruitment._id
    this.fullName = recruitment.fullName
    this.birthDate = recruitment.birthDate || date
    this.gender = recruitment.gender
    this.phone = recruitment.phone
    this.email = recruitment.email
    this.socialMedia = recruitment.socialMedia
    this.currentStatus = recruitment.currentStatus
    this.otherStatus = recruitment.otherStatus
    this.workDays = recruitment.workDays || []
    this.position = recruitment.position
    this.submittedAt = recruitment.submittedAt || date
    this.status = recruitment.status || RecruitmentStatus.Pending
  }

  // Tính tuổi từ ngày sinh
  getAge(): number {
    const today = new Date()
    const birthDate = new Date(this.birthDate)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  // Kiểm tra xem có đủ tuổi không (18-25 tuổi)
  isValidAge(): boolean {
    const age = this.getAge()
    return age >= 18 && age <= 25
  }
}
