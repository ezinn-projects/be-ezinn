import { Router } from 'express'
import multer from 'multer'
import { UserRole } from '~/constants/enum'
import {
  addRoomController,
  deleteRoomController,
  getRoomController,
  getRoomsController,
  updateRoomController
} from '~/controllers/room.controller'
import { protect } from '~/middlewares/auth.middleware'
import { checkRoomExists, validateFiles } from '~/middlewares/room.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

const roomRouter = Router()

const upload = multer({ storage: multer.memoryStorage() })

/**
 * @description Add room
 * @path /rooms/add-room
 * @method POST
 * @body multipart/form-data
 * Fields: roomId, roomName, roomType, maxCapacity, status, pricePerTime, equipment, description
 * @author QuangDoo
 */
roomRouter.post(
  '/add-room',
  protect([UserRole.Admin]),
  validateFiles,
  checkRoomExists,
  // addRoomValidator,
  upload.array('images', 5),
  wrapRequestHanlder(addRoomController)
)

/**
 * @description Lấy tất cả phòng
 * @path /rooms
 * @method GET
 * @author QuangDoo
 */
roomRouter.get('/', wrapRequestHanlder(getRoomsController))

/**
 * @description Lấy phòng theo id
 * @path /rooms/:id
 * @method GET
 * @author QuangDoo
 */
roomRouter.get('/:id', wrapRequestHanlder(getRoomController))

/**
 * @description Cập nhật phòng
 * @path /rooms/:id
 * @method PUT
 * @author QuangDoo
 */
roomRouter.put('/:id', wrapRequestHanlder(updateRoomController))

/**
 * @description Xóa phòng
 * @path /rooms/:id
 * @method DELETE
 * @author QuangDoo
 */
roomRouter.delete('/:id', wrapRequestHanlder(deleteRoomController))

export default roomRouter
