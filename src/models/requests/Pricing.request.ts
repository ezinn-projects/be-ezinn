import { ObjectId } from 'mongodb'
import { DayType, RoomSize } from '~/constants/enum'

// Body for create/update pricing
export interface IPricingRequestBody {
  room_size: RoomSize
  day_type: DayType
  effective_date: string
  time_range: string
  price: number
  end_date?: string
  note?: string
}

// Query for get pricing
export interface IPricingRequestQuery {
  room_size?: string
  day_type?: string
  effective_date?: string
  end_date?: string
}

// Body for delete multiple pricing
export interface IDeleteMultiplePricingRequestBody {
  ids: ObjectId[]
}
