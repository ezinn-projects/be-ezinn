import { ObjectId } from 'mongodb'

export interface FNBOrder {
  drinks: Record<string, number>
  snacks: Record<string, number>
}

export class RoomScheduleFNBOrder {
  _id?: ObjectId
  roomScheduleId: ObjectId // Khóa ngoại tham chiếu đến RoomSchedule._id
  order: FNBOrder
  createdAt: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string

  constructor(roomScheduleId: string, order: FNBOrder, createdBy?: string, updatedBy?: string) {
    this.roomScheduleId = new ObjectId(roomScheduleId)
    this.order = order
    this.createdAt = new Date()
    this.createdBy = createdBy || 'system'
    this.updatedAt = new Date()
    this.updatedBy = updatedBy || 'system'
  }
}
