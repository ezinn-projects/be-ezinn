/**
 * @description Validate request body khi tạo FNB Menu
 * Yêu cầu:
 * - name: không được rỗng, phải là string
 * - price: không được rỗng, phải là số
 * - description: không được rỗng, phải là string
 * - image: không được rỗng, phải là string
 * - category: không được rỗng, phải là string
 */

import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation'

export const createFNBMenuValidator = validate(
  checkSchema({
    name: {
      notEmpty: {
        errorMessage: 'Name is required'
      },
      isString: {
        errorMessage: 'Name must be a string'
      }
    },
    price: {
      notEmpty: {
        errorMessage: 'Price is required'
      },
      isNumeric: {
        errorMessage: 'Price must be a number'
      }
    },
    description: {
      notEmpty: {
        errorMessage: 'Description is required'
      },
      isString: {
        errorMessage: 'Description must be a string'
      }
    },
    image: {
      notEmpty: {
        errorMessage: 'Image is required'
      },
      isString: {
        errorMessage: 'Image must be a string'
      }
    },
    category: {
      notEmpty: {
        errorMessage: 'Category is required'
      },
      isString: {
        errorMessage: 'Category must be a string'
      }
    }
  })
)

export const updateFNBMenuValidator = validate(
  checkSchema({
    name: {
      notEmpty: {
        errorMessage: 'Name is required'
      },
      isString: {
        errorMessage: 'Name must be a string'
      }
    },
    price: {
      notEmpty: {
        errorMessage: 'Price is required'
      },
      isNumeric: {
        errorMessage: 'Price must be a number'
      }
    },
    description: {
      notEmpty: {
        errorMessage: 'Description is required'
      },
      isString: {
        errorMessage: 'Description must be a string'
      }
    },
    image: {
      notEmpty: {
        errorMessage: 'Image is required'
      },
      isString: {
        errorMessage: 'Image must be a string'
      }
    },
    category: {
      notEmpty: {
        errorMessage: 'Category is required'
      },
      isString: {
        errorMessage: 'Category must be a string'
      }
    }
  })
)
