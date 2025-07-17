import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  deleteFnbOrder,
  getFnbOrderById,
  getFnbOrdersByRoomSchedule,
  upsertFnbOrder,
  addItemToOrder,
  removeItemFromOrder
} from '~/controllers/fnbOrder.controller'
import { protect } from '~/middlewares/auth.middleware'
import {
  checkFNBOrderIdValidator,
  checkFNBOrderNotExists,
  createFNBOrderValidator,
  addItemToOrderValidator,
  removeItemFromOrderValidator
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
 * @description Create or Update FNB Order for client (no auth required)
 * @path /fnb-orders/client
 * @method POST
 */
fnbOrderRouter.post('/client', createFNBOrderValidator, wrapRequestHandler(upsertFnbOrder))

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

/**
 * @description Add item to FNB Order
 * @path /fnb-orders/:roomScheduleId/add-item
 * @method POST
 */
fnbOrderRouter.post('/:roomScheduleId/add-item', addItemToOrderValidator, wrapRequestHandler(addItemToOrder))

/**
 * @description Remove item from FNB Order
 * @path /fnb-orders/:roomScheduleId/remove-item
 * @method POST
 */
fnbOrderRouter.post(
  '/:roomScheduleId/remove-item',
  removeItemFromOrderValidator,
  wrapRequestHandler(removeItemFromOrder)
)

export default fnbOrderRouter
