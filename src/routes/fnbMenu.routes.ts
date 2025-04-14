import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import { createMenuItem, deleteMenuItem, getMenuItemById, updateMenuItem } from '~/controllers/fnbMenu.controller'
import { getAllMenuItems } from '~/controllers/fnbMenu.controller'
import { protect } from '~/middlewares/auth.middleware'
import { createFNBMenuValidator, updateFNBMenuValidator } from '~/middlewares/fnbMenu.middleware'
import { wrapRequestHandler } from '~/utils/handlers'

const fnbMenuRouter = Router()

// Routes for FNB Menu
fnbMenuRouter.get('/', protect([UserRole.Admin]), wrapRequestHandler(getAllMenuItems))
fnbMenuRouter.get('/:id', protect([UserRole.Admin]), wrapRequestHandler(getMenuItemById))
fnbMenuRouter.post('/', protect([UserRole.Admin]), createFNBMenuValidator, wrapRequestHandler(createMenuItem))
fnbMenuRouter.put('/:id', protect([UserRole.Admin]), updateFNBMenuValidator, wrapRequestHandler(updateMenuItem))
fnbMenuRouter.delete('/:id', protect([UserRole.Admin]), wrapRequestHandler(deleteMenuItem))

export default fnbMenuRouter
