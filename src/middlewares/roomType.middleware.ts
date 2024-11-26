import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_TYPE_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import databaseService from '~/services/database.services'
import { validate } from '~/utils/validation'

export const checkRoomTypeExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body
    const { roomTypeId } = req.params // Lấy id của room type từ params

    const roomType = await databaseService.roomTypes.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: new ObjectId(roomTypeId) } // Bỏ qua bản ghi có id trùng với id hiện tại
    })

    if (roomType) {
      throw new ErrorWithStatus({
        message: ROOM_TYPE_MESSAGES.ROOM_TYPE_EXISTS,
        status: HTTP_STATUS_CODE.CONFLICT
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}

// check room type is not exists
export const checkRoomTypeIsNotExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomTypeId } = req.params

    if (!ObjectId.isValid(roomTypeId)) {
      throw new ErrorWithStatus({
        message: ROOM_TYPE_MESSAGES.INVALID_ROOM_TYPE_ID,
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    const roomType = await databaseService.roomTypes.findOne({ _id: { $ne: new ObjectId(roomTypeId) } })

    if (!roomType) {
      throw new ErrorWithStatus({
        message: ROOM_TYPE_MESSAGES.ROOM_TYPE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    req.roomTypeId = roomTypeId
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * @description Validate room type ids
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function validateRoomTypeIds(req: Request, res: Response, next: NextFunction) {
  const { roomTypeIds } = req.body

  if (!Array.isArray(roomTypeIds) || roomTypeIds.length === 0) {
    return res.status(400).json({ error: 'Invalid room type IDs array' })
  }

  const invalidId = roomTypeIds.find((id) => !ObjectId.isValid(id))
  if (invalidId) {
    throw new ErrorWithStatus({
      message: ROOM_TYPE_MESSAGES.INVALID_ROOM_TYPE_IDS,
      status: HTTP_STATUS_CODE.BAD_REQUEST
    })
  }

  // Attach validated ObjectIds to the request object for use in the controller
  req.roomTypeIds = roomTypeIds.map((id) => new ObjectId(id))

  next()
}

export const addRoomTypeValidator = validate(
  checkSchema(
    {
      name: {
        notEmpty: {
          errorMessage: 'Name is required'
        },
        custom: {
          options: (value: string, { req }) => {
            if (value.length < 3) {
              throw new Error('Name must be at least 3 characters long')
            }
            return true
          }
        }
      }
    },

    ['body']
  )
)
