import { Request, Response, NextFunction } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
// import { HTTP_STATUS_CODE } from '~/constants/httpStatusCode'
import fnbMenuService from '~/services/fnbMenu.service'
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '~/services/cloudinary.service'
import CloudinaryResponse from '~/models/CloudinaryResponse'
import { Variant } from '~/models/schemas/FnBMenu.schema'

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

// Thêm utility function để xử lý giá
const processPrice = (price: string | number): number => {
  if (typeof price === 'number') return price
  // Xử lý chuỗi giá định dạng "15.000" hoặc "15,000"
  return parseInt(price.replace(/[.,]/g, ''))
}

/**
 * @description Create new menu item
 * @path /fnb-menu
 * @method POST
 */
export const createMenuItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, description, category, createdAt, inventory, hasVariants, variants } = req.body
    const files = req.files as Express.Multer.File[] | undefined

    // Kiểm tra nếu không có file hình ảnh
    if (!files || files.length === 0) {
      console.log('Không có hình ảnh được cung cấp')
    }

    let imageUrl = ''

    // Xử lý upload hình ảnh chính nếu có file với fieldname 'images' hoặc 'file'
    const mainImageFile = files?.find((file) => file.fieldname === 'images' || file.fieldname === 'file')
    if (mainImageFile) {
      try {
        console.log('Đang upload hình ảnh chính...')
        const result = (await uploadImageToCloudinary(mainImageFile.buffer, 'fnb-menu')) as CloudinaryResponse
        imageUrl = result.url
        console.log('Upload thành công, URL:', imageUrl)
      } catch (error) {
        console.error('Lỗi khi upload hình ảnh chính:', error)
        throw new Error(`Failed to upload main image: ${(error as Error).message}`)
      }
    }

    // Xử lý giá sản phẩm
    const numericPrice = processPrice(price)

    // Xử lý variants và inventory dựa trên hasVariants
    let processedVariants: Variant[] | undefined
    let processedInventory: any = undefined

    if (hasVariants && variants) {
      let variantsData = variants

      // Kiểm tra nếu variants là chuỗi JSON (từ FormData)
      if (typeof variants === 'string') {
        try {
          variantsData = JSON.parse(variants)
        } catch (error) {
          console.error('Lỗi khi parse variants JSON:', error)
          variantsData = []
        }
      }

      // Validate variants inventory
      if (!variantsData.every((v: any) => v.inventory && typeof v.inventory.quantity === 'number')) {
        throw new Error('Mỗi variant phải có thông tin inventory với số lượng')
      }

      // Tạo map để lưu trữ file theo tên
      const fileMap = new Map<string, Express.Multer.File>()
      if (files) {
        files.forEach((file) => {
          fileMap.set(file.fieldname, file)
        })
      }

      // Xử lý upload hình ảnh cho variants
      processedVariants = await Promise.all(
        variantsData.map(async (variant: any, index: number) => {
          let variantImageUrl = undefined

          // Kiểm tra nếu variant có yêu cầu upload hình ảnh
          if (variant.image && variant.image.startsWith('variantFile_')) {
            const file = fileMap.get(variant.image)
            if (file) {
              try {
                console.log(`Đang upload hình ảnh cho variant ${variant.name}...`)
                const result = (await uploadImageToCloudinary(file.buffer, 'fnb-menu-variants')) as CloudinaryResponse
                variantImageUrl = result.url
                console.log(`Upload hình ảnh variant ${variant.name} thành công`)
              } catch (error) {
                console.error(`Lỗi khi upload hình ảnh variant ${variant.name}:`, error)
                throw new Error(`Failed to upload image for variant ${variant.name}: ${(error as Error).message}`)
              }
            }
          }

          return {
            name: variant.name,
            price: variant.price ? processPrice(variant.price) : numericPrice,
            isAvailable: variant.isAvailable ?? true,
            image: variantImageUrl,
            inventory: {
              quantity: variant.inventory?.quantity || 0,
              unit: variant.inventory?.unit || 'piece',
              minStock: variant.inventory?.minStock || 0,
              maxStock: variant.inventory?.maxStock || 0,
              lastUpdated: new Date()
            }
          }
        })
      )
    } else {
      // Validate inventory cho sản phẩm không có variants
      if (!inventory || typeof inventory.quantity !== 'number') {
        throw new Error('Sản phẩm không có variants phải có thông tin inventory với số lượng')
      }

      // Xử lý inventory ở cấp độ sản phẩm
      processedInventory = {
        quantity: inventory.quantity,
        unit: inventory.unit || 'piece',
        minStock: inventory.minStock || 0,
        maxStock: inventory.maxStock || 0,
        lastUpdated: new Date()
      }
    }

    const menuItem = {
      name,
      price: numericPrice,
      description: description || '',
      image: imageUrl,
      category,
      hasVariants: hasVariants || false,
      variants: processedVariants,
      ...(processedInventory && { inventory: processedInventory }),
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
    const { name, price, description, image, category, inventory, hasVariants, variants } = req.body
    const files = req.files as Express.Multer.File[] | undefined
    const menuItem: any = {
      name,
      description,
      category,
      updatedAt: new Date()
    }

    // Xử lý giá nếu được cung cấp
    if (price) {
      menuItem.price = processPrice(price)
    }

    // Xử lý variants và inventory dựa trên hasVariants
    if (hasVariants !== undefined) {
      menuItem.hasVariants = hasVariants

      if (hasVariants && variants) {
        let variantsData = variants

        // Kiểm tra nếu variants là chuỗi JSON (từ FormData)
        if (typeof variants === 'string') {
          try {
            variantsData = JSON.parse(variants)
          } catch (error) {
            console.error('Lỗi khi parse variants JSON:', error)
            variantsData = []
          }
        }

        // Tạo map để lưu trữ file theo tên
        const fileMap = new Map<string, Express.Multer.File>()
        if (files) {
          files.forEach((file) => {
            fileMap.set(file.fieldname, file)
          })
        }

        // Xử lý upload hình ảnh cho variants
        menuItem.variants = await Promise.all(
          variantsData.map(async (variant: any, index: number) => {
            let variantImageUrl = variant.image || undefined

            // Kiểm tra nếu variant có yêu cầu upload hình ảnh mới
            if (variant.image && variant.image.startsWith('variantFile_')) {
              const file = fileMap.get(variant.image)
              if (file) {
                try {
                  console.log(`Đang upload hình ảnh cho variant ${variant.name}...`)
                  const result = (await uploadImageToCloudinary(file.buffer, 'fnb-menu-variants')) as CloudinaryResponse
                  variantImageUrl = result.url
                  console.log(`Upload hình ảnh variant ${variant.name} thành công`)
                } catch (error) {
                  console.error(`Lỗi khi upload hình ảnh variant ${variant.name}:`, error)
                  throw new Error(`Failed to upload image for variant ${variant.name}: ${(error as Error).message}`)
                }
              }
            }

            return {
              name: variant.name,
              price: variant.price ? processPrice(variant.price) : menuItem.price,
              isAvailable: variant.isAvailable ?? true,
              image: variantImageUrl,
              inventory: {
                quantity: variant.inventory?.quantity || 0,
                unit: variant.inventory?.unit || 'piece',
                minStock: variant.inventory?.minStock || 0,
                maxStock: variant.inventory?.maxStock || 0,
                lastUpdated: new Date()
              }
            }
          })
        )

        // Xóa inventory ở cấp độ sản phẩm nếu có variants
        menuItem.inventory = undefined
      } else {
        // Nếu chuyển từ có variants sang không có variants
        menuItem.variants = []

        // Xử lý inventory ở cấp độ sản phẩm
        if (inventory) {
          let inventoryData = inventory

          if (typeof inventory === 'string') {
            try {
              inventoryData = JSON.parse(inventory)
            } catch (error) {
              console.error('Lỗi khi parse inventory JSON:', error)
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
      }
    }

    // Xử lý upload hình ảnh chính
    const mainImageFile = files?.find((file) => file.fieldname === 'images' || file.fieldname === 'file')
    if (mainImageFile) {
      try {
        const result = (await uploadImageToCloudinary(mainImageFile.buffer, 'fnb-menu')) as CloudinaryResponse
        menuItem.image = result.url
      } catch (error) {
        console.error('Lỗi khi upload hình ảnh chính:', error)
        throw new Error(`Failed to upload main image: ${(error as Error).message}`)
      }
    } else if (image) {
      menuItem.image = image
    }

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
