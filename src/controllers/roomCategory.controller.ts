import { NextFunction, Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_CATEGORY_MESSAGES } from '~/constants/messages'
import { roomCategoryService } from '~/services/roomCategory.service'

/**
 * @description Create room category
 * @path /room-category
 * @method POST
 * @body {name: string, capacity: number, pricePerHour: number, equipment: {tv: boolean, soundSystem: string, microphone: number}, description: string}
 * @author QuangDoo
 */
export const createRoomCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomCategoryService.createRoomCategory(req.body)
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: ROOM_CATEGORY_MESSAGES.CREATE_ROOM_CATEGORY_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get all room categories
 * @path /room-category
 * @method GET
 * @author QuangDoo
 */
export const getAllRoomCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomCategoryService.getAllRoomCategories()
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_CATEGORY_MESSAGES.GET_ALL_ROOM_CATEGORIES_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get room category by id
 * @path /room-category/:id
 * @method GET
 * @author QuangDoo
 */
export const getRoomCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomCategoryService.getRoomCategoryById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_CATEGORY_MESSAGES.GET_ROOM_CATEGORY_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Update room category
 * @path /room-category/:id
 * @method PUT
 * @body {name: string, capacity: number, pricePerHour: number, equipment: {tv: boolean, soundSystem: string, microphone: number}, description: string}
 * @author QuangDoo
 */
export const updateRoomCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pricePerHour, ...restBody } = req.body

    const updateData = {
      ...restBody,
      price_per_hour: pricePerHour
    }

    const result = await roomCategoryService.updateRoomCategory(req.params.id, updateData)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_CATEGORY_MESSAGES.UPDATE_ROOM_CATEGORY_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete room category
 * @path /room-category/:id
 * @method DELETE
 * @author QuangDoo
 */
export const deleteRoomCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await roomCategoryService.deleteRoomCategory(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: ROOM_CATEGORY_MESSAGES.DELETE_ROOM_CATEGORY_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
