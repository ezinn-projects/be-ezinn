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
import { emitBookingNotification } from './room.service'
import { LOCKED_ROOM_IDS } from '~/controllers/booking.controller'

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
  async convertClientBookingToRoomSchedule(clientBooking: IClientBooking): Promise<string[]> {
    console.log('Starting conversion of booking to room schedule:', clientBooking._id)

    try {
      // Validate time slots before processing
      for (const timeSlot of clientBooking.time_slots) {
        const [startTimeStr, endTimeStr] = timeSlot.split('-')
        const startTime = dayjs.tz(
          `${clientBooking.booking_date} ${startTimeStr}`,
          'YYYY-MM-DD HH:mm',
          'Asia/Ho_Chi_Minh'
        )
        const endTime = dayjs.tz(`${clientBooking.booking_date} ${endTimeStr}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')

        // Calculate duration in milliseconds
        const diffMs = endTime.diff(startTime)
        const minDurationMs = 30 * 60 * 1000 // 30 minutes in milliseconds

        // Validate minimum duration
        if (diffMs < minDurationMs) {
          throw new ErrorWithStatus({
            message: `Booking duration must be at least 30 minutes. Invalid time slot: ${timeSlot}`,
            status: HTTP_STATUS_CODE.UNPROCESSABLE_ENTITY
          })
        }
      }

      // Kiểm tra xem booking này đã được chuyển đổi thành công trước đó chưa
      if (clientBooking._id) {
        const existingBooking = await databaseService.bookings.findOne({
          _id: clientBooking._id,
          status: 'confirmed' // Nếu status là confirmed thì đã được xử lý
        })

        if (existingBooking && existingBooking.room_schedules && existingBooking.room_schedules.length > 0) {
          console.log(
            `Booking ${clientBooking._id} đã được chuyển đổi trước đó, trả về room schedules đã tạo.`,
            existingBooking.room_schedules
          )
          return existingBooking.room_schedules
        }

        // Kiểm tra xem đã có room schedule cho booking này chưa
        const existingSchedules = await databaseService.roomSchedule
          .find({
            note: { $regex: new RegExp(`Booking by ${clientBooking.customer_name}.*${clientBooking.customer_phone}`) }
          })
          .toArray()

        if (existingSchedules.length > 0) {
          console.log(`Đã tìm thấy ${existingSchedules.length} room schedule cho booking ${clientBooking._id}`)

          // Cập nhật trạng thái booking thành confirmed
          await databaseService.bookings.updateOne(
            { _id: clientBooking._id },
            {
              $set: {
                status: 'confirmed',
                room_schedules: existingSchedules.map((s) => s._id.toString())
              }
            }
          )

          return existingSchedules.map((s) => s._id.toString())
        }
      }

      // Log the booking data
      console.log('Booking details:', {
        customer: clientBooking.customer_name,
        phone: clientBooking.customer_phone,
        roomType: clientBooking.room_type,
        date: clientBooking.booking_date,
        timeSlots: clientBooking.time_slots
      })

      // 1. Tìm roomId phù hợp với room_type
      const roomType = this.mapClientRoomTypeToEnum(clientBooking.room_type)
      console.log('Mapped room type:', roomType)

      // Tìm phòng phù hợp với room_type
      let room
      try {
        // Sử dụng regex để tìm kiếm không phân biệt chữ hoa/thường
        console.log('Excluding locked rooms with IDs:', LOCKED_ROOM_IDS)

        const rooms = await databaseService.rooms
          .find({
            roomType: { $regex: new RegExp(roomType, 'i') },
            // Loại bỏ các phòng bị khóa khỏi kết quả tìm kiếm
            _id: { $nin: LOCKED_ROOM_IDS.map((id) => new ObjectId(id)) }
          })
          .toArray()
        console.log(
          `Found ${rooms.length} rooms matching room type ${roomType} (case insensitive, excluding locked rooms)`
        )

        if (rooms.length === 0) {
          throw new Error(`No available rooms found for room type: ${roomType}`)
        }

        // Kiểm tra xem phòng đã có lịch đặt chưa
        for (const candidateRoom of rooms) {
          console.log(`Checking availability for room: ${candidateRoom._id} (${candidateRoom.roomName})`)

          // Kiểm tra từng time slot
          let isRoomAvailable = true
          for (const timeSlot of clientBooking.time_slots) {
            console.log(`Checking time slot: ${timeSlot}`)

            // Chuyển đổi time slot thành startTime và endTime
            const [startTimeStr, endTimeStr] = timeSlot.split('-')
            const startTime = new Date(`${clientBooking.booking_date}T${startTimeStr}:00`)
            const endTime = new Date(`${clientBooking.booking_date}T${endTimeStr}:00`)

            console.log(`Converted time: ${startTime.toISOString()} to ${endTime.toISOString()}`)

            // Kiểm tra xem thời gian này đã được đặt chưa
            const existingSchedule = await databaseService.roomSchedule.findOne({
              roomId: candidateRoom._id,
              $or: [
                { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
                { startTime: { $lt: endTime }, endTime: null }
              ]
            })

            if (existingSchedule) {
              console.log(
                `Room ${candidateRoom.roomName} is not available for time slot ${timeSlot} - existing booking found`
              )
              isRoomAvailable = false
              break
            }
          }

          if (isRoomAvailable) {
            room = candidateRoom
            console.log(`Found available room: ${room.roomName} (${room._id})`)
            break
          }
        }

        if (!room) {
          throw new Error(`No available rooms found for room type ${roomType} at the requested time slots`)
        }
      } catch (error) {
        console.error('Error finding available room:', error)
        throw new Error(`Could not find an available room: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // After finding appropriate room
      console.log('Found room for booking:', room ? room._id : 'No room found')

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

      // After creating all schedules
      console.log(
        'Successfully created room schedules:',
        createdScheduleIds.map((id) => id.toString())
      )

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

      // After updating booking status
      console.log('Updated booking status to confirmed:', clientBooking._id)

      // Send real-time notification
      emitBookingNotification(room._id.toString(), {
        bookingId: clientBooking._id,
        customer: clientBooking.customer_name,
        phone: clientBooking.customer_phone,
        roomName: room.roomName,
        timeSlots: clientBooking.time_slots,
        bookingDate: clientBooking.booking_date,
        status: 'confirmed',
        scheduleIds: createdScheduleIds.map((id) => id.toString())
      })

      return createdScheduleIds.map((id) => id.toString())
    } catch (error) {
      console.error('Error in convertClientBookingToRoomSchedule:', error)
      throw error
    }
  }

  /**
   * Map room type string from client to enum
   * @param roomType Room type string from client
   * @returns Room type enum
   */
  private mapClientRoomTypeToEnum(roomType: string): RoomType {
    console.log('Mapping client room type:', roomType)

    // Convert to lowercase for case-insensitive comparison
    const type = roomType.toLowerCase()

    // Log all available room types in database for debugging
    databaseService.rooms.distinct('roomType').then((types) => {
      console.log('Available room types in database:', types)
    })

    // Map client room type to enum
    switch (type) {
      case 'small':
      case 'nhỏ':
      case 'nho':
        return RoomType.Small
      case 'medium':
      case 'trung bình':
      case 'trung binh':
      case 'vừa':
      case 'vua':
        return RoomType.Medium
      case 'large':
      case 'lớn':
      case 'lon':
        return RoomType.Large
      default:
        // If unknown, log it and throw error
        console.log('Unknown room type:', roomType)
        throw new Error(`Invalid room type: ${roomType}`)
    }
  }
}

export const bookingService = new BookingService()
