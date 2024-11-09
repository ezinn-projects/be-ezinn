import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation'

export const addHouseRuleValidator = validate(
  checkSchema(
    {
      rule: {
        notEmpty: {
          errorMessage: 'Rule is required'
        },
        isString: {
          errorMessage: 'Rule must be a string'
        },
        trim: true
      },
      description: {
        notEmpty: {
          errorMessage: 'Description is required'
        },
        isString: {
          errorMessage: 'Description must be a string'
        },
        trim: true
      },
      status: {
        isIn: {
          options: [['active', 'inactive']],
          errorMessage: "Status must be either 'active' or 'inactive'"
        },
        optional: true
      }
    },
    ['body']
  )
)
