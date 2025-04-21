import { Router } from 'express'
import multer from 'multer'
import { UserRole } from '~/constants/enum'
import {
  addRoomController,
  deleteRoomController,
  getRoomController,
  getRoomsController,
  solveRequestController,
  turnOffVideosController,
  updateRoomController
} from '~/controllers/room.controller'
import { streamVideo } from '~/controllers/roomMusic.controller'
import { protect } from '~/middlewares/auth.middleware'
import { checkRoomExists, validateFiles } from '~/middlewares/room.middleware'
import { wrapRequestHandler } from '~/utils/handlers'
import { fetchVideoInfo } from '~/utils/common'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'

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
  wrapRequestHandler(addRoomController)
)

/**
 * @description Lấy tất cả phòng
 * @path /rooms
 * @method GET
 * @author QuangDoo
 */
roomRouter.get('/', protect([UserRole.Admin]), wrapRequestHandler(getRoomsController))

/**
 * @description Lấy phòng theo id
 * @path /rooms/:id
 * @method GET
 * @author QuangDoo
 */
roomRouter.get('/:id', protect([UserRole.Admin]), wrapRequestHandler(getRoomController))

/**
 * @description turn off all videos in room
 * @path /rooms/:id/turn-off-videos
 * @method POST
 * @author QuangDoo
 */
roomRouter.post(
  '/turn-off-videos',
  protect([UserRole.Admin, UserRole.Staff]),
  wrapRequestHandler(turnOffVideosController)
)

/**
 * @description Cập nhật phòng
 * @path /rooms/:id
 * @method PUT
 * @author QuangDoo
 */
roomRouter.put('/:id', protect([UserRole.Admin]), wrapRequestHandler(updateRoomController))

/**
 * @description Xóa phòng
 * @path /rooms/:id
 * @method DELETE
 * @author QuangDoo
 */
roomRouter.delete('/:id', protect([UserRole.Admin]), wrapRequestHandler(deleteRoomController))

/**
 * @description solve request from client to admin with roomId and request
 * @path /rooms/:id/resolve-request
 * @method POST
 * @author QuangDoo
 */
roomRouter.post(
  '/:id/resolve-request',
  protect([UserRole.Admin, UserRole.Staff]),
  wrapRequestHandler(solveRequestController)
)
/**
 * @description Stream video
 * @path /rooms/:roomId/:videoId/stream
 * @method GET
 * @author QuangDoo
 */
roomRouter.get('/:roomId/:videoId/stream', wrapRequestHandler(streamVideo))

/**
 * @description Test HLS streaming
 * @path /rooms/:roomId/:videoId/test-hls
 * @method GET
 * @author QuangDoo
 */
roomRouter.get(
  '/:roomId/:videoId/test-hls',
  wrapRequestHandler(async (req, res, next) => {
    try {
      const data = await fetchVideoInfo(req.params.videoId)
      res.status(HTTP_STATUS_CODE.OK).json({
        message: 'Video format info',
        result: {
          ...data,
          isHLS: data.format_type === 'hls'
        }
      })
    } catch (err) {
      next(err)
    }
  })
)

export default roomRouter
