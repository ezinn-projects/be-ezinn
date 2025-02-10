import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_TYPE_MESSAGES } from '~/constants/messages'
import CloudinaryResponse from '~/models/CloudinaryResponse'
import { AddRoomTypeRequestBody } from '~/models/requests/RoomType.request'
import { roomTypeServices } from '~/services/roomType.service'
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '~/services/cloudinary.service'

export const addRoomTypeController = async (
  req: Request<ParamsDictionary, any, AddRoomTypeRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, capacity, area, description, type } = req.body
    const files = req.files as Express.Multer.File[] | undefined

    const uploadedImages: CloudinaryResponse[] = []

    if (files?.length) {
      for (const file of files) {
        try {
          const result = await uploadImageToCloudinary(file.buffer, 'room-types')
          uploadedImages.push(result as CloudinaryResponse)
        } catch (error) {
          // Cleanup already uploaded images if any upload fails
          await Promise.all(uploadedImages.map((img) => deleteImageFromCloudinary(img.publicId)))
          throw new Error(`Failed to upload images: ${(error as Error).message}`)
        }
      }
    }

    const result = await roomTypeServices.addRoomType({
      name,
      capacity: Number(capacity),
      area: Number(area),
      description,
      images: uploadedImages.map((img) => img.url),
      type
    })

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.ADD_ROOM_TYPE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const getRoomTypesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.getRoomTypes()

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.GET_ROOM_TYPES_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const getRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.getRoomTypeById(req.roomTypeId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.GET_ROOM_TYPE_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const updateRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.updateRoomTypeById(req.roomTypeId, req.body)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.UPDATE_ROOM_TYPE_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const deleteRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.deleteRoomTypeById(req.params.roomTypeId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.DELETE_ROOM_TYPE_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const deleteManyRoomTypesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomTypeServices.deleteManyRoomTypes(req.roomTypeIds || [])

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.DELETE_MANY_ROOM_TYPES_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
