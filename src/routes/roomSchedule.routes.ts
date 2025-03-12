import { Router } from 'express'
import {
  cancelSchedule,
  createSchedule,
  getSchedules,
  getSchedulesByRoom,
  updateSchedule
} from '~/controllers/roomSchedule.controller'
import { wrapRequestHanlder } from '~/utils/handlers'
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
roomScheduleRouter.get('/', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHanlder(getSchedules))

// API endpoint lấy lịch phòng của một phòng cụ thể
roomScheduleRouter.get(
  '/:roomId',
  protect([UserRole.Admin, UserRole.Staff]),
  getSchedulesByRoomValidator,
  wrapRequestHanlder(getSchedulesByRoom)
)

// API endpoint tạo lịch phòng
roomScheduleRouter.post(
  '/',
  protect([UserRole.Admin, UserRole.Staff]),
  createScheduleValidator,
  wrapRequestHanlder(createSchedule)
)

// API endpoint cập nhật lịch phòng
roomScheduleRouter.put(
  '/:id',
  protect([UserRole.Admin, UserRole.Staff]),
  updateScheduleValidator,
  wrapRequestHanlder(updateSchedule)
)

// API endpoint hủy lịch phòng
roomScheduleRouter.put(
  '/:id/cancel',
  protect([UserRole.Admin, UserRole.Staff]),
  updateScheduleValidator,
  wrapRequestHanlder(cancelSchedule)
)

export default roomScheduleRouter
