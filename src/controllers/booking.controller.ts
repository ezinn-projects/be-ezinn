import { NextFunction, Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { bookingService } from '~/services/booking.service'
import databaseService from '~/services/database.service'
import { ObjectId } from 'mongodb'
import { roomScheduleService } from '~/services/roomSchedule.service'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { RoomScheduleStatus, RoomStatus, RoomType } from '~/constants/enum'
import { RoomSchedule, BookingSource } from '~/models/schemas/RoomSchdedule.schema'

dayjs.extend(utc)
dayjs.extend(timezone)

// Danh sách các phòng bị khóa (không cho phép đặt)
const LOCKED_ROOM_IDS = [
  '67d909235909b1b3b0c0ab34', // Phòng 2
  '67d909465909b1b3b0c0ab37' // Phòng 4
]

/**
 * @description Get all pending bookings that need to be converted to room schedules
 * @path /api/bookings/pending
 * @method GET
 */
export const getPendingBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingBookings = await databaseService.bookings.find({ status: 'pending' }).toArray()
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get pending bookings successfully',
      result: pendingBookings
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Convert a pending booking to room schedules
 * @path /api/bookings/:id/convert
 * @method POST
 */
export const convertBookingToRoomSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = req.params.id

    // Tìm booking cần chuyển đổi
    // Sử dụng _id dạng string để khớp với định nghĩa trong IClientBooking
    const booking = await databaseService.bookings.findOne({ _id: bookingId })

    if (!booking) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'Booking not found'
      })
    }

    if (booking.status !== 'pending') {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Only pending bookings can be converted'
      })
    }

    // Chuyển đổi booking thành room schedules
    const createdScheduleIds = await bookingService.convertClientBookingToRoomSchedule(booking)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Booking converted to room schedules successfully',
      result: {
        booking_id: bookingId,
        schedule_ids: createdScheduleIds
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Automatically convert all pending bookings to room schedules
 * @path /api/bookings/convert-all
 * @method POST
 */
export const convertAllPendingBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingBookings = await databaseService.bookings.find({ status: 'pending' }).toArray()

    if (pendingBookings.length === 0) {
      return res.status(HTTP_STATUS_CODE.OK).json({
        message: 'No pending bookings to convert'
      })
    }

    const results = []

    for (const booking of pendingBookings) {
      try {
        const scheduleIds = await bookingService.convertClientBookingToRoomSchedule(booking)
        results.push({
          booking_id: booking._id,
          success: true,
          schedule_ids: scheduleIds
        })
      } catch (error) {
        results.push({
          booking_id: booking._id,
          success: false,
          error: (error as Error).message
        })
      }
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Processed all pending bookings',
      result: results
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Tạo booking mới từ client và tự động chuyển đổi thành room schedules
 * @path /api/bookings
 * @method POST
 */
export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body

    // Validate dữ liệu
    if (
      !body.customer_name ||
      !body.customer_phone ||
      !body.room_type ||
      !body.booking_date ||
      !body.time_slots ||
      !body.time_slots.length
    ) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Missing required fields'
      })
    }

    // Tạo booking mới với status pending
    const bookingData = {
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email || null,
      room_type: body.room_type,
      booking_date: body.booking_date,
      time_slots: body.time_slots,
      status: 'pending',
      total_price: body.total_price || 0,
      created_at: new Date().toISOString()
    }

    // Lưu booking vào DB
    const result = await databaseService.bookings.insertOne(bookingData)
    const bookingId = result.insertedId

    // Tạo mảng chứa các room schedule đã tạo
    const createdScheduleIds: ObjectId[] = []
    const timeZone = 'Asia/Ho_Chi_Minh'

    try {
      // Tìm tất cả các phòng phù hợp với room_type hoặc phòng có sẵn
      let room = null

      // Nếu có room_type cụ thể, ưu tiên tìm phòng theo room_type
      if (body.room_type) {
        try {
          // Cố gắng ánh xạ room_type sang RoomType enum
          const roomType = mapRoomType(body.room_type)

          // Tìm phòng phù hợp với room_type nhưng không nằm trong danh sách phòng bị khóa
          const rooms = await databaseService.rooms.find({ roomType }).toArray()

          // Lọc ra các phòng không nằm trong danh sách bị khóa
          const availableRooms = rooms.filter((r) => !LOCKED_ROOM_IDS.includes(r._id.toString()))

          if (availableRooms.length > 0) {
            room = availableRooms[0] // Lấy phòng đầu tiên trong danh sách có sẵn
          }
        } catch (error) {
          console.log('Không tìm thấy phòng phù hợp với room_type:', body.room_type)
        }
      }

      // Nếu không tìm thấy phòng theo room_type, lấy bất kỳ phòng nào đang available
      // và không nằm trong danh sách phòng bị khóa
      if (!room) {
        const availableRooms = await databaseService.rooms.find({ status: RoomStatus.Available }).toArray()

        // Lọc ra các phòng không nằm trong danh sách bị khóa
        const unlockedRooms = availableRooms.filter((r) => !LOCKED_ROOM_IDS.includes(r._id.toString()))

        if (unlockedRooms.length > 0) {
          room = unlockedRooms[0]
        } else {
          // Không tìm thấy phòng nào phù hợp và không bị khóa
          throw new Error('Không tìm thấy phòng phù hợp không bị khóa. Vui lòng thử lại sau.')
        }
      }

      // Tạo các room schedules cho từng time slot
      for (const timeSlot of body.time_slots) {
        const [startTimeStr, endTimeStr] = timeSlot.split('-')

        // Tạo đối tượng ngày-giờ cho startTime và endTime
        const bookingDate = body.booking_date // YYYY-MM-DD

        const startTime = dayjs.tz(`${bookingDate} ${startTimeStr}`, 'YYYY-MM-DD HH:mm', timeZone).toDate()
        const endTime = dayjs.tz(`${bookingDate} ${endTimeStr}`, 'YYYY-MM-DD HH:mm', timeZone).toDate()

        // Kiểm tra xem time slot đã được đặt chưa
        const existingSchedule = await databaseService.roomSchedule.findOne({
          roomId: room._id,
          status: { $nin: [RoomScheduleStatus.Cancelled, RoomScheduleStatus.Finished] },
          $or: [
            {
              startTime: { $lt: endTime },
              endTime: { $gt: startTime }
            },
            {
              endTime: null,
              startTime: { $lt: endTime }
            }
          ]
        })

        if (existingSchedule) {
          throw new Error(`Time slot ${timeSlot} is already booked for this room`)
        }

        const scheduleData = new RoomSchedule(
          room._id.toString(),
          startTime,
          RoomScheduleStatus.Booked,
          endTime,
          'web_customer',
          'web_customer',
          `Booking by ${body.customer_name} (${body.customer_phone})`,
          BookingSource.Customer
        )

        // Lưu room schedule vào database
        const insertResult = await databaseService.roomSchedule.insertOne(scheduleData)
        createdScheduleIds.push(insertResult.insertedId)
      }

      // Cập nhật booking với trạng thái confirmed và các room_schedules đã tạo
      await databaseService.bookings.updateOne(
        { _id: bookingId },
        {
          $set: {
            status: 'confirmed',
            room_schedules: createdScheduleIds.map((id) => id.toString())
          }
        }
      )

      return res.status(HTTP_STATUS_CODE.CREATED).json({
        message: 'Booking created and converted to room schedules successfully',
        result: {
          booking_id: bookingId,
          room_id: room._id,
          room_name: room.roomName,
          schedule_ids: createdScheduleIds,
          customer_name: body.customer_name,
          customer_phone: body.customer_phone,
          booking_date: body.booking_date,
          time_slots: body.time_slots
        }
      })
    } catch (error: any) {
      // Nếu có lỗi khi chuyển đổi, vẫn giữ booking ở trạng thái pending
      console.error('Error converting booking to schedules:', error)

      return res.status(HTTP_STATUS_CODE.OK).json({
        message: 'Booking created but could not be converted to room schedules: ' + error.message,
        result: {
          booking_id: bookingId,
          status: 'pending',
          error: error.message
        }
      })
    }
  } catch (error) {
    next(error)
  }
}

// Hàm hỗ trợ ánh xạ room_type từ client sang RoomType enum
function mapRoomType(clientRoomType: string) {
  switch (clientRoomType.toLowerCase()) {
    case 'small':
      return RoomType.Small
    case 'medium':
      return RoomType.Medium
    case 'large':
      return RoomType.Large
    default:
      throw new Error(`Invalid room type: ${clientRoomType}`)
  }
}
