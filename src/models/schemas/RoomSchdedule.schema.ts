import { ObjectId } from 'mongodb'
import { RoomScheduleStatus } from '~/constants/enum'

export enum BookingSource {
  Staff = 'staff',
  Customer = 'customer',
  System = 'system'
}

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
  source?: BookingSource

  constructor(
    roomId: string,
    startTime: Date,
    status: RoomScheduleStatus,
    endTime?: Date | null,
    createdBy?: string,
    updatedBy?: string,
    note?: string,
    source?: BookingSource
  ) {
    this.roomId = new ObjectId(roomId)
    this.startTime = startTime
    this.endTime = endTime !== undefined ? endTime : null
    this.status = status
    this.createdAt = new Date()
    this.createdBy = createdBy || 'system'
    this.updatedAt = new Date()
    this.updatedBy = updatedBy || 'system'
    this.note = note
    this.source = source || BookingSource.Staff
  }
}
