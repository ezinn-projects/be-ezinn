import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { ObjectId } from 'mongodb'
import { DayType, RoomSize } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { PRICING_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import databaseService from '~/services/database.services'
import { validate } from '~/utils/validation'

export const createPricingValidator = validate(
  checkSchema({
    price: {
      notEmpty: {
        errorMessage: 'Price is required'
      },
      isNumeric: {
        errorMessage: 'Price must be a number'
      }
    },
    room_size: {
      notEmpty: {
        errorMessage: 'Room size is required'
      },
      isIn: {
        options: [Object.values(RoomSize)],
        errorMessage: 'Invalid room size'
      }
    },
    day_type: {
      notEmpty: {
        errorMessage: 'Day type is required'
      },
      isIn: {
        options: [Object.values(DayType)],
        errorMessage: 'Invalid day type'
      }
    },
    effective_date: {
      notEmpty: {
        errorMessage: 'Effective date is required'
      }
    }
  })
)

export const checkPricingIdValidator = validate(
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

export const checkPricingIdArrayValidator = validate(
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

export const checkPricingExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const pricing = await databaseService.price.findOne({ _id: new ObjectId(id) })

    if (pricing) {
      throw new ErrorWithStatus({
        message: PRICING_MESSAGES.PRICING_EXISTS,
        status: HTTP_STATUS_CODE.CONFLICT
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const checkPricingNotExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const pricing = await databaseService.price.findOne({ _id: new ObjectId(id) })

    if (!pricing) {
      throw new ErrorWithStatus({
        message: PRICING_MESSAGES.PRICING_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}
