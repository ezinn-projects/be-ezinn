import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { Price_MESSAGES } from '~/constants/messages'
import { IDeleteMultiplePriceRequestBody, IPriceRequestBody, IPriceRequestQuery } from '~/models/requests/Price.request'
import { priceService } from '~/services/price.service'

/**
 * @description Get Price
 * @path /Price
 * @method GET
 * @body {room_size: RoomSize, day_type: DayType, date: Date}
 * @author QuangDoo
 */
export const getPrice = async (
  req: Request<ParamsDictionary, any, any, IPriceRequestQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await priceService.getPrice(req.query)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: Price_MESSAGES.GET_Price_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get Price by id
 * @path /Price/:id
 * @method GET
 * @author QuangDoo
 */
export const getPriceById = async (
  req: Request<ParamsDictionary, any, any, any>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await priceService.getPriceById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: Price_MESSAGES.GET_Price_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Create Price
 * @path /Price
 * @method POST
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
export const createPrice = async (
  req: Request<ParamsDictionary, any, IPriceRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await priceService.createPrice(req.body)

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: Price_MESSAGES.CREATE_Price_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Update Price
 * @path /Price/:id
 * @method PUT
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
export const updatePrice = async (
  req: Request<ParamsDictionary, any, IPriceRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await priceService.updatePrice(req.params.id, req.body)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: Price_MESSAGES.UPDATE_Price_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete Price
 * @path /Price/:id
 * @method DELETE
 * @author QuangDoo
 */
export const deletePrice = async (req: Request<ParamsDictionary, any, any>, res: Response, next: NextFunction) => {
  try {
    const result = await priceService.deletePrice(req.params.id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: Price_MESSAGES.DELETE_Price_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete multiple Price
 * @path /Price/multiple
 * @method DELETE
 * @author QuangDoo
 */
export const deleteMultiplePrice = async (
  req: Request<ParamsDictionary, any, IDeleteMultiplePriceRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await priceService.deleteMultiplePrice(req.body.ids)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: Price_MESSAGES.DELETE_MULTIPLE_Price_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
