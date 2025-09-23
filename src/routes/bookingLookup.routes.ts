import express from 'express'
import {
  lookupBookingByPhone,
  cancelBooking,
  modifyBooking,
  searchBookings
} from '~/controllers/bookingLookup.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const bookingLookupRouter = express.Router()

/**
 * @description Search bookings by phone number with proper sorting
 * @path /api/bookings/search
 * @method GET
 * @query phone: số điện thoại
 */
bookingLookupRouter.get('/search', wrapRequestHandler(searchBookings))

/**
 * @description Tra cứu booking bằng số điện thoại
 * @path /api/bookings/lookup
 * @method GET
 * @query phone: số điện thoại
 */
bookingLookupRouter.get('/lookup', wrapRequestHandler(lookupBookingByPhone))

/**
 * @description Hủy booking
 * @path /api/bookings/:bookingId/cancel
 * @method PUT
 */
bookingLookupRouter.put('/:bookingId/cancel', wrapRequestHandler(cancelBooking))

/**
 * @description Chỉnh sửa booking
 * @path /api/bookings/:bookingId/modify
 * @method PUT
 */
bookingLookupRouter.put('/:bookingId/modify', wrapRequestHandler(modifyBooking))

export default bookingLookupRouter
