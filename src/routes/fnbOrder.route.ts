import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  deleteFnbOrder,
  getFnbOrderById,
  getFnbOrdersByRoomSchedule,
  upsertFnbOrder
} from '~/controllers/fnbOrder.controller'
import { protect } from '~/middlewares/auth.middleware'
import {
  checkFNBOrderIdValidator,
  checkFNBOrderNotExists,
  createFNBOrderValidator
} from '~/middlewares/fnbOrder.middleware'
import { wrapRequestHandler } from '~/utils/handlers'

const fnbOrderRouter = Router()

/**
 * @description Create FNB Order
 * @path /fnb-orders
 * @method POST
 */
fnbOrderRouter.post('/', protect([UserRole.Admin]), createFNBOrderValidator, wrapRequestHandler(upsertFnbOrder))

/**
 * @description Get FNB Order by id
 * @path /fnb-orders/:id
 * @method GET
 */
fnbOrderRouter.get('/:id', wrapRequestHandler(getFnbOrderById))

/**
 * @description Update FNB Order
 * @path /fnb-orders/:id
 * @method PUT
 */
fnbOrderRouter.put('/:id', protect([UserRole.Admin]), createFNBOrderValidator, wrapRequestHandler(upsertFnbOrder))

/**
 * @description Delete FNB Order
 * @path /fnb-orders/:id
 * @method DELETE
 */
fnbOrderRouter.delete(
  '/:id',
  protect([UserRole.Admin]),
  checkFNBOrderIdValidator,
  checkFNBOrderNotExists,
  wrapRequestHandler(deleteFnbOrder)
)

/**
 * @description Get FNB Orders by Room Schedule ID
 * @path /fnb-orders/fnb-order/:roomScheduleId
 * @method GET
 */
fnbOrderRouter.get('/fnb-order/:roomScheduleId', wrapRequestHandler(getFnbOrdersByRoomSchedule))

export default fnbOrderRouter
