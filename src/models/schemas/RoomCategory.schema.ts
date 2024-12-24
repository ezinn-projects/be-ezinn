import { ObjectId } from 'mongodb'

export interface IRoomCategorySchema {
  _id?: ObjectId // ID tự động do MongoDB tạo
  name: string // Tên loại phòng
  capacity: number // Số người tối đa
  price_per_hour: number // Giá mỗi giờ
  equipment: {
    tv: boolean
    soundSystem: string
    microphone: number
  }
  description?: string // Mô tả loại phòng
  createdAt: string // Ngày tạo
  updatedAt: string // Ngày cập nhật
}

export class RoomCategory {
  _id?: ObjectId
  name: string
  capacity: number
  price_per_hour: number
  equipment: {
    tv: boolean
    soundSystem: string
    microphone: number
  }
  description?: string
  createdAt: string
  updatedAt: string

  constructor(category: IRoomCategorySchema) {
    this._id = category._id || new ObjectId()
    this.name = category.name
    this.capacity = category.capacity
    this.price_per_hour = category.price_per_hour
    this.equipment = category.equipment
    this.description = category.description
    this.createdAt = category.createdAt
    this.updatedAt = category.updatedAt
  }
}
