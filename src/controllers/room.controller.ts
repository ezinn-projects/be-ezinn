import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import { roomServices } from '~/services/room.services'

import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_MESSAGES } from '~/constants/messages'

export const addRoomController = async (
  req: Request<ParamsDictionary, any, IAddRoomRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('req.body :>> ', req.body)
    const result = await roomServices.addRoom(req.body)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.ADD_ROOM_TYPE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
