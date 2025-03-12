import { NextFunction, Request, Response } from 'express'
import { RoomScheduleStatus } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_SCHEDULE_MESSAGES } from '~/constants/messages'
import { roomScheduleService } from '~/services/roomSchedule.service'
import { type ParamsDictionary } from 'express-serve-static-core'
import { IRoomScheduleRequestBody, IRoomScheduleRequestQuery } from '~/models/requests/RoomSchedule.request'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { ObjectId } from 'mongodb'

dayjs.extend(utc)
dayjs.extend(timezone)

// Lấy lịch của tất cả các phòng theo ngày (truyền date từ body dưới dạng ISO string)
export const getSchedules = async (
  req: Request<ParamsDictionary, any, any, { date?: string | string[]; status?: RoomScheduleStatus | string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const dateParam = req.query.date
    const status = req.query.status

    if (!dateParam || Array.isArray(dateParam)) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Date parameter is required and must be a single string value (format: ISO date string)'
      })
    }

    // Giả sử bạn muốn lọc theo múi giờ "Asia/Ho_Chi_Minh"
    const timeZone = 'Asia/Ho_Chi_Minh'

    // Sử dụng dayjs để tính startOfDay và endOfDay theo múi giờ mong muốn
    const startOfDayUTC = dayjs.tz(dateParam, timeZone).startOf('day').utc().toDate()
    const endOfDayUTC = dayjs.tz(dateParam, timeZone).endOf('day').utc().toDate()

    console.log('Query date range:', {
      start: startOfDayUTC,
      end: endOfDayUTC
    })

    const filter = {
      startTime: { $gte: startOfDayUTC, $lt: endOfDayUTC },
      ...(status && { status: status as RoomScheduleStatus })
    }

    console.log('MongoDB filter:', JSON.stringify(filter, null, 2))

    const schedules = await roomScheduleService.getSchedules(filter)

    console.log(
      'Schedules found:',
      schedules.map((s) => ({
        id: s._id,
        startTime: s.startTime,
        year: new Date(s.startTime).getFullYear()
      }))
    )

    return res
      .status(HTTP_STATUS_CODE.OK)
      .json({ message: ROOM_SCHEDULE_MESSAGES.GET_SCHEDULES_SUCCESS, result: schedules })
  } catch (err) {
    next(err)
  }
}

// Lấy lịch của một phòng cụ thể theo ngày (route param roomId, query: ?date=YYYY -MM-DD[&status=...])
export const getSchedulesByRoom = async (
  req: Request<ParamsDictionary, any, any, IRoomScheduleRequestQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomId } = req.params
    const { date, status } = req.body

    const filter = {
      roomId: new ObjectId(roomId), // Chuyển đổi roomId thành ObjectId ngay tại đây
      date: date as string,
      status: status ? (status as RoomScheduleStatus) : undefined
    }

    console.log('filter', filter)

    const schedules = await roomScheduleService.getSchedules(filter)

    return res
      .status(HTTP_STATUS_CODE.OK)
      .json({ message: ROOM_SCHEDULE_MESSAGES.GET_SCHEDULES_SUCCESS, result: schedules })
  } catch (err) {
    next(err)
  }
}

// Tạo mới một event lịch phòng (POST /api/schedules)
export const createSchedule = async (
  req: Request<ParamsDictionary, any, IRoomScheduleRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const scheduleId = await roomScheduleService.createSchedule(req.body)
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: ROOM_SCHEDULE_MESSAGES.CREATE_SCHEDULE_SUCCESS,
      result: scheduleId
    })
  } catch (err) {
    next(err)
  }
}

// Cập nhật event lịch phòng (PUT /api/schedules/:id)
export const updateSchedule = async (
  req: Request<ParamsDictionary, any, IRoomScheduleRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params
    const modifiedCount = await roomScheduleService.updateSchedule(id, req.body)
    if (modifiedCount === 0) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({ error: ROOM_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND })
    }
    return res.status(HTTP_STATUS_CODE.OK).json({ message: ROOM_SCHEDULE_MESSAGES.UPDATE_SCHEDULE_SUCCESS })
  } catch (err) {
    next(err)
  }
}

// Hủy event (PUT /api/schedules/:id/cancel)
export const cancelSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const modifiedCount = await roomScheduleService.cancelSchedule(id)
    if (modifiedCount === 0) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({ error: ROOM_SCHEDULE_MESSAGES.SCHEDULE_NOT_FOUND })
    }
    return res.status(HTTP_STATUS_CODE.OK).json({ message: ROOM_SCHEDULE_MESSAGES.CANCEL_SCHEDULE_SUCCESS })
  } catch (err) {
    next(err)
  }
}
