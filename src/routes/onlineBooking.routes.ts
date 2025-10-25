import express from 'express'
import {
  createOnlineBooking,
  lookupBookingByPhone,
  cancelBooking,
  updateQueueSongs,
  removeSongFromQueue,
  checkRoomAvailability
} from '~/controllers/onlineBooking.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const onlineBookingRouter = express.Router()

/**
 * @description Tạo booking online với tự động nâng cấp phòng
 * @path /api/bookings/online
 * @method POST
 */
onlineBookingRouter.post('/online', wrapRequestHandler(createOnlineBooking))

/**
 * @description Tra cứu booking bằng số điện thoại
 * @path /api/bookings/lookup
 * @method GET
 * @query phone: số điện thoại
 */
onlineBookingRouter.get('/lookup', wrapRequestHandler(lookupBookingByPhone))

/**
 * @description Hủy booking
 * @path /api/bookings/:bookingId/cancel
 * @method PUT
 */
onlineBookingRouter.put('/:bookingId/cancel', wrapRequestHandler(cancelBooking))

/**
 * @description Thêm bài hát vào queue songs của booking
 * @path /api/bookings/:bookingId/queue-songs
 * @method PUT
 */
onlineBookingRouter.put('/:bookingId/queue-songs', wrapRequestHandler(updateQueueSongs))

/**
 * @description Xóa bài hát khỏi queue songs của booking theo index
 * @path /api/bookings/:bookingId/queue-songs/:index
 * @method DELETE
 */
onlineBookingRouter.delete('/:bookingId/queue-songs/:index', wrapRequestHandler(removeSongFromQueue))

/**
 * @description Kiểm tra phòng trống theo thời gian
 * @path /api/rooms/availability-check
 * @method GET
 * @query startTime, endTime, roomType
 */
onlineBookingRouter.get('/availability-check', wrapRequestHandler(checkRoomAvailability))

export default onlineBookingRouter
