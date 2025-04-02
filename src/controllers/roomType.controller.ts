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
      area: area,
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

export const updateRoomTypeByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, capacity, area, description, type, existingImages } = req.body
    const files = req.files as Express.Multer.File[] | undefined

    // Prepare update data with existing fields
    const updateData: Partial<AddRoomTypeRequestBody> = {}

    if (name) updateData.name = name
    if (capacity) updateData.capacity = Number(capacity)
    if (area) updateData.area = area
    if (description) updateData.description = description
    if (type) updateData.type = type

    // Initialize images array
    let finalImages: string[] = []

    // Add existing images if provided
    if (existingImages) {
      // Handle both string and array formats
      if (typeof existingImages === 'string') {
        finalImages = JSON.parse(existingImages)
      } else if (Array.isArray(existingImages)) {
        finalImages = existingImages
      }
    }

    // Handle new image uploads if provided
    if (files?.length) {
      const uploadedImages: string[] = []

      try {
        const uploadPromises = files.map((file) => uploadImageToCloudinary(file.buffer, 'room-types'))
        const results = await Promise.all(uploadPromises)

        uploadedImages.push(...results.map((img) => (img as CloudinaryResponse).url))

        // Combine existing and new images
        finalImages = [...finalImages, ...uploadedImages]
      } catch (error) {
        throw new Error(`Failed to upload images: ${(error as Error).message}`)
      }
    }

    // Only update images if we have any (new or existing)
    if (finalImages.length > 0) {
      updateData.images = finalImages
    }

    const result = await roomTypeServices.updateRoomTypeById(req.roomTypeId, updateData as AddRoomTypeRequestBody)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_TYPE_MESSAGES.UPDATE_ROOM_TYPE_BY_ID_SUCCESS,
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
