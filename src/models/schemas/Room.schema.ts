import { ObjectId } from 'mongodb'
import { RoomStatus, RoomType } from '~/constants/enum'

export interface StatusHistory {
  previousStatus: RoomStatus // Trạng thái trước
  currentStatus: RoomStatus // Trạng thái hiện tại
  changedAt: string // Thời gian thay đổi
  changedBy: string // Người thực hiện thay đổi (nếu có)
}

export interface DynamicPricing {
  low: number // Giá trong giờ thấp điểm (VND/phút)
  normal: number // Giá cơ bản (VND/phút)
  high: number // Giá trong giờ cao điểm (VND/phút)
}

export interface PricePerTime {
  basePrice: number // Giá cơ bản mỗi phút (VND/phút)
  dynamicPricing: DynamicPricing // Giá linh hoạt
}

export interface Equipment {
  tv: boolean // Có TV hay không
  soundSystem: string // Hệ thống âm thanh (VD: JBL, BOSE)
  microphone: number // Số lượng micro
}

export interface Review {
  rating: number // Số sao (1-5)
  comment: string // Nhận xét
  reviewedAt: string // Thời gian đánh giá
  reviewer: string // Tên hoặc ID khách hàng
}

export interface Review {
  rating: number // Số sao (1-5)
  comment: string // Nhận xét
  reviewedAt: string // Thời gian đánh giá
  reviewer: string // Tên hoặc ID khách hàng
}

export interface Promotion {
  discountPercentage: number // Phần trăm giảm giá
  startDate: string // Ngày bắt đầu
  endDate: string // Ngày kết thúc
}

export interface IRoom {
  _id: ObjectId
  roomName: string
  roomType: RoomType
  maxCapacity: number
  status: RoomStatus
  statusHistory?: StatusHistory[]
  pricePerTime: PricePerTime
  equipment: Equipment
  description?: string
  images?: string[]
  promotion?: Promotion
  reviews?: Review[]
  averageRating?: number
  statistics?: {
    totalHoursUsed: number
    totalRevenue: number
  }
  branchId?: string
  branchName?: string
  tags?: string[]
  createdAt: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

export class Room {
  _id?: ObjectId
  roomName: string
  roomType: RoomType
  maxCapacity: number
  status: RoomStatus
  pricePerTime: PricePerTime
  equipment: Equipment
  description?: string
  images?: string[]
  createdAt: string
  updatedAt?: string

  constructor(room: IRoom) {
    this._id = room._id
    this.roomName = room.roomName
    this.roomType = room.roomType
    this.maxCapacity = room.maxCapacity
    this.status = room.status
    this.pricePerTime = room.pricePerTime
    this.equipment = room.equipment
    this.description = room.description
    this.images = room.images
    this.createdAt = room.createdAt
    this.updatedAt = room.updatedAt
  }
}
