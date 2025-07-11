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
import { Request, Response, NextFunction } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'

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

/**
 * @description Validate files upload cho FNB Menu
 */
export const validateFnBMenuFiles = (req: Request, res: Response, next: NextFunction) => {
  const files = req.files as Express.Multer.File[]

  if (files && files.length > 10) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Maximum 10 files allowed'
    })
  }

  if (files && !files.every((file) => file.mimetype.startsWith('image/'))) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'All files must be images'
    })
  }

  // Kiểm tra kích thước file (tối đa 5MB mỗi file)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (files && files.some((file) => file.size > maxSize)) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'File size must not exceed 5MB'
    })
  }

  // Kiểm tra tên field của file (chỉ cho phép các pattern hợp lệ)
  if (
    files &&
    files.some((file) => {
      const fieldName = file.fieldname
      // Cho phép: images, file, variantFile_*, hoặc các tên field khác bắt đầu bằng variantFile
      return !fieldName.match(/^(images|file|variantFile_\d+)$/)
    })
  ) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Invalid file field names. Only "images", "file" and "variantFile_X" are allowed'
    })
  }

  next()
}

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
