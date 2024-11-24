import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_TYPE_MESSAGES } from '~/constants/messages'
import { AddRoomTypeRequestBody } from '~/models/requests/RoomType.request'
import { roomTypeServices } from '~/services/roomType.services'

export const addRoomTypeController = async (
  req: Request<ParamsDictionary, any, AddRoomTypeRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await roomTypeServices.addRoomType(req.body)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.ADD_ROOM_TYPE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const getRoomTypesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.getRoomTypes()

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.GET_ROOM_TYPES_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const getRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.getRoomTypeById(req.roomTypeId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.GET_ROOM_TYPE_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const updateRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.updateRoomTypeById(req.roomTypeId, req.body)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.UPDATE_ROOM_TYPE_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const deleteRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.deleteRoomTypeById(req.params.roomTypeId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.DELETE_ROOM_TYPE_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const deleteManyRoomTypesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.deleteManyRoomTypes(req.roomTypeIds || [])

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.DELETE_MANY_ROOM_TYPES_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
