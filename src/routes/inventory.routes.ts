import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import { getLowStockItems, getStockHistory, updateStock } from '~/controllers/inventory.controller'
import { protect } from '~/middlewares/auth.middleware'
import { wrapRequestHandler } from '~/utils/handlers'

const inventoryRouter = Router()

// Routes for Inventory Management
inventoryRouter.post('/:itemId/stock', protect([UserRole.Admin]), wrapRequestHandler(updateStock))

inventoryRouter.get('/low-stock', protect([UserRole.Admin]), wrapRequestHandler(getLowStockItems))

inventoryRouter.get('/:itemId/history', protect([UserRole.Admin]), wrapRequestHandler(getStockHistory))

export default inventoryRouter
