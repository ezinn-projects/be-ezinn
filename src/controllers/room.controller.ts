import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_MESSAGES } from '~/constants/messages'
import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import { roomServices } from '~/services/room.service'

/**
 * @description Controller xử lý tạo phòng mới
 * @param {Request<ParamsDictionary, any, IAddRoomRequestBody>} req - Express request object chứa thông tin phòng cần tạo trong body
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng đã tạo
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */

export const addRoomController = async (
  req: Request<ParamsDictionary, any, IAddRoomRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomName, roomType, maxCapacity, status, description } = req.body

    const result = await roomServices.addRoom({
      roomName,
      roomType,
      maxCapacity: Number(maxCapacity),
      status,
      description
    })

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.ADD_ROOM_TYPE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý lấy tất cả phòng
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const getRoomsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.getRooms()

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.GET_ROOMS_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý lấy phòng theo id
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const getRoomController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.getRoom(req.params.id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.GET_ROOM_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý cập nhật phòng
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const updateRoomController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.updateRoom(req.params.id, req.body)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.UPDATE_ROOM_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý xóa phòng
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const deleteRoomController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.deleteRoom(req.params.id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.DELETE_ROOM_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description socket event for notification
 * @path /song-queue/rooms/:roomId/notification
 * @method GET
 * @author QuangDoo
 */
export const solveRequestController = async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params

  try {
    await roomServices.solveRequest(roomId)
    res.status(HTTP_STATUS_CODE.OK).json({ message: 'Request solved successfully' })
  } catch (error) {
    next(error)
  }
}

/**
 * @description turn off all videos in room
 * @path /rooms/turn-off-videos
 * @method POST
 * @author QuangDoo
 */
export const turnOffVideosController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await roomServices.turnOffVideos()
    res.status(HTTP_STATUS_CODE.OK).json({ message: 'Videos turned off successfully' })
  } catch (error) {
    next(error)
  }
}
