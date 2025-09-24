import { Router } from 'express'
import {
  addItemsToOrder,
  cleanupDuplicateOrders,
  completeOrder,
  createFnbOrder,
  deleteFnbOrder,
  ensureUniqueIndex,
  getBillDetails,
  getFnbOrderById,
  getFnbOrdersByRoomSchedule,
  getOrderDetail,
  getUpdatedBill,
  upsertFnbOrder,
  upsertOrderItem
} from '~/controllers/fnbOrder.controller'
import {
  addItemsToOrderValidator,
  checkFNBOrderIdValidator,
  checkFNBOrderNotExists,
  checkRoomScheduleIdValidator,
  checkRoomScheduleExists,
  completeOrderValidator,
  createFNBOrderValidator,
  upsertFnbOrderValidator,
  upsertOrderItemValidator
} from '~/middlewares/fnbOrder.middleware'

const fnbOrderRouter = Router()

// Routes
fnbOrderRouter.post('/', createFNBOrderValidator, createFnbOrder)
fnbOrderRouter.get('/:id', checkFNBOrderIdValidator, checkFNBOrderNotExists, getFnbOrderById)
fnbOrderRouter.delete('/:id', checkFNBOrderIdValidator, checkFNBOrderNotExists, deleteFnbOrder)
fnbOrderRouter.post('/upsert', upsertFnbOrderValidator, upsertFnbOrder)
fnbOrderRouter.post('/upsert-item', upsertOrderItemValidator, upsertOrderItem)
fnbOrderRouter.post('/complete', completeOrderValidator, completeOrder)
fnbOrderRouter.post('/add-items', addItemsToOrderValidator, addItemsToOrder)
fnbOrderRouter.get('/detail/:roomScheduleId', checkRoomScheduleIdValidator, checkRoomScheduleExists, getOrderDetail)
fnbOrderRouter.get(
  '/room-schedule/:roomScheduleId',
  checkRoomScheduleIdValidator,
  checkRoomScheduleExists,
  getFnbOrdersByRoomSchedule
)
fnbOrderRouter.get('/bill/:roomScheduleId', checkRoomScheduleIdValidator, checkRoomScheduleExists, getUpdatedBill)
fnbOrderRouter.get(
  '/bill-details/:roomScheduleId',
  checkRoomScheduleIdValidator,
  checkRoomScheduleExists,
  getBillDetails
)

// Admin routes for maintenance
fnbOrderRouter.post('/cleanup-duplicates', cleanupDuplicateOrders)
fnbOrderRouter.post('/ensure-unique-index', ensureUniqueIndex)

export default fnbOrderRouter
