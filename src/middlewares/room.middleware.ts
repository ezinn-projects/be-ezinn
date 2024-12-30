import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ROOM_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import databaseService from '~/services/database.services'
import { validate } from '~/utils/validation'

export const checkRoomExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body

    const room = await databaseService.rooms.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })

    if (room) {
      throw new ErrorWithStatus({
        message: ROOM_MESSAGES.ROOM_EXISTS,
        status: HTTP_STATUS_CODE.CONFLICT
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const addRoomValidator = validate(
  checkSchema<keyof IAddRoomRequestBody>(
    {
      roomName: {
        notEmpty: {
          errorMessage: 'Room name is required'
        },
        isString: {
          errorMessage: 'Room name must be a string'
        }
      },
      roomType: {
        notEmpty: {
          errorMessage: 'Room type is required'
        },
        isIn: {
          options: [['Small', 'Medium', 'Large']],
          errorMessage: 'Room type must be one of Small, Medium, or Large'
        }
      },
      maxCapacity: {
        notEmpty: {
          errorMessage: 'Max capacity is required'
        },
        isInt: {
          options: { min: 1 },
          errorMessage: 'Max capacity must be an integer greater than 0'
        }
      },
      images: {
        isArray: {
          errorMessage: 'Images must be an array of URLs'
        },
        custom: {
          options: (value: string[]) => value.every((url: string) => /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/.test(url)),
          errorMessage: 'All images must be valid URLs ending with .jpg, .jpeg, .png, or .webp'
        }
      }
    },
    ['body']
  )
)

export const checkRoomNotExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const room = await databaseService.rooms.findOne({ _id: new ObjectId(id) })

    if (!room) {
      throw new ErrorWithStatus({
        message: ROOM_MESSAGES.ROOM_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const updateRoomValidator = validate(
  checkSchema<keyof IAddRoomRequestBody>(
    {
      roomName: {
        notEmpty: {
          errorMessage: 'Room name is required'
        },
        isString: {
          errorMessage: 'Room name must be a string'
        }
      }
    },
    ['body']
  )
)
