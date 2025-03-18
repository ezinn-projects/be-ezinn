import { ObjectId } from 'mongodb'
import { RoomScheduleStatus } from '~/constants/enum'

export class RoomSchedule {
  _id?: ObjectId
  roomId: ObjectId
  startTime: Date
  endTime?: Date | null
  status: RoomScheduleStatus
  createdAt: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string
  note?: string

  constructor(
    roomId: string,
    startTime: Date,
    status: RoomScheduleStatus,
    endTime?: Date | null,
    createdBy?: string,
    updatedBy?: string,
    note?: string
  ) {
    this.roomId = new ObjectId(roomId)
    this.startTime = startTime
    this.endTime = endTime !== undefined ? endTime : null
    this.status = status
    this.createdAt = new Date()
    this.createdBy = createdBy || 'system'
    this.updatedAt = new Date()
    ;(this.updatedBy = updatedBy || 'system'), (this.note = note)
  }
}
