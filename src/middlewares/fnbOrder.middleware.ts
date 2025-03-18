import { NextFunction, Request, Response } from 'express'
import { checkSchema } from 'express-validator'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import databaseService from '~/services/database.service'
import { validate } from '~/utils/validation'

/**
 * @description Validate request body khi tạo FNB Order
 * Yêu cầu:
 * - roomScheduleId: không được rỗng, phải là MongoId hợp lệ
 * - order: phải là object, chứa property drinks và snacks, mỗi property là object với giá trị số
 * - createdBy: nếu có, phải là string
 */
export const createFNBOrderValidator = validate(
  checkSchema({
    roomScheduleId: {
      notEmpty: {
        errorMessage: 'Room schedule id is required'
      },
      isMongoId: {
        errorMessage: 'Invalid room schedule id'
      }
    },
    order: {
      notEmpty: {
        errorMessage: 'Order is required'
      },
      custom: {
        options: (order: any) => {
          if (typeof order !== 'object' || order === null) {
            throw new Error('Order must be an object')
          }
          if (!order.drinks || typeof order.drinks !== 'object') {
            throw new Error('Order must have a drinks object')
          }
          if (!order.snacks || typeof order.snacks !== 'object') {
            throw new Error('Order must have a snacks object')
          }
          // Kiểm tra mỗi value trong drinks và snacks phải là số
          for (const key in order.drinks) {
            if (typeof order.drinks[key] !== 'number') {
              throw new Error(`Drink quantity for "${key}" must be a number`)
            }
          }
          for (const key in order.snacks) {
            if (typeof order.snacks[key] !== 'number') {
              throw new Error(`Snack quantity for "${key}" must be a number`)
            }
          }
          return true
        }
      }
    },
    createdBy: {
      optional: true,
      isString: {
        errorMessage: 'createdBy must be a string'
      }
    }
  })
)

/**
 * @description Validate id của FNB Order trong params
 */
export const checkFNBOrderIdValidator = validate(
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

/**
 * @description Kiểm tra FNB Order không tồn tại (để update, delete, hoặc get theo id)
 */
export const checkFNBOrderNotExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const order = await databaseService.fnbOrder.findOne({ _id: new ObjectId(id) })

    if (!order) {
      throw new ErrorWithStatus({
        message: FNB_MESSAGES.FNB_ORDER_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}
