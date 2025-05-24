import { Request, Response, NextFunction } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
// import { HTTP_STATUS_CODE } from '~/constants/httpStatusCode'
import fnbMenuService from '~/services/fnbMenu.service'
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '~/services/cloudinary.service'
import CloudinaryResponse from '~/models/CloudinaryResponse'

/**
 * @description Get all menu items
 * @path /fnb-menu
 * @method GET
 */
export const getAllMenuItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fnbMenuService.getAllFnbMenu()
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get all FNB menu items successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get menu item by id
 * @path /fnb-menu/:id
 * @method GET
 */
export const getMenuItemById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fnbMenuService.getFnbMenuById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get FNB menu item by ID successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Create new menu item
 * @path /fnb-menu
 * @method POST
 */
export const createMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, description, category, createdAt, inventory } = req.body
    const file = req.file as Express.Multer.File | undefined

    // Kiểm tra nếu không có file hình ảnh
    if (!file) {
      console.log('Không có hình ảnh được cung cấp')
    }

    let imageUrl = ''

    // Xử lý upload hình ảnh nếu có file
    if (file) {
      try {
        console.log('Đang upload hình ảnh...')
        const result = (await uploadImageToCloudinary(file.buffer, 'fnb-menu')) as CloudinaryResponse
        imageUrl = result.url
        console.log('Upload thành công, URL:', imageUrl)
      } catch (error) {
        console.error('Lỗi khi upload hình ảnh:', error)
        throw new Error(`Failed to upload image: ${(error as Error).message}`)
      }
    }

    // Chuyển đổi giá từ chuỗi "15.000" sang số
    const numericPrice = parseFloat(price.replace('.', ''))

    const menuItem = {
      name,
      price: numericPrice,
      description: description || '',
      image: imageUrl,
      category,
      inventory: {
        quantity: inventory?.quantity || 0,
        unit: inventory?.unit || 'piece',
        minStock: inventory?.minStock || 0,
        maxStock: inventory?.maxStock || 0,
        lastUpdated: new Date()
      },
      createdAt: createdAt ? new Date(createdAt) : new Date()
    }

    console.log('menuItem trước khi lưu:', menuItem)

    const result = await fnbMenuService.createFnbMenu(menuItem)
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: 'Create FNB menu item successfully',
      result
    })
  } catch (error) {
    console.error('Lỗi trong createMenuItem:', error)
    next(error)
  }
}

/**
 * @description Update menu item
 * @path /fnb-menu/:id
 * @method PUT
 */
export const updateMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, description, image, category, inventory } = req.body
    const menuItem: any = {
      name,
      description,
      category,
      updatedAt: new Date()
    }

    // Xử lý giá nếu được cung cấp
    if (price) {
      // Chuyển đổi giá từ chuỗi "15.000" sang số nếu là chuỗi
      const numericPrice = typeof price === 'string' ? parseFloat(price.replace('.', '')) : price
      menuItem.price = numericPrice
    }

    // Xử lý inventory nếu được cung cấp
    if (inventory) {
      let inventoryData = inventory

      // Kiểm tra nếu inventory là chuỗi JSON (từ FormData)
      if (typeof inventory === 'string') {
        try {
          inventoryData = JSON.parse(inventory)
        } catch (error) {
          console.error('Lỗi khi parse inventory JSON:', error)
          // Sử dụng giá trị mặc định nếu parse thất bại
          inventoryData = { quantity: 0, unit: 'piece', minStock: 0, maxStock: 0 }
        }
      }

      menuItem.inventory = {
        quantity: inventoryData.quantity !== undefined ? inventoryData.quantity : 0,
        unit: inventoryData.unit || 'piece',
        minStock: inventoryData.minStock !== undefined ? inventoryData.minStock : 0,
        maxStock: inventoryData.maxStock !== undefined ? inventoryData.maxStock : 0,
        lastUpdated: new Date()
      }
    }

    const file = req.file as Express.Multer.File | undefined

    // Chỉ cập nhật hình ảnh nếu có file mới được tải lên
    if (file) {
      const result = (await uploadImageToCloudinary(file.buffer, 'fnb-menu')) as CloudinaryResponse
      menuItem.image = result.url
    } else if (image) {
      // Nếu không có file mới nhưng có image trong request body, sử dụng image đó
      menuItem.image = image
    }
    // Nếu không có cả file và image trong request, giữ nguyên hình ảnh cũ

    const result = await fnbMenuService.updateFnbMenu(req.params.id, menuItem)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Update FNB menu item successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete menu item
 * @path /fnb-menu/:id
 * @method DELETE
 */
export const deleteMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fnbMenuService.deleteFnbMenu(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Delete FNB menu item successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}
