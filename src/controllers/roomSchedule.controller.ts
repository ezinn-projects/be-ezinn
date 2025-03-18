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
  req: Request<
    ParamsDictionary,
    any,
    any,
    { roomId?: string; date?: string | string[]; status?: RoomScheduleStatus | string }
  >,
  res: Response,
  next: NextFunction
) => {
  try {
    // Lấy các tham số filter từ query string của request
    const filter: IRoomScheduleRequestQuery = {
      roomId: req.query.roomId as string,
      // Nếu FE truyền date dưới dạng ISO có hậu tố Z, ví dụ "2025-03-15T17:00:00.000Z"
      date: req.query.date as string,
      status: req.query.status as RoomScheduleStatus
    }

    const schedules = await roomScheduleService.getSchedules(filter)
    res.status(200).json({ message: 'Get schedules success', result: schedules })
  } catch (error) {
    next(error)
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

    const filter: IRoomScheduleRequestQuery = {
      roomId: roomId, // Chuyển đổi roomId thành ObjectId ngay tại đây
      date: date as string,
      status: status ? (status as RoomScheduleStatus) : undefined
    }

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
