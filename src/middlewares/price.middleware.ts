import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { ObjectId } from 'mongodb'
import { DayType, RoomType } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { Price_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { TimeSlot } from '~/models/schemas/Price.schema'
import databaseService from '~/services/database.services'
import { validate } from '~/utils/validation'

export const createPriceValidator = validate(
  checkSchema({
    timeSlots: {
      notEmpty: {
        errorMessage: 'Time slots array is required'
      },
      isArray: {
        errorMessage: 'Time slots must be an array'
      },
      custom: {
        options: (timeSlots: TimeSlot[]) => {
          if (!timeSlots.length || timeSlots.length !== 3) {
            throw new ErrorWithStatus({
              message: 'Must have exactly 3 time slots',
              status: HTTP_STATUS_CODE.BAD_REQUEST
            })
          }

          // Kiểm tra từng time slot
          return timeSlots.every((slot, index) => {
            if (!slot.start || !slot.end) {
              throw new ErrorWithStatus({
                message: 'Start and end time are required',
                status: HTTP_STATUS_CODE.BAD_REQUEST
              })
            }

            // Kiểm tra thời gian hợp lệ
            const start = new Date(`2024-01-01T${slot.start}`)
            const end = new Date(`2024-01-01T${slot.end}`)

            if (start >= end) {
              throw new ErrorWithStatus({
                message: 'End time must be greater than start time',
                status: HTTP_STATUS_CODE.BAD_REQUEST
              })
            }

            // Kiểm tra prices
            if (!slot.prices?.length) {
              throw new ErrorWithStatus({
                message: 'Prices are required for each time slot',
                status: HTTP_STATUS_CODE.BAD_REQUEST
              })
            }

            return true
          })
        }
      }
    },
    dayType: {
      notEmpty: {
        errorMessage: 'Day type is required'
      },
      isIn: {
        options: [Object.values(DayType)],
        errorMessage: 'Invalid day type'
      }
    },
    effectiveDate: {
      notEmpty: {
        errorMessage: 'Effective date is required'
      },
      isISO8601: {
        errorMessage: 'Invalid date format'
      }
    }
  })
)

export const checkPriceIdValidator = validate(
  checkSchema(
    {
      id: {
        notEmpty: {
          errorMessage: 'Id is required'
        },
        isMongoId: {
          errorMessage: 'Invalid id'
        }
      }
    },
    ['params']
  )
)

export const checkPriceIdArrayValidator = validate(
  checkSchema(
    {
      ids: {
        notEmpty: {
          errorMessage: 'Ids is required'
        },
        isArray: {
          errorMessage: 'Ids must be an array'
        }
      }
    },
    ['body']
  )
)

export const checkPriceExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const Price = await databaseService.price.findOne({ _id: new ObjectId(id) })

    if (Price) {
      throw new ErrorWithStatus({
        message: Price_MESSAGES.Price_EXISTS,
        status: HTTP_STATUS_CODE.CONFLICT
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const checkPriceNotExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const Price = await databaseService.price.findOne({ _id: new ObjectId(id) })

    if (!Price) {
      throw new ErrorWithStatus({
        message: Price_MESSAGES.Price_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}
