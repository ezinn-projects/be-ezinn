import { Router } from 'express'
import { getClientFnbOrderByRoomSchedule, saveClientFnbOrder } from '~/controllers/roomScheduleFnb.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const clientFnbRouter = Router()

// Client FNB routes - no authentication required
clientFnbRouter.get('/orders/room/:roomId', wrapRequestHandler(getClientFnbOrderByRoomSchedule))
clientFnbRouter.post('/orders/room/:roomId', wrapRequestHandler(saveClientFnbOrder))

export default clientFnbRouter
