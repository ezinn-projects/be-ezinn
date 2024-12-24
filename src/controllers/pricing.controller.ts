import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { PRICING_MESSAGES } from '~/constants/messages'
import {
  IDeleteMultiplePricingRequestBody,
  IPricingRequestBody,
  IPricingRequestQuery
} from '~/models/requests/Pricing.request'
import { pricingService } from '~/services/pricing.service'

/**
 * @description Get pricing
 * @path /pricing
 * @method GET
 * @body {room_size: RoomSize, day_type: DayType, date: Date}
 * @author QuangDoo
 */
export const getPricing = async (
  req: Request<ParamsDictionary, any, any, IPricingRequestQuery>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pricingService.getPricing(req.query)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: PRICING_MESSAGES.GET_PRICING_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get pricing by id
 * @path /pricing/:id
 * @method GET
 * @author QuangDoo
 */
export const getPricingById = async (
  req: Request<ParamsDictionary, any, any, any>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pricingService.getPricingById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: PRICING_MESSAGES.GET_PRICING_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Create pricing
 * @path /pricing
 * @method POST
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
export const createPricing = async (
  req: Request<ParamsDictionary, any, IPricingRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pricingService.createPricing(req.body)

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: PRICING_MESSAGES.CREATE_PRICING_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Update pricing
 * @path /pricing/:id
 * @method PUT
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
export const updatePricing = async (
  req: Request<ParamsDictionary, any, IPricingRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pricingService.updatePricing(req.params.id, req.body)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: PRICING_MESSAGES.UPDATE_PRICING_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete pricing
 * @path /pricing/:id
 * @method DELETE
 * @author QuangDoo
 */
export const deletePricing = async (req: Request<ParamsDictionary, any, any>, res: Response, next: NextFunction) => {
  try {
    const result = await pricingService.deletePricing(req.params.id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: PRICING_MESSAGES.DELETE_PRICING_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete multiple pricing
 * @path /pricing/multiple
 * @method DELETE
 * @author QuangDoo
 */
export const deleteMultiplePricing = async (
  req: Request<ParamsDictionary, any, IDeleteMultiplePricingRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pricingService.deleteMultiplePricing(req.body.ids)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: PRICING_MESSAGES.DELETE_MULTIPLE_PRICING_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
