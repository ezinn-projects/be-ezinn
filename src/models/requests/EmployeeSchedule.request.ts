import { EmployeeScheduleStatus, ShiftType } from '~/constants/enum'

// Request body khi nhân viên tự đăng ký
export interface ICreateEmployeeScheduleBody {
  date: string // ISO date string
  shifts: ShiftType[] // ["morning"] hoặc ["afternoon"] hoặc ["morning", "afternoon"]
  customStartTime?: string // HH:mm - Override default start time
  customEndTime?: string // HH:mm - Override default end time
  note?: string
}

// Request body khi admin đăng ký cho nhân viên
export interface IAdminCreateScheduleBody {
  userId: string
  date: string // ISO date string
  shifts: ShiftType[] // ["morning"] hoặc ["afternoon"] hoặc ["morning", "afternoon"]
  customStartTime?: string // HH:mm - Override default start time
  customEndTime?: string // HH:mm - Override default end time
  note?: string
}

// Request body khi cập nhật lịch
export interface IUpdateScheduleBody {
  date?: string // ISO date string
  shiftType?: ShiftType
  customStartTime?: string // HH:mm - Override default start time
  customEndTime?: string // HH:mm - Override default end time
  note?: string
}

// Request body khi approve/reject lịch
export interface IApproveScheduleBody {
  status: 'approved' | 'rejected'
  rejectedReason?: string
}

// Query params khi lấy danh sách lịch
export interface IGetSchedulesQuery {
  userId?: string
  date?: string // ISO date string - for day filter
  startDate?: string // ISO date string - for week filter
  endDate?: string // ISO date string - for week filter
  status?: EmployeeScheduleStatus
  shiftType?: ShiftType
  filterType?: 'day' | 'week'
}

