import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  createMenuItem,
  deleteMenuItem,
  getAllMenuItems,
  getMenuItemById,
  updateMenuItem
} from '~/controllers/fnbMenu.controller'
import { protect } from '~/middlewares/auth.middleware'
import { upload } from '~/utils/common'
import { wrapRequestHandler } from '~/utils/handlers'

const fnbMenuRouter = Router()

// Routes for FNB Menu
fnbMenuRouter.get('/', wrapRequestHandler(getAllMenuItems))
fnbMenuRouter.get('/:id', wrapRequestHandler(getMenuItemById))
fnbMenuRouter.post('/', protect([UserRole.Admin]), upload.single('file'), wrapRequestHandler(createMenuItem))
fnbMenuRouter.put('/:id', protect([UserRole.Admin]), upload.single('file'), wrapRequestHandler(updateMenuItem))
fnbMenuRouter.delete('/:id', protect([UserRole.Admin]), wrapRequestHandler(deleteMenuItem))

export default fnbMenuRouter
