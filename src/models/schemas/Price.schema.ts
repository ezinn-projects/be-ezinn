import { ObjectId } from 'mongodb'
import { DayType, RoomSize } from '~/constants/enum'

export interface Pricing {
  _id?: ObjectId // MongoDB sẽ tự tạo nếu không có.
  room_size: RoomSize // Required: Loại phòng.
  day_type: DayType // Required: Loại ngày.
  time_range: string // Required: Khung giờ áp dụng.
  price: number // Required: Giá áp dụng.
  effective_date: Date // Required: Ngày bắt đầu hiệu lực.
  end_date?: Date | null // Optional: Ngày kết thúc hiệu lực (nếu có).
}

export class Price {
  _id?: ObjectId
  room_size: RoomSize
  day_type: DayType
  time_range: string
  price: number
  effective_date: Date
  end_date?: Date | null

  constructor(price: Pricing) {
    this._id = price._id
    this.room_size = price.room_size
    this.day_type = price.day_type
    this.time_range = price.time_range
    this.price = price.price
    this.effective_date = price.effective_date
    this.end_date = price.end_date
  }
}
