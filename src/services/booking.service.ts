import { ObjectId } from 'mongodb'
import { RoomScheduleStatus, RoomType } from '~/constants/enum'
import { RoomSchedule } from '~/models/schemas/RoomSchdedule.schema'
import databaseService from './database.service'
import { roomScheduleService } from './roomSchedule.service'
import { ErrorWithStatus } from '~/models/Error'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

// Định nghĩa interface cho booking từ client
interface IClientBooking {
  _id?: string // ID dạng string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  room_type: string // 'small', 'medium', 'large'
  booking_date: string // YYYY-MM-DD
  time_slots: string[] // ['17:00-18:00', '18:00-19:00']
  status: string // 'pending'
  total_price: number
  created_at: string
}

class BookingService {
  /**
   * Chuyển đổi booking của client thành các RoomSchedule entries
   * @param clientBooking - Thông tin booking từ client
   */
  async convertClientBookingToRoomSchedule(clientBooking: IClientBooking) {
    try {
      // 1. Tìm roomId phù hợp với room_type
      const roomType = this.mapClientRoomTypeToEnum(clientBooking.room_type)
      const room = await databaseService.rooms.findOne({ roomType })

      if (!room) {
        throw new ErrorWithStatus({
          message: `No available room found for type: ${clientBooking.room_type}`,
          status: HTTP_STATUS_CODE.NOT_FOUND
        })
      }

      // Mảng kết quả chứa các ID của room schedules đã tạo
      const createdScheduleIds: ObjectId[] = []

      // 2. Tạo các room schedules cho từng time slot
      for (const timeSlot of clientBooking.time_slots) {
        const [startTimeStr, endTimeStr] = timeSlot.split('-')

        // Tạo đối tượng ngày-giờ cho startTime và endTime
        const timeZone = 'Asia/Ho_Chi_Minh'
        const bookingDate = clientBooking.booking_date // YYYY-MM-DD

        const startTime = dayjs.tz(`${bookingDate} ${startTimeStr}`, 'YYYY-MM-DD HH:mm', timeZone).toDate()
        const endTime = dayjs.tz(`${bookingDate} ${endTimeStr}`, 'YYYY-MM-DD HH:mm', timeZone).toDate()

        // Tạo đối tượng RoomSchedule mới
        const scheduleData = {
          roomId: room._id.toString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          status: RoomScheduleStatus.Booked,
          note: `Booking by ${clientBooking.customer_name} (${clientBooking.customer_phone})`
        }

        // Lưu RoomSchedule vào database
        try {
          const scheduleId = await roomScheduleService.createSchedule(scheduleData)
          createdScheduleIds.push(scheduleId)
        } catch (error) {
          // Nếu có lỗi khi tạo lịch (ví dụ: trùng lịch), log lỗi và tiếp tục
          console.error(`Failed to create schedule for time slot ${timeSlot}:`, error)
          throw error // Ném lỗi để xử lý ở controller
        }
      }

      // 3. Cập nhật trạng thái booking trong collection bookings nếu có _id
      if (clientBooking._id) {
        // Cập nhật trực tiếp với _id dạng string
        await databaseService.bookings.updateOne(
          { _id: clientBooking._id },
          {
            $set: {
              status: 'confirmed',
              room_schedules: createdScheduleIds.map((id) => id.toString())
            }
          }
        )
      }

      return createdScheduleIds
    } catch (error) {
      console.error('Error converting client booking to room schedule:', error)
      throw error
    }
  }

  /**
   * Chuyển đổi room_type của client sang RoomType enum
   */
  private mapClientRoomTypeToEnum(clientRoomType: string): RoomType {
    switch (clientRoomType.toLowerCase()) {
      case 'small':
        return RoomType.Small
      case 'medium':
        return RoomType.Medium
      case 'large':
        return RoomType.Large
      default:
        throw new ErrorWithStatus({
          message: `Invalid room type: ${clientRoomType}`,
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
    }
  }
}

export const bookingService = new BookingService()
