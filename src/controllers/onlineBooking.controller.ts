import { Request, Response, NextFunction } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { onlineBookingService } from '~/services/onlineBooking.service'

/**
 * @description Tạo booking online với tự động nâng cấp phòng
 * @path /api/bookings/online
 * @method POST
 */
export const createOnlineBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerName, customerPhone, customerEmail, roomType, startTime, endTime, note } = req.body

    // Validate required fields
    if (!customerName || !customerPhone || !roomType || !startTime || !endTime) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing required fields: customerName, customerPhone, roomType, startTime, endTime'
      })
    }

    const bookingRequest = {
      customerName,
      customerPhone,
      customerEmail,
      roomType,
      startTime,
      endTime,
      note
    }

    const result = await onlineBookingService.createOnlineBooking(bookingRequest)

    res.status(HTTP_STATUS_CODE.CREATED).json(result)
  } catch (error) {
    next(error)
  }
}

/**
 * @description Tra cứu booking bằng số điện thoại
 * @path /api/bookings/lookup
 * @method GET
 * @query phone: số điện thoại
 */
export const lookupBookingByPhone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query

    if (!phone || typeof phone !== 'string') {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Phone number is required'
      })
    }

    const result = await onlineBookingService.lookupBookingByPhone(phone)

    res.status(HTTP_STATUS_CODE.OK).json(result)
  } catch (error) {
    next(error)
  }
}

/**
 * @description Hủy booking
 * @path /api/bookings/:bookingId/cancel
 * @method PUT
 */
export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.params
    const { phone } = req.body

    if (!phone) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Phone number is required for verification'
      })
    }

    const result = await onlineBookingService.cancelBooking(bookingId, phone)

    res.status(HTTP_STATUS_CODE.OK).json(result)
  } catch (error) {
    next(error)
  }
}

/**
 * @description Kiểm tra phòng trống theo thời gian
 * @path /api/rooms/availability-check
 * @method GET
 * @query startTime, endTime, roomType
 */
export const checkRoomAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startTime, endTime, roomType } = req.query

    if (!startTime || !endTime || !roomType) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Missing required query parameters: startTime, endTime, roomType'
      })
    }

    // TODO: Implement room availability check
    // This would be useful for frontend to check availability before booking

    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      message: 'Room availability check endpoint - to be implemented'
    })
  } catch (error) {
    next(error)
  }
}
