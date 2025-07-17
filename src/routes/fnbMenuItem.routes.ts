import { Router } from 'express'
import {
  createMenuItem,
  getMenuItemById,
  getAllMenuItems,
  updateMenuItem,
  deleteMenuItem,
  updateVariantInventory
} from '~/controllers/fnbMenuItem.controller'
import { upload } from '~/utils/common'

const fnbMenuItemRouter = Router()

// Routes
fnbMenuItemRouter.post('/', upload.any(), createMenuItem)
fnbMenuItemRouter.get('/', getAllMenuItems)
fnbMenuItemRouter.get('/:id', getMenuItemById)

fnbMenuItemRouter.put('/:id', upload.any(), updateMenuItem)
fnbMenuItemRouter.put('/:id/inventory', updateVariantInventory)
fnbMenuItemRouter.delete('/:id', deleteMenuItem)

export default fnbMenuItemRouter
