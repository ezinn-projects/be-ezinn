import { ObjectId } from 'mongodb'
import { DayType, RoomSize } from '~/constants/enum'

// Field	Loại dữ liệu	Mô tả
// id	Unique ID	Định danh duy nhất cho mỗi giá.
// room_size	String (enum)	Loại phòng (small, medium, large).
// day_type	String (enum)	Loại ngày (weekday, weekend, holiday).
// time_range	String	Khung giờ áp dụng, ví dụ: 10:00-17:00.
// price	Number	Giá áp dụng cho khung giờ đó.
// effective_date	Date	Ngày bắt đầu áp dụng giá.
// end_date	Date (nullable)	Ngày kết thúc áp dụng giá (nếu có).

export interface Pricing {
  _id?: ObjectId // MongoDB sẽ tự tạo nếu không có.
  room_size: RoomSize // Required: Loại phòng.
  day_type: DayType // Required: Loại ngày.
  time_range: {
    start: string
    end: string
  } // Required: Khung giờ áp dụng.
  price: number // Required: Giá áp dụng.
  effective_date: Date // Required: Ngày bắt đầu hiệu lực.
  end_date?: Date | null // Optional: Ngày kết thúc hiệu lực (nếu có).
  note?: string // Optional: Ghi chú.
}

export class Price {
  _id?: ObjectId
  room_size: RoomSize
  day_type: DayType
  time_range: {
    start: string
    end: string
  }
  price: number
  effective_date: Date
  end_date?: Date | null
  note?: string

  constructor(price: Pricing) {
    this._id = price._id
    this.room_size = price.room_size
    this.day_type = price.day_type
    this.time_range = price.time_range
    this.price = price.price
    this.effective_date = price.effective_date
    this.end_date = price.end_date
    this.note = price.note
  }
}
