import { ObjectId } from 'mongodb'
// import { IRoomScheduleRequestBody, IRoomScheduleRequestQuery } from '~/models/requests/RoomSchedule.request'
import dayjs from 'dayjs'
import { RoomScheduleStatus } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'
import { IRoomScheduleRequestBody, IRoomScheduleRequestQuery } from '~/models/requests/RoomSchedule.request'
import { RoomSchedule } from '~/models/schemas/RoomSchdedule.schema'
import databaseService from './database.service'
import { parseDate } from '~/utils/common'

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
  async getSchedules(filter: IRoomScheduleRequestQuery): Promise<RoomSchedule[]> {
    const query: {
      roomId?: ObjectId
      startTime?: { $gte: Date; $lt: Date }
      status?: RoomSchedule['status']
    } = {}

    if (filter.roomId) {
      query.roomId = new ObjectId(filter.roomId)
    }

    if (filter.date) {
      const timeZone = 'Asia/Ho_Chi_Minh'
      // FE truyền "2025-03-15T17:00:00.000Z" đại diện cho 00:00 ngày 16 theo giờ Việt Nam,
      // vì vậy ta tạo đối tượng dayjs từ UTC rồi chuyển sang múi giờ Việt Nam.
      const localDate = dayjs.utc(filter.date).tz(timeZone)
      const startOfDay = localDate.startOf('day').utc().toDate() // 00:00 ngày 16 VN → UTC: 2025-03-15T17:00:00.000Z
      const endOfDay = localDate.endOf('day').utc().toDate() // 23:59:59.999 ngày 16 VN → UTC: 2025-03-16T16:59:59.999Z
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
   * Validate thời gian cho lịch phòng.
   * Đối với trạng thái "Booked":
   * - Bắt buộc phải có endTime.
   * - endTime phải lớn hơn startTime.
   * - Khoảng cách giữa startTime và endTime không vượt quá 2 tiếng.
   *
   * @param schedule - Đối tượng lịch phòng {IRoomScheduleRequestBody}
   * @returns Một object chứa startTime và endTime (có thể null nếu không được cung cấp)
   * @throws ErrorWithStatus nếu dữ liệu không hợp lệ
   */
  private validateScheduleTimes(schedule: IRoomScheduleRequestBody): { startTime: Date; endTime: Date | null } {
    const startTime = parseDate(schedule.startTime)
    const endTime = schedule.endTime ? parseDate(schedule.endTime) : null

    if (schedule.status === RoomScheduleStatus.Booked) {
      if (!endTime) {
        throw new ErrorWithStatus({
          message: 'For booked status, endTime is required.',
          status: HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY
        })
      }
      if (endTime.getTime() <= startTime.getTime()) {
        throw new ErrorWithStatus({
          message: 'endTime must be greater than startTime.',
          status: HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY
        })
      }
      const diffMs = endTime.getTime() - startTime.getTime()
      const maxDurationMs = 8 * 60 * 60 * 1000 // 8 tiếng
      if (diffMs > maxDurationMs) {
        throw new ErrorWithStatus({
          message: 'For booked status, the maximum duration is 8 hours.',
          status: HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY
        })
      }
    }
    return { startTime, endTime }
  }

  /**
   * Tạo mới một event lịch phòng
   * @param schedule - Đối tượng lịch phòng {IRoomScheduleRequestBody}
   * @returns id của lịch phòng vừa tạo
   */
  async createSchedule(schedule: IRoomScheduleRequestBody) {
    // Validate và parse startTime, endTime dựa trên nghiệp vụ
    const { startTime, endTime } = this.validateScheduleTimes(schedule)

    const now = new Date()

    // Cho phép tạo lịch trong khoảng 5 phút trước thời điểm hiện tại
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    if (startTime.getTime() < fiveMinutesAgo.getTime()) {
      throw new ErrorWithStatus({
        message: 'Cannot create a schedule more than 5 minutes in the past.',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Nếu không có endTime (ví dụ: trạng thái "in use"), sử dụng effectiveNewEndTime là một giá trị xa trong tương lai
    const effectiveNewEndTime = endTime || new Date('9999-12-31T23:59:59.999Z')

    // Kiểm tra event trùng lặp:
    // Truy vấn các event có cùng roomId và có khoảng thời gian giao nhau với event mới.
    // Lưu ý: Loại trừ những event có trạng thái "cancelled" hoặc "finished"
    const overlap = await databaseService.roomSchedule.findOne({
      roomId: new ObjectId(schedule.roomId),
      status: { $nin: [RoomScheduleStatus.Cancelled, RoomScheduleStatus.Finished] },
      $or: [
        {
          // Nếu event có endTime xác định: bắt đầu trước effectiveNewEndTime và kết thúc sau startTime
          startTime: { $lt: effectiveNewEndTime },
          endTime: { $gt: startTime }
        },
        {
          // Nếu event hiện tại chưa có endTime (đang "in use"): coi như luôn giao nhau nếu bắt đầu trước effectiveNewEndTime
          endTime: null,
          startTime: { $lt: effectiveNewEndTime }
        }
      ]
    })

    console.log('overlap', overlap)

    if (overlap) {
      // Kiểm tra nếu event trùng lặp có status là Finished hoặc finish, thì vẫn cho phép tạo mới
      if (overlap.status === RoomScheduleStatus.Finished) {
        // Cho phép tạo event mới nếu event trùng lặp đã kết thúc
        console.log('Allowing new event creation because overlapping event is finished')
      } else {
        // Nếu tìm thấy event giao nhau và không phải trạng thái Finished, ném lỗi
        throw new ErrorWithStatus({
          message: 'An overlapping event exists for the room.',
          status: HTTP_STATUS_CODE.CONFLICT
        })
      }
    }

    // Nếu không có overlap, tiến hành tạo event mới
    const scheduleData = new RoomSchedule(
      schedule.roomId,
      startTime,
      schedule.status,
      endTime,
      schedule.createdBy || 'system',
      schedule.updatedBy || 'system',
      schedule.note
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

  /**
   * autoFinishAllScheduleInADay
   * Finish (ho  c cancel) tất c  event c  trạng thái "booked" v  "ongoing" trong ng y
   */
  async autoFinishAllScheduleInADay(): Promise<void> {
    try {
      const now = new Date()
      // Tính điểm kết thúc của ngày hôm đó (ngày mai lúc 00:00)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

      // Cập nhật tất cả các event có startTime nhỏ hơn endOfDay và status là một trong các trạng thái cần tổng kết
      // Ví dụ: tổng kết các trạng thái "Booked", "Ongoing", "Locked", "Maintenance" thành "Finished"
      const result = await databaseService.roomSchedule.updateMany(
        {
          startTime: { $lt: endOfDay },
          status: {
            $in: [
              RoomScheduleStatus.Booked,
              RoomScheduleStatus.InUse,
              RoomScheduleStatus.Locked,
              RoomScheduleStatus.Maintenance
            ]
          }
        },
        { $set: { status: RoomScheduleStatus.Finished, updatedAt: new Date() } }
      )

      console.log(`${result.modifiedCount} events finished automatically.`)
      // (Optional) Emit event hoặc gửi thông báo tới client nếu cần
    } catch (error) {
      console.error('Error in autoFinishAllScheduleInADay:', error)
    }
  }
}

export const roomScheduleService = new RoomScheduleService()
