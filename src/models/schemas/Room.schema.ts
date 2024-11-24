import { ObjectId } from 'mongodb'
import { RoomStatus, RoomType } from '~/constants/enum'

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

export interface IRoom {
  _id: ObjectId // ID duy nhất của phòng (do database tự động tạo)
  roomName: string // Tên phòng hiển thị
  roomType: RoomType // Loại phòng ('Small', 'Medium', 'Large')
  maxCapacity: number // Số lượng khách tối đa
  status: RoomStatus // Trạng thái phòng ('Available', 'Occupied', 'Cleaning')
  pricePerTime: PricePerTime // Thông tin giá phòng
  equipment: Equipment // Thông tin thiết bị
  description?: string // Mô tả phòng (không bắt buộc)
  images?: string[] // Danh sách URL ảnh minh họa (không bắt buộc)
  createdAt: string // Ngày tạo phòng
  updatedAt?: string // Ngày cập nhật cuối cùng
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
