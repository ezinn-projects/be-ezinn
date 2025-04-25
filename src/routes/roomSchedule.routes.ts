import { Router } from 'express'
import {
  cancelSchedule,
  createSchedule,
  getSchedules,
  getSchedulesByRoom,
  updateSchedule,
  convertBookingToSchedules
} from '~/controllers/roomSchedule.controller'
import { wrapRequestHandler } from '~/utils/handlers'
import {
  createScheduleValidator,
  getSchedulesByRoomValidator,
  getSchedulesValidator,
  updateScheduleValidator
} from '~/middlewares/roomSchedule.middleware'
import { protect } from '~/middlewares/auth.middleware'
import { UserRole } from '~/constants/enum'

const roomScheduleRouter = Router()

// API endpoint lấy lịch phòng
roomScheduleRouter.get('/', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getSchedules))

// API endpoint lấy lịch phòng của một phòng cụ thể
roomScheduleRouter.get(
  '/:roomId',
  protect([UserRole.Admin, UserRole.Staff]),
  getSchedulesByRoomValidator,
  wrapRequestHandler(getSchedulesByRoom)
)

// API endpoint tạo lịch phòng
roomScheduleRouter.post(
  '/',
  protect([UserRole.Admin, UserRole.Staff]),
  createScheduleValidator,
  wrapRequestHandler(createSchedule)
)

// API endpoint cập nhật lịch phòng
roomScheduleRouter.put(
  '/:id',
  protect([UserRole.Admin, UserRole.Staff]),
  updateScheduleValidator,
  wrapRequestHandler(updateSchedule)
)

// API endpoint hủy lịch phòng
roomScheduleRouter.put(
  '/:id/cancel',
  protect([UserRole.Admin, UserRole.Staff]),
  updateScheduleValidator,
  wrapRequestHandler(cancelSchedule)
)

/**
 * @description Chuyển đổi booking sang room schedules
 * @path /convert-booking/:id
 * @method POST
 */
roomScheduleRouter.post('/convert-booking/:id', wrapRequestHandler(convertBookingToSchedules))

export default roomScheduleRouter
