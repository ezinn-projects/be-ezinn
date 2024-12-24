import { Router } from 'express'
import {
  createRoomCategory,
  deleteRoomCategory,
  getRoomCategoryById,
  updateRoomCategory
} from '~/controllers/roomCategory.controller'
import { getAllRoomCategories } from '~/controllers/roomCategory.controller'
import {
  checkRoomCategoryExist,
  checkRoomCategoryNameExist,
  createRoomCategoryValidator
} from '~/middlewares/roomCategory.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

const roomCategoryRouter = Router()

/**
 * @description Get all room categories
 * @path /room-category
 * @method GET
 * @author QuangDoo
 */
roomCategoryRouter.get('/', wrapRequestHanlder(getAllRoomCategories))

/**
 * @description Get room category by id
 * @path /room-category/:id
 * @method GET
 * @author QuangDoo
 */
roomCategoryRouter.get('/:id', wrapRequestHanlder(getRoomCategoryById))

/**
 * @description Create room category
 * @path /room-category
 * @method POST
 * @body {name: string, capacity: number, pricePerHour: number, equipment: {tv: boolean, soundSystem: string, microphone: number}, description: string}
 * @author QuangDoo
 */
roomCategoryRouter.post(
  '/',
  createRoomCategoryValidator,
  checkRoomCategoryNameExist,
  wrapRequestHanlder(createRoomCategory)
)

/**
 * @description Update room category
 * @path /room-category/:id
 * @method PUT
 * @body {name: string, capacity: number, pricePerHour: number, equipment: {tv: boolean, soundSystem: string, microphone: number}, description: string}
 * @author QuangDoo
 */
roomCategoryRouter.put('/:id', checkRoomCategoryExist, wrapRequestHanlder(updateRoomCategory))

/**
 * @description Delete room category
 * @path /room-category/:id
 * @method DELETE
 * @author QuangDoo
 */
roomCategoryRouter.delete('/:id', wrapRequestHanlder(deleteRoomCategory))
