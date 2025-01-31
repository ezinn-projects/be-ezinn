import { ObjectId } from 'mongodb'
import { RoomStatus, RoomType } from '~/constants/enum'

// --- Room Interfaces ---
export interface IRoom {
  _id: ObjectId
  roomName: string
  roomType: RoomType // e.g., SMALL, MEDIUM, LARGE
  maxCapacity: number
  status: RoomStatus // e.g., AVAILABLE, UNAVAILABLE
  images: string[] // Cloudinary URLs
  description?: string
  createdAt: Date
  updatedAt?: Date
}

export class Room {
  _id?: ObjectId
  roomName: string
  roomType: RoomType
  maxCapacity: number
  images: string[]
  description?: string
  status: RoomStatus
  createdAt: Date
  updatedAt?: Date

  constructor(room: IRoom) {
    this._id = room._id
    this.roomName = room.roomName
    this.roomType = room.roomType
    this.maxCapacity = room.maxCapacity
    this.images = room.images
    this.description = room.description
    this.status = room.status
    this.createdAt = room.createdAt
    this.updatedAt = room.updatedAt
  }
}
