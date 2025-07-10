import { Request, Response, NextFunction } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ICreateFnBMenuRequestBody } from '~/models/requests/FnBMenu.request'
import fnbMenuService from '~/services/fnbMenu.service'
// import { ICreateFNBRequestBody } from '~/models/requests/FNB.request'
// import fnbService from '~/services/fnb.service'
import { ParamsDictionary } from 'express-serve-static-core'

/**
 * @description Create FNB Order
 * @path /fnb-orders
 * @method POST
 */
export const createFnbOrder = async (
  req: Request<Record<string, unknown>, any, ICreateFnBMenuRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, price, description, image, category, createdBy, inventory } = req.body
    const result = await fnbMenuService.createFnbMenu({
      name,
      price,
      description,
      image,
      category,
      createdBy,
      createdAt: new Date(),
      hasVariants: false, // Thêm thuộc tính này
      inventory: {
        quantity: inventory.quantity,
        unit: inventory.unit,
        minStock: inventory.minStock,
        maxStock: inventory.maxStock,
        lastUpdated: new Date()
      }
    })
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
    const result = await fnbMenuService.getFnbMenuById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDER_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get all FNB Orders
 * @path /fnb-orders
 * @method GET
 */
export const getAllFnbOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fnbMenuService.getAllFnbMenu()
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_MENUS_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
