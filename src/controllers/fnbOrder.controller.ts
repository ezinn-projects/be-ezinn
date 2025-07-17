import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ICreateFNBOrderRequestBody } from '~/models/requests/FNB.request'
import fnbOrderService from '~/services/fnbOrder.service'

/**
 * @description Create FNB Order
 * @path /fnb-orders
 * @method POST
 */
export const createFnbOrder = async (
  req: Request<ParamsDictionary, any, ICreateFNBOrderRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomScheduleId, order, createdBy } = req.body
    const result = await fnbOrderService.createFnbOrder(roomScheduleId, order, createdBy)
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: FNB_MESSAGES.CREATE_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Order by ID
 * @path /fnb-orders/:id
 * @method GET
 */
export const getFnbOrderById = async (
  req: Request<ParamsDictionary, any, any, any>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await fnbOrderService.getFnbOrderById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDER_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete FNB Order
 * @path /fnb-orders/:id
 * @method DELETE
 */
export const deleteFnbOrder = async (req: Request<ParamsDictionary, any, any>, res: Response, next: NextFunction) => {
  try {
    const result = await fnbOrderService.deleteFnbOrder(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.DELETE_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Orders by Room Schedule ID
 * @path /fnb-orders/room-schedule/:roomScheduleId
 * @method GET
 */
export const getFnbOrdersByRoomSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fnbOrderService.getFnbOrdersByRoomSchedule(req.params.roomScheduleId)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDERS_BY_ROOM_SCHEDULE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Upsert FNB Order
 * @path /fnb-orders
 * @method POST
 */
export const upsertFnbOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId, order, createdBy } = req.body
    const result = await fnbOrderService.upsertFnbOrder(roomScheduleId, order, createdBy)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.UPSERT_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
