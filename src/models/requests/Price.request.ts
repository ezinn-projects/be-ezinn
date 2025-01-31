import { ObjectId } from 'mongodb'
import { DayType, RoomType } from '~/constants/enum'

// Body for create/update Price
export interface IPriceRequestBody {
  dayType: DayType
  timeSlots: {
    start: string
    end: string
    prices: {
      roomType: RoomType
      price: number
    }[]
  }[]
  effectiveDate: string
  endDate?: string
  note?: string
}

// Query for get Price
export interface IPriceRequestQuery {
  roomType?: RoomType
  dayType?: DayType
  date?: string
}

// Body for delete multiple Price
export interface IDeleteMultiplePriceRequestBody {
  ids: ObjectId[]
}
