import { Router } from 'express'
import { getClientFnbOrderByRoomSchedule, submitClientCart } from '~/controllers/roomScheduleFnb.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const clientFnbRouter = Router()

// ============================================
// CLIENT FNB ROUTES (No Authentication)
// ============================================

// GET current order - Xem order đã đặt (bao gồm cả món admin thêm)
clientFnbRouter.get('/orders/room/:roomId', wrapRequestHandler(getClientFnbOrderByRoomSchedule))

// SUBMIT cart - Gửi local cart, backend sẽ MERGE vào order hiện tại
clientFnbRouter.post('/orders/room/:roomId/submit-cart', wrapRequestHandler(submitClientCart))

export default clientFnbRouter
