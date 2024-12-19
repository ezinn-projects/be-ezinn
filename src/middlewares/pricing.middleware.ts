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
      },
      isDate: {
        errorMessage: 'Invalid effective date'
      }
    },
    end_date: {
      notEmpty: {
        errorMessage: 'End date is required'
      },
      isDate: {
        errorMessage: 'Invalid end date'
      }
    }
  })
)

export const updatePricingValidator = validate(
  checkSchema({
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
      },
      isDate: {
        errorMessage: 'Invalid effective date'
      }
    },
    end_date: {
      isDate: {
        errorMessage: 'Invalid end date'
      },
      optional: true
    }
  })
)

export const checkPricingExists = async (req: Request, res: Response, next: NextFunction) => {
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
