import { ObjectId } from 'mongodb'

type RoomTypeType = {
  _id?: ObjectId
  name: string
  description?: string // Mô tả tùy chọn, có thể để trống
}

export default class RoomType {
  _id?: ObjectId
  name: string
  description?: string

  constructor(roomType: RoomTypeType) {
    this._id = roomType._id
    this.name = roomType.name
    this.description = roomType.description
  }
}
