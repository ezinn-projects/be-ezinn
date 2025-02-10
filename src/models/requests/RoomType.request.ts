// import { DayTypePrice } from '~/models/schemas/RoomType.schema'

import { RoomType } from '~/constants/enum'

export interface AddRoomTypeRequestBody {
  name: string
  capacity: number
  area: string
  description: string
  images: string[]
  type: RoomType
}

export interface UpdateRoomTypeRequestBody extends Partial<AddRoomTypeRequestBody> {}
