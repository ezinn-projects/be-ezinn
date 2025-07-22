import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ICreateFNBOrderRequestBody } from '~/models/requests/FNB.request'
import fnbOrderService from '~/services/fnbOrder.service'
import fnbMenuItemService from '~/services/fnbMenuItem.service'
import databaseService from '~/services/database.service'
import { BillService } from '~/services/bill.service'
import { ObjectId } from 'mongodb'
import { cleanOrderDetail } from '../utils/common'

/**
 * @description Create FNB Order
 * @path /fnb-orders
 * @method POST
 */
export const createFnbOrder = async (
  req: Request<ParamsDictionary, any, ICreateFNBOrderRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomScheduleId, order, createdBy } = req.body
    const result = await fnbOrderService.createFnbOrder(roomScheduleId, order, createdBy)
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: FNB_MESSAGES.CREATE_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Order by ID
 * @path /fnb-orders/:id
 * @method GET
 */
export const getFnbOrderById = async (
  req: Request<ParamsDictionary, any, any, any>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await fnbOrderService.getFnbOrderById(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDER_BY_ID_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Delete FNB Order
 * @path /fnb-orders/:id
 * @method DELETE
 */
export const deleteFnbOrder = async (req: Request<ParamsDictionary, any, any>, res: Response, next: NextFunction) => {
  try {
    const result = await fnbOrderService.deleteFnbOrder(req.params.id)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.DELETE_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Orders by Room Schedule ID
 * @path /fnb-orders/room-schedule/:roomScheduleId
 * @method GET
 */
export const getFnbOrdersByRoomSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fnbOrderService.getFnbOrdersByRoomSchedule(req.params.roomScheduleId)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDERS_BY_ROOM_SCHEDULE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Upsert FNB Order
 * @path /fnb-orders
 * @method POST
 */
export const upsertFnbOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId, order, createdBy } = req.body
    const result = await fnbOrderService.upsertFnbOrder(roomScheduleId, order, createdBy)
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.UPSERT_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get updated bill with latest FNB items for a room schedule
 * @path /fnb-orders/bill/:roomScheduleId
 * @method GET
 */
export const getUpdatedBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId } = req.params

    const billService = new BillService()
    const bill = await billService.getBill(roomScheduleId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Lấy bill thành công',
      result: bill
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Add items to existing FNB order and update bill
 * @path /fnb-orders/add-items
 * @method POST
 */
export const addItemsToOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId, items, createdBy } = req.body

    // Step 1: Check inventory availability
    const inventoryResults = []
    for (const { itemId, quantity } of items) {
      // Tìm trong menu chính (fnb_menu collection) trước
      let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
      let isVariant = false

      // Nếu không tìm thấy, tìm trong menu items (fnb_menu_item collection)
      if (!item) {
        const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
        if (menuItem) {
          item = menuItem
          isVariant = true
        }
      }

      if (!item) {
        return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
          message: `Không tìm thấy item ${itemId}`
        })
      }

      if ((item.inventory?.quantity ?? 0) < quantity) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          message: `Item ${item.name} không đủ hàng (còn ${item.inventory?.quantity || 0}, cần ${quantity})`
        })
      }

      inventoryResults.push({ item, isVariant })
    }

    // Step 2: Get existing order or create new one
    let existingOrder = await fnbOrderService.getFnbOrdersByRoomSchedule(roomScheduleId)
    let currentOrder = existingOrder.length > 0 ? existingOrder[0] : null

    // Prepare new items to add
    const newItems: { snacks: Record<string, number>; drinks: Record<string, number> } = {
      snacks: {},
      drinks: {}
    }

    for (const { itemId, quantity } of items) {
      const item = inventoryResults.find((i) => i.item._id.toString() === itemId)
      if (item) {
        if (item.item.category === 'snack') {
          newItems.snacks[itemId] = quantity
        } else if (item.item.category === 'drink') {
          newItems.drinks[itemId] = quantity
        }
      }
    }

    // Step 3: Update or create order
    let orderResult
    if (currentOrder) {
      // Merge with existing order
      const mergedOrder = {
        snacks: { ...currentOrder.order.snacks, ...newItems.snacks },
        drinks: { ...currentOrder.order.drinks, ...newItems.drinks }
      }
      orderResult = await fnbOrderService.upsertFnbOrder(roomScheduleId, mergedOrder, createdBy)
    } else {
      // Create new order
      orderResult = await fnbOrderService.createFnbOrder(roomScheduleId, newItems, createdBy)
    }

    // Step 4: Generate updated bill
    const billService = new BillService()
    let updatedBill
    try {
      updatedBill = await billService.getBill(roomScheduleId)
      console.log('Bill đã được cập nhật với items mới')
    } catch (billError) {
      console.error('Lỗi khi tạo bill:', billError)
      updatedBill = null
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Thêm items thành công',
      result: {
        order: orderResult,
        addedItems: items,
        bill: updatedBill
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get detailed bill with FNB items breakdown
 * @path /fnb-orders/bill-details/:roomScheduleId
 * @method GET
 */
export const getBillDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId } = req.params

    // Get bill
    const billService = new BillService()
    const bill = await billService.getBill(roomScheduleId)

    // Get FNB orders for this room schedule
    const fnbOrders = await fnbOrderService.getFnbOrdersByRoomSchedule(roomScheduleId)

    // Get menu items for reference
    const menu = await databaseService.fnbMenu.find({}).toArray()

    // Process FNB items for detailed breakdown
    const fnbItemsBreakdown = []
    if (fnbOrders.length > 0) {
      const order = fnbOrders[0]

      // Process drinks
      if (order.order.drinks && Object.keys(order.order.drinks).length > 0) {
        for (const [itemId, quantity] of Object.entries(order.order.drinks)) {
          let menuItem = menu.find((m) => m._id.toString() === itemId)
          let itemName = ''
          let itemPrice = 0

          if (menuItem) {
            itemName = menuItem.name
            itemPrice = menuItem.price
          } else {
            // Check variants
            for (const menuItem of menu) {
              if (menuItem.variants && Array.isArray(menuItem.variants)) {
                const variant = menuItem.variants.find((v: any) => v.id === itemId)
                if (variant) {
                  itemName = `${menuItem.name} - ${variant.name}`
                  itemPrice = variant.price
                  break
                }
              }
            }
          }

          if (itemName && itemPrice > 0) {
            fnbItemsBreakdown.push({
              id: itemId,
              name: itemName,
              category: 'drink',
              quantity: quantity,
              unitPrice: itemPrice,
              totalPrice: quantity * itemPrice,
              type: 'fnb'
            })
          }
        }
      }

      // Process snacks
      if (order.order.snacks && Object.keys(order.order.snacks).length > 0) {
        for (const [itemId, quantity] of Object.entries(order.order.snacks)) {
          let menuItem = menu.find((m) => m._id.toString() === itemId)
          let itemName = ''
          let itemPrice = 0

          if (menuItem) {
            itemName = menuItem.name
            itemPrice = menuItem.price
          } else {
            // Check variants
            for (const menuItem of menu) {
              if (menuItem.variants && Array.isArray(menuItem.variants)) {
                const variant = menuItem.variants.find((v: any) => v.id === itemId)
                if (variant) {
                  itemName = `${menuItem.name} - ${variant.name}`
                  itemPrice = variant.price
                  break
                }
              }
            }
          }

          if (itemName && itemPrice > 0) {
            fnbItemsBreakdown.push({
              id: itemId,
              name: itemName,
              category: 'snack',
              quantity: quantity,
              unitPrice: itemPrice,
              totalPrice: quantity * itemPrice,
              type: 'fnb'
            })
          }
        }
      }
    }

    // Separate service items from FNB items in bill
    const serviceItems = bill.items.filter((item) => item.description.includes('Phi dich vu thu am'))

    const result = {
      bill: {
        ...bill,
        items: bill.items
      },
      breakdown: {
        serviceItems: serviceItems,
        fnbItems: fnbItemsBreakdown,
        totalServiceAmount: serviceItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        totalFnbAmount: fnbItemsBreakdown.reduce((sum, item) => sum + item.totalPrice, 0)
      },
      summary: {
        totalItems: bill.items.length,
        serviceItemsCount: serviceItems.length,
        fnbItemsCount: fnbItemsBreakdown.length,
        totalAmount: bill.totalAmount
      }
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Lấy chi tiết bill thành công',
      result: result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Complete FNB Order (deduct inventory + create order + update bill)
 * @path /fnb-orders/complete
 * @method POST
 */
export const completeOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId, items, createdBy } = req.body

    // Step 1: Deduct inventory
    const inventoryResults = []
    for (const { itemId, quantity } of items) {
      // Tìm trong menu chính (fnb_menu collection) trước
      let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
      let isVariant = false

      // Nếu không tìm thấy, tìm trong menu items (fnb_menu_item collection)
      if (!item) {
        const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
        if (menuItem) {
          item = menuItem
          isVariant = true
        }
      }

      if (!item) {
        return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
          message: `Không tìm thấy item ${itemId}`
        })
      }

      if ((item.inventory?.quantity ?? 0) < quantity) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          message: `Item ${item.name} không đủ hàng (còn ${item.inventory?.quantity || 0}, cần ${quantity})`
        })
      }

      // Deduct inventory - cập nhật trực tiếp trong database
      if (item.inventory) {
        if (isVariant) {
          // Nếu là variant, cập nhật trong fnb_menu_item collection
          await fnbMenuItemService.updateMenuItem(itemId, {
            inventory: {
              ...item.inventory,
              quantity: item.inventory.quantity - quantity,
              lastUpdated: new Date()
            },
            updatedAt: new Date()
          })
        } else {
          // Nếu là menu chính, cập nhật trong fnb_menu collection
          await databaseService.fnbMenu.updateOne(
            { _id: new ObjectId(itemId) },
            {
              $set: {
                'inventory.quantity': item.inventory.quantity - quantity,
                'inventory.lastUpdated': new Date()
              }
            }
          )
        }
      }

      // Lấy item đã cập nhật
      const updatedItem = isVariant
        ? await fnbMenuItemService.getMenuItemById(itemId)
        : await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
      inventoryResults.push({ item: updatedItem, isVariant })
    }

    // Step 2: Create order
    const order: { snacks: Record<string, number>; drinks: Record<string, number> } = {
      snacks: {},
      drinks: {}
    }

    // Group items by category
    console.log('=== DEBUG ORDER CREATION ===')
    console.log('Items to process:', items)
    console.log(
      'Inventory results:',
      inventoryResults.map((i) => ({ id: i.item?._id?.toString(), name: i.item?.name, category: i.item?.category }))
    )

    for (const { itemId, quantity } of items) {
      const item = inventoryResults.find((i) => i.item?._id?.toString() === itemId)
      console.log(`Looking for itemId: ${itemId}`)
      console.log(
        `Found item:`,
        item && item.item
          ? { id: item.item._id?.toString(), name: item.item.name, category: item.item.category }
          : 'NOT FOUND'
      )

      if (item && item.item) {
        console.log(`Processing item: ${item.item.name}, category: ${item.item.category}, quantity: ${quantity}`)
        console.log(`Item full data:`, JSON.stringify(item.item, null, 2))

        let category = item.item.category

        // Nếu item không có category và có parentId, tìm category từ parent
        if (!category && 'parentId' in item.item && item.item.parentId) {
          console.log(`Item has parentId: ${item.item.parentId}, looking for parent category...`)
          const parentItem = await fnbMenuItemService.getMenuItemById(item.item.parentId)
          if (parentItem && parentItem.category) {
            category = parentItem.category
            console.log(`Found parent category: ${category}`)
          }
        }

        if (category === 'snack') {
          order.snacks[itemId] = quantity
          console.log(`Added to snacks: ${itemId} = ${quantity}`)
        } else if (category === 'drink') {
          order.drinks[itemId] = quantity
          console.log(`Added to drinks: ${itemId} = ${quantity}`)
        } else {
          console.log(`Item category is not 'snack' or 'drink': ${category}`)
          // Fallback: nếu không có category hoặc category không đúng, mặc định là snack
          order.snacks[itemId] = quantity
          console.log(`Added to snacks (fallback): ${itemId} = ${quantity}`)
        }
      } else {
        console.log(`Item not found in inventoryResults for itemId: ${itemId}`)
      }
    }

    console.log('Final order:', order)
    console.log('=== END DEBUG ===')

    const orderResult = await fnbOrderService.createFnbOrder(roomScheduleId, order, createdBy)

    // Step 3: Save to history (NEW)
    const historyRecord = await fnbOrderService.saveOrderHistory(roomScheduleId, order, createdBy || 'system')

    // Step 4: Generate updated bill with new items
    const billService = new BillService()
    let updatedBill
    try {
      updatedBill = await billService.getBill(roomScheduleId)
      console.log('Bill đã được cập nhật với items mới')
    } catch (billError) {
      console.error('Lỗi khi tạo bill:', billError)
      // Không fail toàn bộ request nếu chỉ lỗi bill
      updatedBill = null
    }

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: 'Đặt món thành công',
      result: {
        order: orderResult,
        history: historyRecord,
        updatedItems: inventoryResults,
        bill: updatedBill // Trả về bill đã cập nhật với items mới
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Order Detail with item information
 * @path /fnb-orders/detail/:roomScheduleId
 * @method GET
 */
export const getOrderDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId } = req.params

    // Lấy order hiện tại
    const currentOrders = await fnbOrderService.getFnbOrdersByRoomSchedule(roomScheduleId)

    if (currentOrders.length === 0) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'Không tìm thấy order cho room schedule này'
      })
    }

    const currentOrder = currentOrders[currentOrders.length - 1]

    // Lấy menu items để có thông tin chi tiết
    const menu = await databaseService.fnbMenu.find({}).toArray()

    // Xử lý drinks
    const drinksDetail = []
    if (currentOrder.order.drinks && Object.keys(currentOrder.order.drinks).length > 0) {
      for (const [itemId, quantity] of Object.entries(currentOrder.order.drinks)) {
        const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
        if (menuItem) {
          drinksDetail.push({
            itemId,
            name: menuItem.name,
            price: menuItem.price,
            quantity,
            category: 'drink'
          })
        }
      }
    }

    // Xử lý snacks
    const snacksDetail = []
    if (currentOrder.order.snacks && Object.keys(currentOrder.order.snacks).length > 0) {
      for (const [itemId, quantity] of Object.entries(currentOrder.order.snacks)) {
        const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
        if (menuItem) {
          snacksDetail.push({
            itemId,
            name: menuItem.name,
            price: menuItem.price,
            quantity,
            category: 'snack'
          })
        }
      }
    }

    let orderDetail = {
      roomScheduleId: currentOrder.roomScheduleId,
      order: {
        drinks: currentOrder.order.drinks,
        snacks: currentOrder.order.snacks
      },
      items: {
        drinks: drinksDetail,
        snacks: snacksDetail
      },
      createdAt: currentOrder.createdAt,
      updatedAt: currentOrder.updatedAt,
      createdBy: currentOrder.createdBy,
      updatedBy: currentOrder.updatedBy
    }

    // Lọc các item có quantity = 0 trước khi trả về
    orderDetail = cleanOrderDetail(orderDetail)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get order detail successfully',
      result: orderDetail
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Upsert FNB Order Item (add/update quantity)
 * @path /fnb-orders/upsert-item
 * @method POST
 */
export const upsertOrderItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomScheduleId, itemId, quantity, category, createdBy } = req.body

    // Lấy order hiện tại
    const currentOrders = await fnbOrderService.getFnbOrdersByRoomSchedule(roomScheduleId)
    let currentOrder = currentOrders.length > 0 ? currentOrders[currentOrders.length - 1] : null

    // Tạo order mới nếu chưa có
    if (!currentOrder) {
      const newOrder = {
        drinks: {},
        snacks: {}
      }
      currentOrder = await fnbOrderService.createFnbOrder(roomScheduleId, newOrder, createdBy)
    }

    // Lấy số lượng cũ của item (nếu có)
    let oldQuantity = 0
    if (category === 'drink') {
      oldQuantity = currentOrder.order.drinks[itemId] || 0
    } else {
      oldQuantity = currentOrder.order.snacks[itemId] || 0
    }
    const delta = quantity - oldQuantity

    // Nếu không thay đổi thì trả về luôn
    if (delta === 0) {
      return res.status(HTTP_STATUS_CODE.OK).json({
        message: 'Số lượng không thay đổi',
        result: currentOrder
      })
    }

    // Lấy item từ menu chính hoặc menu item
    let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
    let isVariant = false
    if (!item) {
      const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
      if (!menuItem) {
        return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
          message: `Không tìm thấy item ${itemId}`
        })
      }
      item = menuItem
      isVariant = true
    }

    // Kiểm tra tồn kho nếu tăng số lượng
    if (delta > 0) {
      if ((item.inventory?.quantity ?? 0) < delta) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          message: `Item ${item.name} không đủ hàng (còn ${item.inventory?.quantity || 0}, cần thêm ${delta})`
        })
      }
    }

    // Cập nhật tồn kho
    if (item.inventory) {
      const newInventoryQuantity = item.inventory.quantity - delta
      if (isVariant) {
        await fnbMenuItemService.updateMenuItem(itemId, {
          inventory: {
            ...item.inventory,
            quantity: newInventoryQuantity,
            lastUpdated: new Date()
          },
          updatedAt: new Date()
        })
      } else {
        await databaseService.fnbMenu.updateOne(
          { _id: new ObjectId(itemId) },
          {
            $set: {
              'inventory.quantity': newInventoryQuantity,
              'inventory.lastUpdated': new Date(),
              updatedAt: new Date()
            }
          }
        )
      }
    }

    // Cập nhật quantity cho item
    const updatedOrder = {
      drinks: { ...currentOrder.order.drinks },
      snacks: { ...currentOrder.order.snacks }
    }

    if (category === 'drink') {
      updatedOrder.drinks[itemId] = quantity
    } else {
      updatedOrder.snacks[itemId] = quantity
    }

    // Upsert order
    const result = await fnbOrderService.upsertFnbOrder(roomScheduleId, updatedOrder, createdBy)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Upsert order item successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}
