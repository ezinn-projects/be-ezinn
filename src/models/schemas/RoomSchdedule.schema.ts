import { ObjectId } from 'mongodb'
import { RoomScheduleStatus, RoomType, RoomSize } from '~/constants/enum'

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

  // Thông tin khách hàng cho online booking
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  originalRoomType?: RoomType
  actualRoomType?: RoomType
  upgraded?: boolean

  // 🆕 Virtual Room Info (chỉ field cần thiết)
  virtualRoomInfo?: {
    virtualRoomId: ObjectId
    virtualRoomName: string
    virtualSize: RoomType
    physicalSize: RoomType
    isVirtualBooking: boolean
  }

  // 🆕 Admin Notification (chỉ field quan trọng)
  adminNotes?: {
    virtualSizeToUse: RoomType // Size admin cần chỉnh khi chuyển "in use"
    staffInstructions: string // Hướng dẫn cho staff
  }

  constructor(
    roomId: string,
    startTime: Date,
    status: RoomScheduleStatus,
    endTime?: Date | null,
    createdBy?: string,
    updatedBy?: string,
    note?: string,
    source?: BookingSource,
    customerName?: string,
    customerPhone?: string,
    customerEmail?: string,
    originalRoomType?: RoomType,
    actualRoomType?: RoomType,
    upgraded?: boolean,
    virtualRoomInfo?: any,
    adminNotes?: any
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

    // Thông tin khách hàng
    this.customerName = customerName
    this.customerPhone = customerPhone
    this.customerEmail = customerEmail
    this.originalRoomType = originalRoomType
    this.actualRoomType = actualRoomType
    this.upgraded = upgraded || false

    // Virtual room info
    this.virtualRoomInfo = virtualRoomInfo
    this.adminNotes = adminNotes
  }
}
