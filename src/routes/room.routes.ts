import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  addRoomController,
  deleteRoomController,
  getRoomController,
  getRoomsController,
  updateRoomController
} from '~/controllers/room.controller'
import { protect } from '~/middlewares/auth.middleware'
import { addRoomValidator, checkRoomExists } from '~/middlewares/room.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'
import ytSearch from 'yt-search'
import { VideoSchema } from '~/models/schemas/Video.schema'

const roomRouter = Router()

/**
 * @description Add room
 * @path /rooms/add-room
 * @method POST
 * @body {roomId: string, roomName: string, roomType: string, maxCapacity: number, status: string, pricePerTime: {startTime: string, endTime: string, price: number}[], equipment: {name: string, quantity: number}[], description: string, images: string[]} @type {IAddRoomRequestBody}
 * @author QuangDoo
 */
roomRouter.post(
  '/add-room',
  protect([UserRole.Admin]), // Kiểm tra quyền trước
  addRoomValidator, // Kiểm tra dữ liệu từ request
  checkRoomExists, // Kiểm tra trùng lặp trong DB
  wrapRequestHanlder(addRoomController) // Xử lý logic tạo phòng
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
