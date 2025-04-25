import express from 'express'
import {
  convertAllPendingBookings,
  convertBookingToRoomSchedule,
  createBooking,
  getPendingBookings
} from '~/controllers/booking.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const bookingRouter = express.Router()

/**
 * @description Tạo booking mới và tự động chuyển đổi thành room schedules
 * @path /api/bookings
 * @method POST
 */
bookingRouter.post('/', wrapRequestHandler(createBooking))

/**
 * @description Get all pending bookings
 * @path /api/bookings/pending
 * @method GET
 */
bookingRouter.get('/pending', wrapRequestHandler(getPendingBookings))

/**
 * @description Convert a specific booking to room schedules
 * @path /api/bookings/:id/convert
 * @method POST
 */
bookingRouter.post('/:id/convert', wrapRequestHandler(convertBookingToRoomSchedule))

/**
 * @description Convert all pending bookings to room schedules
 * @path /api/bookings/convert-all
 * @method POST
 */
bookingRouter.post('/convert-all', wrapRequestHandler(convertAllPendingBookings))

export default bookingRouter
