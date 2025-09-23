import express from 'express'
import { checkRoomAvailability, getRoomDetails } from '~/controllers/roomAvailability.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const roomAvailabilityRouter = express.Router()

/**
 * @description Kiểm tra phòng trống theo ngày và loại phòng
 * @path /api/rooms/availability
 * @method GET
 * @query date: YYYY-MM-DD, roomType?: Small|Medium|Large
 */
roomAvailabilityRouter.get('/availability', wrapRequestHandler(checkRoomAvailability))

/**
 * @description Lấy thông tin chi tiết một phòng
 * @path /api/rooms/:roomId/details
 * @method GET
 */
roomAvailabilityRouter.get('/:roomId/details', wrapRequestHandler(getRoomDetails))

export default roomAvailabilityRouter
