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
import { emitBookingNotification } from '~/services/room.service'

dayjs.extend(utc)
dayjs.extend(timezone)

// Danh sách các phòng bị khóa (không cho phép đặt)
export const LOCKED_ROOM_IDS = [
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
    // Chuyển đổi ObjectId sang string để phù hợp với định nghĩa IClientBooking
    const bookingWithStringId = {
      ...booking,
      _id: booking._id.toString()
    }
    const createdScheduleIds = await bookingService.convertClientBookingToRoomSchedule(bookingWithStringId)

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
        // Convert booking to have string _id to match IClientBooking type
        const bookingWithStringId = {
          ...booking,
          _id: booking._id.toString()
        }
        const scheduleIds = await bookingService.convertClientBookingToRoomSchedule(bookingWithStringId)
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

    // Nếu client đã chỉ định rõ phòng cụ thể thay vì chỉ yêu cầu loại phòng
    if (body.room_id) {
      // Kiểm tra xem phòng có nằm trong danh sách khóa không
      if (LOCKED_ROOM_IDS.includes(body.room_id)) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          message: 'This room is not available for booking',
          error: 'ROOM_LOCKED'
        })
      }
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

    // Cố gắng chuyển đổi booking ngay lập tức
    try {
      // Lấy booking vừa tạo
      const booking = await databaseService.bookings.findOne({ _id: bookingId })
      if (booking) {
        console.log('Found booking to convert:', bookingId)

        // Chuyển đổi _id từ ObjectId sang string để phù hợp với định nghĩa IClientBooking
        const bookingWithStringId = {
          ...booking,
          _id: booking._id.toString()
        }

        console.log('Attempting to convert booking to room schedules...')

        // Chuyển đổi booking thành room schedules
        const scheduleIds = await bookingService.convertClientBookingToRoomSchedule(bookingWithStringId)

        console.log('Conversion successful, created schedule IDs:', scheduleIds)

        // Trả về kết quả thành công
        return res.status(HTTP_STATUS_CODE.CREATED).json({
          message: 'Booking created and automatically converted to room schedules successfully',
          result: {
            booking_id: bookingId,
            schedule_ids: scheduleIds,
            status: 'confirmed'
          }
        })
      } else {
        console.error('Could not find the booking that was just created:', bookingId)
      }
    } catch (conversionError) {
      console.error('Error auto-converting booking:', conversionError)
      if (conversionError instanceof Error) {
        console.error('Error details:', conversionError.message)
        console.error('Error stack:', conversionError.stack)
      }

      // Send real-time notification for failed booking conversion
      try {
        // Find any room matching the room type to send notification
        // Use existing database query instead of calling private method
        const rooms = await databaseService.rooms
          .find({
            roomType: { $regex: new RegExp(body.room_type, 'i') }
          })
          .toArray()

        if (rooms && rooms.length > 0) {
          emitBookingNotification(rooms[0]._id.toString(), {
            bookingId: bookingId.toString(),
            customer: body.customer_name,
            phone: body.customer_phone,
            roomType: body.room_type,
            timeSlots: body.time_slots,
            bookingDate: body.booking_date,
            status: 'pending',
            error: conversionError instanceof Error ? conversionError.message : 'Unknown error'
          })
        }
      } catch (notificationError) {
        console.error('Error sending real-time notification:', notificationError)
      }
    }

    // Nếu không thể tự động chuyển đổi, trả về kết quả mặc định
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: 'Booking created successfully but could not be automatically converted',
      result: {
        booking_id: bookingId,
        status: 'pending'
      }
    })
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
