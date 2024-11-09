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
    const roomType = await databaseService.roomTypes.findOne({ name })

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

    const roomType = await databaseService.roomTypes.findOne({ _id: { $ne: new ObjectId(roomTypeId) } })

    if (!roomType) {
      throw new ErrorWithStatus({
        message: ROOM_TYPE_MESSAGES.ROOM_TYPE_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    next()
  } catch (error) {
    next(error)
  }
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
