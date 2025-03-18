import { RoomScheduleStatus } from '~/constants/enum'

export interface IRoomScheduleRequestQuery {
  roomId?: string
  date?: string
  status?: RoomScheduleStatus
}

export interface IRoomScheduleRequestBody {
  roomId: string
  startTime: string
  endTime?: string
  status: RoomScheduleStatus
  createdBy?: string
  updatedBy?: string
  note?: string
}
