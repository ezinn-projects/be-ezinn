import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  adminCreateSchedule,
  approveSchedule,
  createSchedule,
  deleteSchedule,
  getAllSchedules,
  getMySchedules,
  getScheduleById,
  markAbsent,
  markCompleted,
  updateSchedule,
  updateScheduleStatus
} from '~/controllers/employeeSchedule.controller'
import { protect } from '~/middlewares/auth.middleware'
import {
  adminCreateScheduleValidator,
  approveScheduleValidator,
  checkCanApprove,
  checkCanModifySchedule,
  checkScheduleExists,
  checkScheduleOwnership,
  createEmployeeScheduleValidator,
  updateScheduleValidator,
  updateStatusValidator
} from '~/middlewares/employeeSchedule.middleware'

const employeeScheduleRouter = Router()

/**
 * @route   POST /api/employee-schedules
 * @desc    Nhân viên tự đăng ký lịch (Staff, Admin)
 * @access  Private (Staff, Admin)
 */
employeeScheduleRouter.post(
  '/',
  protect([UserRole.Staff, UserRole.Admin]),
  createEmployeeScheduleValidator,
  createSchedule
)

/**
 * @route   POST /api/employee-schedules/admin
 * @desc    Admin đăng ký lịch cho nhân viên
 * @access  Private (Admin only)
 */
employeeScheduleRouter.post('/admin', protect([UserRole.Admin]), adminCreateScheduleValidator, adminCreateSchedule)

/**
 * @route   GET /api/employee-schedules/me
 * @desc    Nhân viên xem lịch của mình
 * @access  Private (Staff, Admin)
 */
employeeScheduleRouter.get('/me', protect([UserRole.Staff, UserRole.Admin]), getMySchedules)

/**
 * @route   GET /api/employee-schedules
 * @desc    Admin xem tất cả lịch (có thể filter)
 * @access  Private (Admin only)
 */
employeeScheduleRouter.get('/', protect([UserRole.Admin]), getAllSchedules)

/**
 * @route   GET /api/employee-schedules/:id
 * @desc    Xem chi tiết lịch (check ownership)
 * @access  Private (Staff, Admin)
 */
employeeScheduleRouter.get(
  '/:id',
  protect([UserRole.Staff, UserRole.Admin]),
  checkScheduleExists,
  checkScheduleOwnership,
  getScheduleById
)

/**
 * @route   PUT /api/employee-schedules/:id
 * @desc    Cập nhật note của lịch (chỉ Pending/Rejected, check ownership)
 * @access  Private (Staff, Admin)
 */
employeeScheduleRouter.put(
  '/:id',
  protect([UserRole.Staff, UserRole.Admin]),
  checkScheduleExists,
  checkScheduleOwnership,
  checkCanModifySchedule,
  updateScheduleValidator,
  updateSchedule
)

/**
 * @route   PUT /api/employee-schedules/:id/status
 * @desc    Admin cập nhật status của lịch (unified endpoint)
 * @access  Private (Admin only)
 */
employeeScheduleRouter.put(
  '/:id/status',
  protect([UserRole.Admin]),
  checkScheduleExists,
  updateStatusValidator,
  updateScheduleStatus
)

/**
 * @route   PUT /api/employee-schedules/:id/approve
 * @desc    Admin approve/reject lịch
 * @access  Private (Admin only)
 */
employeeScheduleRouter.put(
  '/:id/approve',
  protect([UserRole.Admin]),
  checkScheduleExists,
  checkCanApprove,
  approveScheduleValidator,
  approveSchedule
)

/**
 * @route   DELETE /api/employee-schedules/:id
 * @desc    Xóa lịch (chỉ Admin mới được xóa)
 * @access  Private (Admin only)
 */
employeeScheduleRouter.delete(
  '/:id',
  protect([UserRole.Admin]),
  checkScheduleExists,
  deleteSchedule
)

/**
 * @route   PUT /api/employee-schedules/:id/mark-absent
 * @desc    Admin đánh dấu vắng mặt
 * @access  Private (Admin only)
 */
employeeScheduleRouter.put('/:id/mark-absent', protect([UserRole.Admin]), checkScheduleExists, markAbsent)

/**
 * @route   PUT /api/employee-schedules/:id/mark-completed
 * @desc    Admin đánh dấu hoàn thành (manual)
 * @access  Private (Admin only)
 */
employeeScheduleRouter.put('/:id/mark-completed', protect([UserRole.Admin]), checkScheduleExists, markCompleted)

export default employeeScheduleRouter
