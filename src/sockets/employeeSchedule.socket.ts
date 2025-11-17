import { Server, Socket } from 'socket.io'
import { employeeScheduleEventEmitter } from '~/services/employeeSchedule.service'
import { getShiftInfo } from '~/constants/shiftDefaults'
import { IEmployeeSchedule } from '~/models/schemas/EmployeeSchedule.schema'

export const EmployeeScheduleSocket = (io: Server) => {
  // Listen for schedule created events
  employeeScheduleEventEmitter.on('schedule_created', ({ userId, schedules, type }) => {
    if (type === 'employee_register') {
      // Nhân viên đăng ký ca → notify admin
      const schedulesWithInfo = schedules.map((schedule: IEmployeeSchedule) => ({
        ...schedule,
        shiftInfo: getShiftInfo(schedule.shiftType, schedule.customStartTime, schedule.customEndTime)
      }))

      io.to('admin').emit('new_schedule_registration', {
        userId,
        schedules: schedulesWithInfo,
        message: 'Có nhân viên đăng ký ca mới'
      })
    } else if (type === 'admin_create') {
      // Admin tạo ca cho nhân viên → notify nhân viên
      const schedulesWithInfo = schedules.map((schedule: IEmployeeSchedule) => ({
        ...schedule,
        shiftInfo: getShiftInfo(schedule.shiftType, schedule.customStartTime, schedule.customEndTime)
      }))

      io.to(`user:${userId}`).emit('schedule_assigned', {
        schedules: schedulesWithInfo,
        message: 'Bạn đã được phân ca làm việc'
      })
    }
  })

  // Listen for schedule status changed events
  employeeScheduleEventEmitter.on('schedule_status_changed', ({ scheduleId, userId, status, schedule, type }) => {
    const scheduleWithInfo = {
      ...schedule,
      shiftInfo: getShiftInfo(schedule.shiftType, schedule.customStartTime, schedule.customEndTime)
    }

    if (type === 'approve_reject') {
      // Admin approve/reject → notify nhân viên
      const message =
        status === 'approved' ? 'Ca làm việc của bạn đã được phê duyệt' : 'Ca làm việc của bạn đã bị từ chối'

      io.to(`user:${userId}`).emit('schedule_status_updated', {
        scheduleId,
        schedule: scheduleWithInfo,
        status,
        message
      })

      // Cũng notify admin về việc đã xử lý
      io.to('admin').emit('schedule_processed', {
        scheduleId,
        userId,
        status,
        message: `Đã ${status === 'approved' ? 'phê duyệt' : 'từ chối'} ca làm việc`
      })
    } else if (type === 'status_update') {
      // Admin cập nhật status khác (in-progress, completed, absent, etc.) → notify nhân viên
      const statusMessages: Record<string, string> = {
        'in-progress': 'Ca làm việc của bạn đã bắt đầu',
        completed: 'Ca làm việc của bạn đã hoàn thành',
        absent: 'Bạn đã được đánh dấu vắng mặt',
        cancelled: 'Ca làm việc của bạn đã bị hủy'
      }

      io.to(`user:${userId}`).emit('schedule_status_updated', {
        scheduleId,
        schedule: scheduleWithInfo,
        status,
        message: statusMessages[status] || 'Trạng thái ca làm việc đã được cập nhật'
      })
    }
  })

  io.on('connection', (socket: Socket) => {
    console.log('Client connected to employee schedule socket:', socket.id)

    // Get userId from query params
    const userId = socket.handshake.query.userId as string
    const isAdmin = socket.handshake.query.isAdmin === 'true'

    // If client is admin, join admin room
    if (isAdmin) {
      socket.join('admin')
      console.log(`Admin socket ${socket.id} joined admin room`)
    }

    // If client is employee, join user room
    if (userId) {
      socket.join(`user:${userId}`)
      console.log(`Employee socket ${socket.id} joined user room: user:${userId}`)
    }

    socket.on('disconnect', () => {
      console.log(`Employee schedule socket disconnected: ${socket.id}`)
    })
  })
}
