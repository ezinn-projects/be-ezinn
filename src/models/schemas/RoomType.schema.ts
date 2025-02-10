import { ObjectId } from 'mongodb'
import { RoomType as RoomTypeEnum } from '~/constants/enum'

interface RoomTypeType {
  _id?: ObjectId
  type: RoomTypeEnum
  name: string
  capacity: number
  area: string
  description: string
  images: string[]
  created_at?: Date
  updated_at?: Date
}

export default class RoomType {
  _id?: ObjectId
  type: RoomTypeEnum
  name: string
  capacity: number
  area: string
  description: string
  images: string[]
  created_at: Date
  updated_at: Date

  constructor(roomType: RoomTypeType) {
    const date = new Date()
    this._id = roomType._id
    this.type = roomType.type
    this.name = roomType.name
    this.capacity = roomType.capacity
    this.area = roomType.area
    this.description = roomType.description
    this.images = roomType.images
    this.created_at = roomType.created_at || date
    this.updated_at = roomType.updated_at || date
  }
}
