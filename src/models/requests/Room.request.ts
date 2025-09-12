import { ObjectId } from 'mongodb'
import { RoomStatus, RoomType } from '~/constants/enum'

// Interface cho RoomRequest (input API)
export interface IAddRoomRequestBody {
  _id?: ObjectId
  roomId: number // Room ID là số duy nhất
  roomName: string
  roomType: RoomType
  maxCapacity: number
  status: RoomStatus
  description?: string
}
