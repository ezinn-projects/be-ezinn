import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import { addRoomController } from '~/controllers/room.controller'
import { protect } from '~/middlewares/auth.middleware'
import { addRoomValidator, checkRoomExists } from '~/middlewares/room.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

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

export default roomRouter
