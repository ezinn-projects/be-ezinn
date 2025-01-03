import { ObjectId } from 'mongodb'
import { DayType, RoomType } from '~/constants/enum'

// Body for create/update Price
export interface IPriceRequestBody {
  dayType: DayType
  timeRange: {
    start: string // e.g., "17:00"
    end: string // e.g., "24:00"
  }
  prices: {
    roomType: RoomType
    price: number
  }[]
  effectiveDate: string
  endDate?: string
  note?: string
}

// Query for get Price
export interface IPriceRequestQuery {
  roomSize?: string
  dayType?: string
  effectiveDate?: string
  endDate?: string
}

// Body for delete multiple Price
export interface IDeleteMultiplePriceRequestBody {
  ids: ObjectId[]
}
