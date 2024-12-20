import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  createPricing,
  deleteMultiplePricing,
  deletePricing,
  getPricing,
  updatePricing
} from '~/controllers/pricing.controller'
import { protect } from '~/middlewares/auth.middleware'
import {
  checkPricingExists,
  checkPricingIdArrayValidator,
  checkPricingIdValidator,
  checkPricingNotExists,
  createPricingValidator
} from '~/middlewares/pricing.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

const pricingRouter = Router()

/**
 * @description Get pricing
 * @path /pricing
 * @method GET
 * @body {room_size: RoomSize, day_type: DayType, date: Date}
 * @author QuangDoo
 */
pricingRouter.get('/', wrapRequestHanlder(getPricing))

/**
 * @description Create pricing
 * @path /pricing
 * @method POST
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
pricingRouter.post(
  '/',
  protect([UserRole.Admin]),
  createPricingValidator,
  checkPricingExists,
  wrapRequestHanlder(createPricing)
)

/**
 * @description Update pricing
 * @path /pricing/:id
 * @method PUT
 * @body {room_size: RoomSize, day_type: DayType, effective_date: Date, end_date: Date}
 * @author QuangDoo
 */
pricingRouter.put('/:id', protect([UserRole.Admin]), createPricingValidator, wrapRequestHanlder(updatePricing))

/**
 * @description Delete multiple pricing
 * @note This endpoint is used to delete multiple pricing by ids
 * @path /pricing/multiple
 * @method DELETE
 * @author QuangDoo
 */
pricingRouter.delete('/multiple', protect([UserRole.Admin]), wrapRequestHanlder(deleteMultiplePricing))

/**
 * @description Delete pricing
 * @path /pricing/:id
 * @method DELETE
 * @author QuangDoo
 */
pricingRouter.delete(
  '/:id',
  protect([UserRole.Admin]),
  checkPricingIdValidator,
  checkPricingNotExists,
  wrapRequestHanlder(deletePricing)
)

export default pricingRouter
