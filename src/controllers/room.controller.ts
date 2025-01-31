import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import { roomServices } from '~/services/room.services'

import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_MESSAGES } from '~/constants/messages'
import multer from 'multer'
import { uploadImageToCloudinary } from '~/services/cloudinary.service'

/**
 * @description Controller xử lý tạo phòng mới
 * @param {Request<ParamsDictionary, any, IAddRoomRequestBody>} req - Express request object chứa thông tin phòng cần tạo trong body
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng đã tạo
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
const storage = multer.memoryStorage()
const upload = multer({ storage })

interface CloudinaryResponse {
  url: string
  publicId: string
}

export const addRoomController = [
  upload.array('images', 5),
  async (req: Request<ParamsDictionary, any, IAddRoomRequestBody>, res: Response, next: NextFunction) => {
    try {
      const { roomName, roomType, maxCapacity, status, description } = req.body

      // Upload từng file lên Cloudinary
      const files = (req.files as Express.Multer.File[]) || []
      const uploadedImages = (await Promise.all(
        files.map((file) => uploadImageToCloudinary(file.buffer, 'rooms'))
      )) as CloudinaryResponse[]

      // Lấy URL từ kết quả upload
      const images = uploadedImages.map((img) => img.url)

      // Gọi service lưu phòng với danh sách hình ảnh
      const result = await roomServices.addRoom({
        roomName,
        roomType,
        maxCapacity: Number(maxCapacity),
        status,
        description,
        images
      })

      return res.status(HTTP_STATUS_CODE.OK).json({
        message: ROOM_MESSAGES.ADD_ROOM_TYPE_SUCCESS,
        result
      })
    } catch (error) {
      next(error)
    }
  }
]

/**
 * @description Controller xử lý lấy phòng theo id
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const getRoomController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.getRoom(req.params.id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.GET_ROOM_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý lấy tất cả phòng
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const getRoomsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.getRooms()

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.GET_ROOMS_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý cập nhật phòng
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const updateRoomController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.updateRoom(req.params.id, req.body)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.UPDATE_ROOM_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Controller xử lý xóa phòng
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 * @returns {Promise<Response>} Response với status 200 và thông tin phòng
 * @throws {Error} Chuyển tiếp lỗi đến middleware xử lý lỗi thông qua next(error)
 * @author QuangDo
 */
export const deleteRoomController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomServices.deleteRoom(req.params.id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_MESSAGES.DELETE_ROOM_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
