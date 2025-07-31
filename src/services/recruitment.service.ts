import { ObjectId } from 'mongodb'
import { RecruitmentStatus } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'
import {
  CreateRecruitmentRequest,
  GetRecruitmentsRequest,
  UpdateRecruitmentRequest
} from '~/models/requests/Recruitment.request'
import { IRecruitment, Recruitment } from '~/models/schemas/Recruitment.schema'
import databaseService from './database.service'

class RecruitmentService {
  private collection = 'recruitments'

  async createRecruitment(data: CreateRecruitmentRequest): Promise<Recruitment> {
    // Kiểm tra tuổi
    const recruitment = new Recruitment({
      fullName: data.fullName,
      birthDate: data.birthDate,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      socialMedia: data.socialMedia,
      currentStatus: data.currentStatus,
      otherStatus: data.otherStatus,
      workDays: data.workDays,
      position: data.position,
      submittedAt: new Date(),
      status: RecruitmentStatus.Pending
    })

    if (!recruitment.isValidAge()) {
      throw new ErrorWithStatus({
        message: 'Chỉ nhận ứng viên từ 18-25 tuổi',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Kiểm tra số điện thoại đã tồn tại chưa
    const existingRecruitment = await databaseService.getCollection(this.collection).findOne({
      phone: data.phone
    })

    if (existingRecruitment) {
      throw new ErrorWithStatus({
        message: 'Số điện thoại này đã được sử dụng để ứng tuyển',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    const recruitmentData: IRecruitment = {
      fullName: data.fullName,
      birthDate: data.birthDate,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      socialMedia: data.socialMedia,
      currentStatus: data.currentStatus,
      otherStatus: data.otherStatus,
      workDays: data.workDays,
      position: data.position,
      submittedAt: new Date(),
      status: RecruitmentStatus.Pending
    }

    const result = await databaseService.getCollection(this.collection).insertOne(recruitmentData)

    return new Recruitment({
      _id: result.insertedId,
      ...recruitmentData
    })
  }

  async getRecruitments(query: GetRecruitmentsRequest = {}): Promise<{ recruitments: Recruitment[]; total: number }> {
    const { status, page = 1, limit = 10, search } = query
    const skip = (page - 1) * limit

    const filter: any = {}

    if (status) {
      filter.status = status
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } }
      ]
    }

    const [recruitments, total] = await Promise.all([
      databaseService
        .getCollection(this.collection)
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      databaseService.getCollection(this.collection).countDocuments(filter)
    ])

    return {
      recruitments: recruitments.map((recruitment: any) => new Recruitment(recruitment)),
      total
    }
  }

  async getRecruitmentById(id: string): Promise<Recruitment | null> {
    const recruitment = await databaseService.getCollection(this.collection).findOne({
      _id: new ObjectId(id)
    })

    return recruitment ? new Recruitment(recruitment as IRecruitment) : null
  }

  async updateRecruitment(id: string, data: UpdateRecruitmentRequest): Promise<Recruitment | null> {
    const updateData: any = {}

    if (data.status) {
      updateData.status = data.status
    }

    const result = await databaseService
      .getCollection(this.collection)
      .findOneAndUpdate({ _id: new ObjectId(id) }, { $set: updateData }, { returnDocument: 'after' })

    return result ? new Recruitment(result as IRecruitment) : null
  }

  async deleteRecruitment(id: string): Promise<boolean> {
    const result = await databaseService.getCollection(this.collection).deleteOne({
      _id: new ObjectId(id)
    })

    return result.deletedCount > 0
  }

  async getRecruitmentStats(): Promise<{
    total: number
    pending: number
    reviewed: number
    approved: number
    rejected: number
    hired: number
  }> {
    const stats = await databaseService
      .getCollection(this.collection)
      .aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray()

    const result = {
      total: 0,
      pending: 0,
      reviewed: 0,
      approved: 0,
      rejected: 0,
      hired: 0
    }

    stats.forEach((stat: any) => {
      result[stat._id as keyof typeof result] = stat.count
      result.total += stat.count
    })

    return result
  }
}

export const recruitmentService = new RecruitmentService()
