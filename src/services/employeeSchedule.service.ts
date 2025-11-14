import { ObjectId } from 'mongodb'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isoWeek from 'dayjs/plugin/isoWeek'
import { EmployeeScheduleStatus, ShiftType } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { EMPLOYEE_SCHEDULE_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import {
  IAdminCreateScheduleBody,
  ICreateEmployeeScheduleBody,
  IGetSchedulesQuery,
  IUpdateScheduleBody
} from '~/models/requests/EmployeeSchedule.request'
import { EmployeeSchedule } from '~/models/schemas/EmployeeSchedule.schema'
import databaseService from './database.service'
import { getShiftInfo } from '~/constants/shiftDefaults'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)

class EmployeeScheduleService {
  /**
   * Nhân viên tự đăng ký lịch (status = Pending)
   */
  async createSchedule(userId: string, data: ICreateEmployeeScheduleBody) {
    const { date, shifts, customStartTime, customEndTime, note } = data

    // Validate custom time nếu có
    if (customStartTime || customEndTime) {
      this.validateCustomTime(customStartTime, customEndTime)
    }

    // Lấy thông tin user
    const user = await databaseService.users.findOne({ _id: new ObjectId(userId) })
    if (!user) {
      throw new ErrorWithStatus({
        message: 'User không tồn tại',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const dateObj = dayjs(date).startOf('day').toDate()
    const createdSchedules: EmployeeSchedule[] = []

    // Tạo schedule cho mỗi ca
    for (const shiftType of shifts) {
      // Kiểm tra conflict
      await this.checkConflict(userId, dateObj, shiftType)

      const schedule = new EmployeeSchedule({
        userId: new ObjectId(userId),
        userName: user.name,
        userPhone: user.phone_number,
        date: dateObj,
        shiftType,
        customStartTime,
        customEndTime,
        status: EmployeeScheduleStatus.Pending,
        note,
        createdBy: new ObjectId(userId),
        createdByName: user.name,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await databaseService.employeeSchedules.insertOne(schedule)
      createdSchedules.push({ ...schedule, _id: result.insertedId })
    }

    return createdSchedules
  }

  /**
   * Admin tạo lịch cho nhân viên (status = Approved)
   */
  async adminCreateSchedule(adminId: string, data: IAdminCreateScheduleBody) {
    const { userId, date, shifts, customStartTime, customEndTime, note } = data

    // Validate custom time nếu có
    if (customStartTime || customEndTime) {
      this.validateCustomTime(customStartTime, customEndTime)
    }

    // Lấy thông tin user và admin
    const [user, admin] = await Promise.all([
      databaseService.users.findOne({ _id: new ObjectId(userId) }),
      databaseService.users.findOne({ _id: new ObjectId(adminId) })
    ])

    if (!user) {
      throw new ErrorWithStatus({
        message: 'User không tồn tại',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const dateObj = dayjs(date).startOf('day').toDate()
    const createdSchedules: EmployeeSchedule[] = []

    // Tạo schedule cho mỗi ca
    for (const shiftType of shifts) {
      // Kiểm tra conflict
      await this.checkConflict(userId, dateObj, shiftType)

      const schedule = new EmployeeSchedule({
        userId: new ObjectId(userId),
        userName: user.name,
        userPhone: user.phone_number,
        date: dateObj,
        shiftType,
        customStartTime,
        customEndTime,
        status: EmployeeScheduleStatus.Approved, // Admin tạo thì approved luôn
        note,
        createdBy: new ObjectId(adminId),
        createdByName: admin?.name,
        approvedBy: new ObjectId(adminId),
        approvedByName: admin?.name,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await databaseService.employeeSchedules.insertOne(schedule)
      createdSchedules.push({ ...schedule, _id: result.insertedId })
    }

    return createdSchedules
  }

  /**
   * Lấy danh sách lịch với filter và group by date
   */
  async getSchedules(filter: IGetSchedulesQuery, requestUserId?: string, isAdmin: boolean = false) {
    const query: any = {}

    // Nếu không phải admin thì chỉ xem được lịch của mình
    if (!isAdmin && requestUserId) {
      query.userId = new ObjectId(requestUserId)
    }

    // Filter theo userId (admin có thể filter theo user cụ thể)
    if (filter.userId && isAdmin) {
      query.userId = new ObjectId(filter.userId)
    }

    // Filter theo date/week
    if (filter.filterType === 'day' && filter.date) {
      const dayStart = dayjs(filter.date).startOf('day').toDate()
      const dayEnd = dayjs(filter.date).endOf('day').toDate()
      query.date = { $gte: dayStart, $lte: dayEnd }
    } else if (filter.filterType === 'week' && filter.startDate) {
      const weekStart = dayjs(filter.startDate).startOf('isoWeek').toDate()
      const weekEnd = dayjs(filter.startDate).endOf('isoWeek').toDate()
      query.date = { $gte: weekStart, $lte: weekEnd }
    } else if (filter.startDate && filter.endDate) {
      query.date = {
        $gte: dayjs(filter.startDate).startOf('day').toDate(),
        $lte: dayjs(filter.endDate).endOf('day').toDate()
      }
    }

    // Filter theo status
    if (filter.status) {
      query.status = filter.status
    }

    // Filter theo shiftType
    if (filter.shiftType) {
      query.shiftType = filter.shiftType
    }

    // Lấy schedules và sort theo date, shiftType
    const schedules = await databaseService.employeeSchedules
      .find(query)
      .sort({ date: 1, shiftType: 1 })
      .toArray()

    // Group by date và populate shift info
    const schedulesByDate: Record<string, any[]> = {}
    let totalShifts = 0
    const statusCount = {
      pending: 0,
      approved: 0,
      'in-progress': 0,
      completed: 0,
      absent: 0,
      rejected: 0,
      cancelled: 0
    }

    for (const schedule of schedules) {
      const dateKey = dayjs(schedule.date).format('YYYY-MM-DD')
      const shiftInfo = getShiftInfo(schedule.shiftType, schedule.customStartTime, schedule.customEndTime)

      const scheduleWithInfo = {
        _id: schedule._id,
        userId: schedule.userId,
        userName: schedule.userName,
        userPhone: schedule.userPhone,
        date: schedule.date,
        shiftType: schedule.shiftType,
        customStartTime: schedule.customStartTime,
        customEndTime: schedule.customEndTime,
        shiftInfo,
        status: schedule.status,
        note: schedule.note,
        createdBy: schedule.createdBy,
        createdByName: schedule.createdByName,
        approvedBy: schedule.approvedBy,
        approvedByName: schedule.approvedByName,
        approvedAt: schedule.approvedAt,
        rejectedBy: schedule.rejectedBy,
        rejectedByName: schedule.rejectedByName,
        rejectedAt: schedule.rejectedAt,
        rejectedReason: schedule.rejectedReason,
        startedAt: schedule.startedAt,
        completedAt: schedule.completedAt,
        markedAbsentBy: schedule.markedAbsentBy,
        markedAbsentAt: schedule.markedAbsentAt,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      }

      if (!schedulesByDate[dateKey]) {
        schedulesByDate[dateKey] = []
      }
      schedulesByDate[dateKey].push(scheduleWithInfo)

      totalShifts++
      statusCount[schedule.status as keyof typeof statusCount]++
    }

    // Calculate additional stats
    const completed = statusCount.completed
    const inProgress = statusCount['in-progress']
    const upcoming = statusCount.approved

    return {
      schedulesByDate,
      summary: {
        totalDays: Object.keys(schedulesByDate).length,
        totalShifts,
        completed,
        inProgress,
        upcoming,
        byStatus: statusCount
      }
    }
  }

  /**
   * Lấy chi tiết một schedule
   */
  async getScheduleById(id: string) {
    if (!ObjectId.isValid(id)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const schedule = await databaseService.employeeSchedules.findOne({ _id: new ObjectId(id) })
    if (!schedule) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Populate shift info
    const shiftInfo = getShiftInfo(schedule.shiftType, schedule.customStartTime, schedule.customEndTime)

    return {
      ...schedule,
      shiftInfo
    }
  }

  /**
   * Cập nhật schedule
   * Note: Validation status đã được handle ở middleware (Admin bypass, Staff restricted)
   */
  async updateSchedule(id: string, data: IUpdateScheduleBody) {
    if (!ObjectId.isValid(id)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const schedule = await databaseService.employeeSchedules.findOne({ _id: new ObjectId(id) })
    if (!schedule) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Status validation đã được handle ở middleware
    // Admin có thể update bất kỳ, Staff chỉ update được pending/rejected

    const updateData: any = {
      updatedAt: new Date()
    }

    if (data.date) {
      const newDate = dayjs(data.date).startOf('day').toDate()
      
      // Kiểm tra conflict nếu đổi ngày
      if (newDate.getTime() !== schedule.date.getTime()) {
        await this.checkConflict(
          schedule.userId.toString(),
          newDate,
          data.shiftType || schedule.shiftType,
          id
        )
      }
      
      updateData.date = newDate
    }

    if (data.shiftType) {
      // Kiểm tra conflict nếu đổi ca
      if (data.shiftType !== schedule.shiftType) {
        await this.checkConflict(
          schedule.userId.toString(),
          data.date ? dayjs(data.date).startOf('day').toDate() : schedule.date,
          data.shiftType,
          id
        )
      }
      
      updateData.shiftType = data.shiftType
    }

    if (data.note !== undefined) {
      updateData.note = data.note
    }

    if (data.customStartTime !== undefined) {
      updateData.customStartTime = data.customStartTime
    }

    if (data.customEndTime !== undefined) {
      updateData.customEndTime = data.customEndTime
    }

    // Validate custom time nếu có
    if (data.customStartTime || data.customEndTime) {
      this.validateCustomTime(data.customStartTime, data.customEndTime)
    }

    const result = await databaseService.employeeSchedules.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    return result.modifiedCount
  }

  /**
   * Admin approve/reject schedule
   */
  async approveSchedule(id: string, status: 'approved' | 'rejected', adminId: string, rejectedReason?: string) {
    if (!ObjectId.isValid(id)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const schedule = await databaseService.employeeSchedules.findOne({ _id: new ObjectId(id) })
    if (!schedule) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Chỉ approve được Pending
    if (schedule.status !== EmployeeScheduleStatus.Pending) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.ONLY_PENDING_CAN_APPROVE,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    const admin = await databaseService.users.findOne({ _id: new ObjectId(adminId) })

    const updateData: any = {
      status: status === 'approved' ? EmployeeScheduleStatus.Approved : EmployeeScheduleStatus.Rejected,
      updatedAt: new Date()
    }

    if (status === 'approved') {
      updateData.approvedBy = new ObjectId(adminId)
      updateData.approvedByName = admin?.name
      updateData.approvedAt = new Date()
    } else {
      updateData.rejectedBy = new ObjectId(adminId)
      updateData.rejectedByName = admin?.name
      updateData.rejectedAt = new Date()
      updateData.rejectedReason = rejectedReason
    }

    const result = await databaseService.employeeSchedules.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    return result.modifiedCount
  }

  /**
   * Admin mark absent
   */
  async markAbsent(id: string, adminId: string) {
    if (!ObjectId.isValid(id)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const schedule = await databaseService.employeeSchedules.findOne({ _id: new ObjectId(id) })
    if (!schedule) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    if (schedule.status === EmployeeScheduleStatus.Absent) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.ALREADY_ABSENT,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    const admin = await databaseService.users.findOne({ _id: new ObjectId(adminId) })

    const result = await databaseService.employeeSchedules.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: EmployeeScheduleStatus.Absent,
          markedAbsentBy: new ObjectId(adminId),
          markedAbsentAt: new Date(),
          updatedAt: new Date()
        }
      }
    )

    return result.modifiedCount
  }

  /**
   * Admin mark completed (manual)
   */
  async markCompleted(id: string, adminId: string) {
    if (!ObjectId.isValid(id)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const schedule = await databaseService.employeeSchedules.findOne({ _id: new ObjectId(id) })
    if (!schedule) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    if (schedule.status === EmployeeScheduleStatus.Completed) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.ALREADY_COMPLETED,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    const result = await databaseService.employeeSchedules.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: EmployeeScheduleStatus.Completed,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    )

    return result.modifiedCount
  }

  /**
   * Xóa schedule
   * Note: Validation status đã được handle ở middleware (Admin bypass, Staff restricted)
   */
  async deleteSchedule(id: string) {
    if (!ObjectId.isValid(id)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const schedule = await databaseService.employeeSchedules.findOne({ _id: new ObjectId(id) })
    if (!schedule) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Status validation đã được handle ở middleware
    // Admin có thể delete bất kỳ, Staff chỉ delete được pending/rejected

    const result = await databaseService.employeeSchedules.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount
  }

  /**
   * Cronjob: Auto start shifts (approved → in-progress)
   */
  async autoStartShifts() {
    const now = new Date()
    const today = dayjs().startOf('day').toDate()

    // Find approved schedules that should have started
    const schedules = await databaseService.employeeSchedules
      .find({
        status: EmployeeScheduleStatus.Approved,
        date: { $lte: today },
        startedAt: { $exists: false }
      })
      .limit(1000)
      .toArray()

    const toStart = []

    for (const schedule of schedules) {
      const startTime = this.calculateStartDateTime(schedule.date, schedule.shiftType, schedule.customStartTime)
      if (now >= startTime) {
        toStart.push(schedule._id)
      }
    }

    if (toStart.length > 0) {
      await databaseService.employeeSchedules.updateMany(
        { _id: { $in: toStart } },
        {
          $set: {
            status: EmployeeScheduleStatus.InProgress,
            startedAt: now,
            updatedAt: now
          }
        }
      )
      console.log(`✅ Auto started ${toStart.length} shifts`)
    }

    return toStart.length
  }

  /**
   * Cronjob: Auto complete shifts (in-progress → completed)
   */
  async autoCompleteShifts() {
    const now = new Date()
    const today = dayjs().startOf('day').toDate()

    // Find in-progress schedules that should be completed
    const schedules = await databaseService.employeeSchedules
      .find({
        status: EmployeeScheduleStatus.InProgress,
        date: { $lte: today },
        completedAt: { $exists: false }
      })
      .limit(1000)
      .toArray()

    const toComplete = []

    for (const schedule of schedules) {
      const endTime = this.calculateEndDateTime(schedule.date, schedule.shiftType, schedule.customEndTime)
      if (now >= endTime) {
        toComplete.push(schedule._id)
      }
    }

    if (toComplete.length > 0) {
      await databaseService.employeeSchedules.updateMany(
        { _id: { $in: toComplete } },
        {
          $set: {
            status: EmployeeScheduleStatus.Completed,
            completedAt: now,
            updatedAt: now
          }
        }
      )
      console.log(`✅ Auto completed ${toComplete.length} shifts`)
    }

    return toComplete.length
  }

  /**
   * Helper: Calculate start date time
   */
  private calculateStartDateTime(date: Date, shiftType: ShiftType, customStartTime?: string): Date {
    const shiftInfo = getShiftInfo(shiftType, customStartTime, undefined)
    const [hours, minutes] = shiftInfo.startTime.split(':').map(Number)
    
    return dayjs(date)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0)
      .toDate()
  }

  /**
   * Helper: Calculate end date time
   */
  private calculateEndDateTime(date: Date, shiftType: ShiftType, customEndTime?: string): Date {
    const shiftInfo = getShiftInfo(shiftType, undefined, customEndTime)
    const [hours, minutes] = shiftInfo.endTime.split(':').map(Number)
    
    return dayjs(date)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0)
      .toDate()
  }

  /**
   * Kiểm tra conflict - không cho đăng ký trùng ca trong cùng ngày
   * (trừ khi status = Rejected, Cancelled, Completed, Absent)
   */
  async checkConflict(userId: string, date: Date, shiftType: ShiftType, excludeId?: string) {
    const query: any = {
      userId: new ObjectId(userId),
      date: {
        $gte: dayjs(date).startOf('day').toDate(),
        $lte: dayjs(date).endOf('day').toDate()
      },
      shiftType,
      status: {
        $in: [EmployeeScheduleStatus.Pending, EmployeeScheduleStatus.Approved, EmployeeScheduleStatus.InProgress]
      }
    }

    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) }
    }

    const existingSchedule = await databaseService.employeeSchedules.findOne(query)

    if (existingSchedule) {
      const statusText =
        existingSchedule.status === EmployeeScheduleStatus.Pending
          ? 'đang chờ duyệt'
          : existingSchedule.status === EmployeeScheduleStatus.Approved
            ? 'đã được phê duyệt'
            : 'đang trong ca'
      throw new ErrorWithStatus({
        message: `Bạn đã đăng ký ca ${shiftType} cho ngày ${dayjs(date).format('YYYY-MM-DD')} (${statusText})`,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }
  }

  /**
   * Validate custom time format and range
   */
  private validateCustomTime(customStartTime?: string, customEndTime?: string) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

    if (customStartTime && !timeRegex.test(customStartTime)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.INVALID_TIME_FORMAT,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    if (customEndTime && !timeRegex.test(customEndTime)) {
      throw new ErrorWithStatus({
        message: EMPLOYEE_SCHEDULE_MESSAGES.INVALID_TIME_FORMAT,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    if (customStartTime && customEndTime) {
      const [startHour, startMin] = customStartTime.split(':').map(Number)
      const [endHour, endMin] = customEndTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      if (startMinutes >= endMinutes) {
        throw new ErrorWithStatus({
          message: EMPLOYEE_SCHEDULE_MESSAGES.INVALID_TIME_RANGE,
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
    }
  }
}

const employeeScheduleService = new EmployeeScheduleService()
export default employeeScheduleService
