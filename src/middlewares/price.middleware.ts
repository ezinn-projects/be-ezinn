import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { ObjectId } from 'mongodb'
import { DayType, RoomType } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { Price_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import databaseService from '~/services/database.services'
import { validate } from '~/utils/validation'

export const createPriceValidator = validate(
  checkSchema({
    prices: {
      notEmpty: {
        errorMessage: 'Prices array is required'
      },
      isArray: {
        errorMessage: 'Prices must be an array'
      },
      custom: {
        options: (prices: { roomType: string; price: number }[]) => {
          if (!prices.length) {
            throw new Error('Prices array cannot be empty')
          }

          // Kiểm tra từng item trong mảng prices
          return prices.every((item) => {
            if (!item.roomType || !Object.values(RoomType).includes(item.roomType as RoomType)) {
              throw new Error('Invalid room type')
            }
            if (typeof item.price !== 'number' || item.price <= 0) {
              throw new Error('Price must be a positive number')
            }
            return true
          })
        }
      }
    },
    timeRange: {
      notEmpty: {
        errorMessage: 'Time range is required'
      },
      custom: {
        options: (value: { start: string; end: string }) => {
          const { start, end } = value

          const adjustedEnd = end === '00:00' ? '24:00' : end

          return new Date(`2024-12-21T${start}`) <= new Date(`2024-12-21T${adjustedEnd}`)
        },
        errorMessage: 'End time must be greater than start time'
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
