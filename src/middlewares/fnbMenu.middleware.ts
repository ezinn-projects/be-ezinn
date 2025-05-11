/**
 * @description Validate request body khi tạo FNB Menu
 * Yêu cầu:
 * - name: không được rỗng, phải là string
 * - price: không được rỗng, phải là số
 * - description: không được rỗng, phải là string
 * - image: không được rỗng, phải là string
 * - category: không được rỗng, phải là string
 * - inventory: phải có các trường quantity, unit, minStock, maxStock
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
    },
    'inventory.quantity': {
      optional: true,
      isNumeric: {
        errorMessage: 'Quantity must be a number'
      }
    },
    'inventory.unit': {
      optional: true,
      isString: {
        errorMessage: 'Unit must be a string'
      }
    },
    'inventory.minStock': {
      optional: true,
      isNumeric: {
        errorMessage: 'Min stock must be a number'
      }
    },
    'inventory.maxStock': {
      optional: true,
      isNumeric: {
        errorMessage: 'Max stock must be a number'
      }
    }
  })
)

export const updateFNBMenuValidator = validate(
  checkSchema({
    name: {
      optional: true,
      isString: {
        errorMessage: 'Name must be a string'
      }
    },
    price: {
      optional: true,
      isNumeric: {
        errorMessage: 'Price must be a number'
      }
    },
    description: {
      optional: true,
      isString: {
        errorMessage: 'Description must be a string'
      }
    },
    image: {
      optional: true,
      isString: {
        errorMessage: 'Image must be a string'
      }
    },
    category: {
      optional: true,
      isString: {
        errorMessage: 'Category must be a string'
      }
    },
    'inventory.quantity': {
      optional: true,
      isNumeric: {
        errorMessage: 'Quantity must be a number'
      }
    },
    'inventory.unit': {
      optional: true,
      isString: {
        errorMessage: 'Unit must be a string'
      }
    },
    'inventory.minStock': {
      optional: true,
      isNumeric: {
        errorMessage: 'Min stock must be a number'
      }
    },
    'inventory.maxStock': {
      optional: true,
      isNumeric: {
        errorMessage: 'Max stock must be a number'
      }
    }
  })
)
