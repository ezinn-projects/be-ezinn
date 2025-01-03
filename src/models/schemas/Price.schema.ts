import { ObjectId } from 'mongodb'
import { DayType, RoomType } from '~/constants/enum'

// Field	Loại dữ liệu	Mô tả
// id	Unique ID	Định danh duy nhất cho mỗi giá
// day_type	String (enum)	Loại ngày (weekday, weekend, holiday)
// time_range	Object	Khung giờ áp dụng (start, end)
// prices	Array	Mảng các giá theo loại phòng
// effective_date	Date	Ngày bắt đầu áp dụng giá
// end_date	Date (nullable)	Ngày kết thúc áp dụng giá (nếu có)

export interface IPrice {
  _id?: ObjectId
  day_type: DayType
  time_range: {
    start: string
    end: string
  }
  prices: {
    room_type: RoomType
    price: number
  }[]
  effective_date: Date
  end_date?: Date | null
  note?: string
}

export class Price {
  _id?: ObjectId
  day_type: DayType
  time_range: {
    start: string
    end: string
  }
  prices: {
    room_type: RoomType
    price: number
  }[]
  effective_date: Date
  end_date?: Date | null
  note?: string

  constructor(price: IPrice) {
    this._id = price._id
    this.day_type = price.day_type
    this.time_range = price.time_range
    this.prices = price.prices
    this.effective_date = price.effective_date
    this.end_date = price.end_date
    this.note = price.note
  }
}
