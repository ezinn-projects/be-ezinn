import { ObjectId } from 'mongodb'
import { RoomStatus, RoomType } from '~/constants/enum'

// --- Room Interfaces ---
export interface IRoom {
  _id: ObjectId
  roomName: string
  roomType: string | RoomType // Chấp nhận cả string và enum RoomType
  status: RoomStatus // e.g., AVAILABLE, UNAVAILABLE
  description?: string
  createdAt: Date
  updatedAt?: Date
}

export class Room {
  _id?: ObjectId
  roomName: string
  roomType: string | RoomType // Chấp nhận cả string và enum RoomType
  description?: string
  status: RoomStatus
  createdAt: Date
  updatedAt?: Date

  constructor(room: IRoom) {
    this._id = room._id
    this.roomName = room.roomName
    this.roomType = room.roomType
    this.description = room.description
    this.status = room.status
    this.createdAt = room.createdAt
    this.updatedAt = room.updatedAt
  }
}
