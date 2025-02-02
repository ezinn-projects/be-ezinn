import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  createPrice,
  deleteMultiplePrice,
  deletePrice,
  getPrice,
  getPriceById,
  updatePrice
} from '~/controllers/price.controller'
import { protect } from '~/middlewares/auth.middleware'
import {
  checkPriceExists,
  checkPriceIdValidator,
  checkPriceNotExists,
  createPriceValidator
} from '~/middlewares/price.middleware'

import { wrapRequestHanlder } from '~/utils/handlers'

const priceRouter = Router()

/**
 * @description Get Price
 * @path /Price
 * @method GET
 * @body {room_size: RoomSize, day_type: DayType, date: Date}
 * @author QuangDoo
 */
priceRouter.get('/', wrapRequestHanlder(getPrice))

/**
 * @description Get Price by id
 * @path /Price/:id
 * @method GET
 * @author QuangDoo
 */
priceRouter.get('/:id', checkPriceNotExists, wrapRequestHanlder(getPriceById))

/**
 * @description Create Price
 * @path /Price
 * @method POST
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
priceRouter.post(
  '/',
  protect([UserRole.Admin]),
  createPriceValidator,
  checkPriceExists,
  wrapRequestHanlder(createPrice)
)

/**
 * @description Update Price
 * @path /Price/:id
 * @method PUT
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
priceRouter.put('/:id', protect([UserRole.Admin]), createPriceValidator, wrapRequestHanlder(updatePrice))

/**
 * @description Delete multiple Price
 * @note This endpoint is used to delete multiple Price by ids
 * @path /Price/multiple
 * @method DELETE
 * @author QuangDoo
 */
priceRouter.delete('/multiple', protect([UserRole.Admin]), wrapRequestHanlder(deleteMultiplePrice))

/**
 * @description Delete Price
 * @path /Price/:id
 * @method DELETE
 * @author QuangDoo
 */
priceRouter.delete(
  '/:id',
  protect([UserRole.Admin]),
  checkPriceIdValidator,
  checkPriceNotExists,
  wrapRequestHanlder(deletePrice)
)

export default priceRouter
