import { DayType, RoomSize } from '~/constants/enum'

export interface IPricingRequestBody {
  room_size: RoomSize
  day_type: DayType
  effective_date: Date
  end_date: Date
}
