import { ObjectId } from 'mongodb'
// import { IRoomScheduleRequestBody, IRoomScheduleRequestQuery } from '~/models/requests/RoomSchedule.request'
import dayjs from 'dayjs'
import { RoomScheduleStatus } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'
import { IRoomScheduleRequestBody } from '~/models/requests/RoomSchedule.request'
import { RoomSchedule } from '~/models/schemas/RoomSchdedule.schema'
import databaseService from './database.services'

/**
 * RoomScheduleService
 * Cung cấp các hàm xử lý nghiệp vụ cho event lịch phòng.
 */
class RoomScheduleService {
  /**
   * Lấy danh sách lịch phòng theo filter
   * @param filter - Đối tượng filter {IRoomScheduleRequestQuery}
   *    Có thể bao gồm: roomId, date (ISO string hoặc Date), status
   * @returns Mảng các lịch phòng
   */
  async getSchedules(filter: any) {
    const query: {
      roomId?: ObjectId
      startTime?: { $gte: Date; $lt: Date }
      status?: RoomSchedule['status']
    } = {}

    if (filter.roomId) {
      query.roomId = filter.roomId
    }

    console.log('query', query)

    // Nếu có filter.startTime (từ controller), sử dụng trực tiếp
    if (filter.startTime) {
      query.startTime = filter.startTime
    }
    // Nếu không có filter.startTime nhưng có filter.date, xử lý như cũ
    else if (filter.date) {
      const timeZone = 'Asia/Ho_Chi_Minh'
      const startOfDay = dayjs.tz(filter.date, timeZone).startOf('day').utc().toDate()
      const endOfDay = dayjs.tz(filter.date, timeZone).startOf('day').add(1, 'day').utc().toDate()
      query.startTime = { $gte: startOfDay, $lt: endOfDay }
    }

    if (filter.status) {
      query.status = filter.status
    }

    console.log('Final query:', query)

    return await databaseService.roomSchedule.find(query).toArray()
  }

  /**
   * Lấy thông tin lịch phòng theo id
   * @param id - RoomSchedule id
   * @returns Một lịch phòng
   */
  async getScheduleById(id: string) {
    return await databaseService.roomSchedule.findOne({ _id: new ObjectId(id) })
  }

  /**
   * Tạo mới một event lịch phòng
   * @param schedule - Đối tượng lịch phòng {IRoomScheduleRequestBody}
   * @returns id của lịch phòng vừa tạo
   */
  async createSchedule(schedule: IRoomScheduleRequestBody) {
    // Chuyển đổi startTime và endTime
    const startTime = new Date(schedule.startTime)
    const endTime = schedule.endTime ? new Date(schedule.endTime) : null

    // Nếu trạng thái là "booked", thì bắt buộc phải có endTime và khoảng cách giữa startTime và endTime không vượt quá 2 tiếng
    if (schedule.status === RoomScheduleStatus.Booked) {
      if (!endTime) {
        throw new ErrorWithStatus({
          message: 'For booked status, endTime is required.',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
      const diffMs = endTime.getTime() - startTime.getTime()
      const maxDurationMs = 2 * 60 * 60 * 1000 // 2 tiếng tính bằng ms
      if (diffMs > maxDurationMs) {
        throw new ErrorWithStatus({
          message: 'For booked status, the maximum duration is 2 hours.',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
    }

    // Nếu không có endTime (ví dụ: trạng thái "in use"), sử dụng effectiveNewEndTime là một giá trị xa trong tương lai
    const effectiveNewEndTime = endTime || new Date('9999-12-31T23:59:59.999Z')

    // Kiểm tra event trùng lặp:
    // Truy vấn các event có cùng roomId và có khoảng thời gian giao nhau với event mới.
    const overlap = await databaseService.roomSchedule.findOne({
      roomId: new ObjectId(schedule.roomId),
      $or: [
        {
          // Điều kiện cho event có endTime xác định: bắt đầu trước effectiveNewEndTime và kết thúc sau startTime
          startTime: { $lt: effectiveNewEndTime },
          endTime: { $gt: startTime }
        },
        {
          // Nếu event hiện tại chưa có endTime (đang "in use"), coi như luôn giao nhau nếu bắt đầu trước effectiveNewEndTime
          endTime: null,
          startTime: { $lt: effectiveNewEndTime }
        }
      ]
    })

    if (overlap) {
      // Nếu tìm thấy event giao nhau, ném lỗi để thông báo không được tạo event mới
      throw new ErrorWithStatus({
        message: 'An overlapping event exists for the room.',
        status: HTTP_STATUS_CODE.CONFLICT
      })
    }

    // Nếu không có overlap, tiến hành tạo event mới
    const scheduleData = new RoomSchedule(
      schedule.roomId,
      startTime,
      schedule.status,
      endTime,
      schedule.createdBy || 'system'
    )

    const result = await databaseService.roomSchedule.insertOne(scheduleData)
    return result.insertedId
  }

  /**
   * Cập nhật event lịch phòng
   * @param id - RoomSchedule id
   * @param schedule - Đối tượng lịch phòng cần cập nhật {IRoomScheduleRequestBody}
   * @returns Số lượng bản ghi được cập nhật
   */
  async updateSchedule(id: string, schedule: IRoomScheduleRequestBody) {
    const updateData: any = {}

    if (schedule.startTime) {
      updateData.startTime = new Date(schedule.startTime)
    }
    if (schedule.endTime !== undefined) {
      updateData.endTime = schedule.endTime ? new Date(schedule.endTime) : null
    }
    if (schedule.status) {
      updateData.status = schedule.status
    }
    // Có thể cập nhật thêm thông tin audit như updatedBy nếu cần
    updateData.updatedAt = new Date()
    if (schedule.updatedBy) {
      updateData.updatedBy = schedule.updatedBy
    }

    const result = await databaseService.roomSchedule.updateOne({ _id: new ObjectId(id) }, { $set: updateData })
    return result.modifiedCount
  }

  /**
   * Hủy event lịch phòng: chỉ cho phép nếu event hiện tại đang ở trạng thái "booked"
   * @param id - RoomSchedule id
   * @returns Số lượng bản ghi được cập nhật
   */
  async cancelSchedule(id: string) {
    // Lấy event hiện tại theo id
    const currentEvent = await databaseService.roomSchedule.findOne({ _id: new ObjectId(id) })
    if (!currentEvent) {
      throw new ErrorWithStatus({
        message: 'Event not found',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    // Kiểm tra trạng thái hiện tại
    if (currentEvent.status !== RoomScheduleStatus.Booked) {
      throw new ErrorWithStatus({
        message: 'Only events in "booked" status can be cancelled',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }
    const updateData = {
      status: RoomScheduleStatus.Cancelled,
      updatedAt: new Date(),
      updatedBy: 'system' // hoặc từ req.userId nếu có
    }
    const result = await databaseService.roomSchedule.updateOne({ _id: new ObjectId(id) }, { $set: updateData })
    return result.modifiedCount
  }

  /**
   * Hàm tự động hủy các booking có trạng thái "booked" mà đã vượt quá 15 phút kể từ startTime.
   * Nó sẽ tìm các booking thoả điều kiện và cập nhật status thành "cancelled".
   */
  async autoCancelLateBookings(): Promise<void> {
    try {
      const now = new Date()
      // Tính thời gian 15 phút trước thời điểm hiện tại
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)

      // Tìm các booking với status "booked" mà startTime <= fifteenMinutesAgo
      const lateBookings = await databaseService.roomSchedule
        .find({
          status: RoomScheduleStatus.Booked,
          startTime: { $lte: fifteenMinutesAgo }
        })
        .toArray()

      // Với mỗi booking vượt hạn, cập nhật trạng thái thành "cancelled"
      for (const booking of lateBookings) {
        await databaseService.roomSchedule.updateOne(
          { _id: booking._id },
          { $set: { status: RoomScheduleStatus.Cancelled, updatedAt: new Date() } }
        )
        console.log(`Booking ${booking._id} cancelled automatically.`)
        // (Optional) Emit event hoặc thông báo đến client nếu cần
      }
    } catch (error) {
      console.error('Error in autoCancelLateBookings:', error)
    }
  }
}

export const roomScheduleService = new RoomScheduleService()
