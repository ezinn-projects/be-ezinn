import { NextFunction, Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { RoomScheduleStatus } from '~/constants/enum'
import fnbOrderService from '~/services/fnbOrder.service'
import databaseService from '~/services/database.service'

/**
 * @description Create or Update FNB Order for client app using simplified room index
 * @path /client/fnb/orders/room/:roomId
 * @method POST
 */
export const createOrUpdateClientFnbOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomIndex = parseInt(req.params.roomId, 10)
    const { order } = req.body

    // Validate roomIndex
    if (isNaN(roomIndex) || roomIndex <= 0) {
      throw new ErrorWithStatus({
        message: 'Invalid room index. Must be a positive number',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get all rooms and sort them
    const rooms = await databaseService.rooms.find({}).sort({ roomName: 1 }).toArray()

    // Check if index is valid
    if (roomIndex > rooms.length) {
      throw new ErrorWithStatus({
        message: `Invalid room index. Maximum index is ${rooms.length}`,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get the room by index (index is 1-based, array is 0-based)
    const room = rooms[roomIndex - 1]

    if (!room) {
      throw new ErrorWithStatus({
        message: 'Room not found',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Find current active schedule for the room (in use)
    const currentSchedule = await databaseService.roomSchedule.findOne({
      roomId: room._id,
      status: RoomScheduleStatus.InUse
    })

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session found for room ${room.roomName || roomIndex}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Create or update the order using the found roomScheduleId
    const result = await fnbOrderService.upsertFnbOrder(currentSchedule._id.toString(), order, 'client-app')

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.UPSERT_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Order by Room Index for client app
 * @path /client/fnb/orders/room/:roomId
 * @method GET
 */
export const getClientFnbOrderByRoomSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomIndex = parseInt(req.params.roomId, 10)

    // Validate roomIndex
    if (isNaN(roomIndex) || roomIndex <= 0) {
      throw new ErrorWithStatus({
        message: 'Invalid room index. Must be a positive number',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get all rooms and sort them
    const rooms = await databaseService.rooms.find({}).sort({ roomName: 1 }).toArray()

    // Check if index is valid
    if (roomIndex > rooms.length) {
      throw new ErrorWithStatus({
        message: `Invalid room index. Maximum index is ${rooms.length}`,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get the room by index (index is 1-based, array is 0-based)
    const room = rooms[roomIndex - 1]

    if (!room) {
      throw new ErrorWithStatus({
        message: 'Room not found',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Find current active schedule for the room (in use)
    const currentSchedule = await databaseService.roomSchedule.findOne({
      roomId: room._id,
      status: RoomScheduleStatus.InUse
    })

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session found for room ${room.roomName || roomIndex}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get orders for the found roomScheduleId
    const result = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDERS_BY_ROOM_SCHEDULE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
