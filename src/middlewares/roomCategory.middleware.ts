import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_CATEGORY_MESSAGES } from '~/constants/messages'
import { roomCategoryService } from '~/services/roomCategory.service'
import { validate } from '~/utils/validation'

export const createRoomCategoryValidator = validate(
  checkSchema({
    name: {
      notEmpty: {
        errorMessage: 'Room category name is required'
      }
    },
    capacity: {
      notEmpty: {
        errorMessage: 'Room category capacity is required'
      },
      isInt: {
        options: { min: 1 },
        errorMessage: 'Room category capacity must be an integer greater than 0'
      }
    },
    price_per_hour: {
      isFloat: {
        options: { min: 1 },
        errorMessage: 'Room category price per hour must be an integer greater than 0'
      }
    },
    equipment: {
      isObject: {
        errorMessage: 'Room category equipment must be an object'
      },
      custom: {
        options: (value: any) => {
          const equipmentKeys = Object.keys(value)
          const validKeys = ['tv', 'soundSystem', 'microphone']
          const hasValidKeys = equipmentKeys.every((key) => validKeys.includes(key))

          if (!hasValidKeys) return false

          if (typeof value.tv !== 'boolean') return false
          if (typeof value.soundSystem !== 'string' || !value.soundSystem) return false
          if (!Number.isInteger(value.microphone) || value.microphone < 1) return false

          return true
        },
        errorMessage:
          'Invalid equipment data. Required: tv (boolean), soundSystem (non-empty string), microphone (positive integer)'
      }
    }
  })
)

export const checkRoomCategoryExist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomCategory = await roomCategoryService.getRoomCategoryById(req.params.id)

    if (!roomCategory) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({ message: ROOM_CATEGORY_MESSAGES.ROOM_CATEGORY_NOT_FOUND })
    }
    next()
  } catch (error) {
    next(error)
  }
}

export const checkRoomCategoryNameExist = async (req: Request, res: Response, next: NextFunction) => {
  const { name } = req.body
  try {
    const existingCategory = await roomCategoryService.getRoomCategoryByName(name)

    if (existingCategory) {
      return res.status(HTTP_STATUS_CODE.CONFLICT).json({
        message: ROOM_CATEGORY_MESSAGES.ROOM_CATEGORY_NAME_ALREADY_EXISTS
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}
