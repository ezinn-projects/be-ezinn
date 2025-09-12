import { NextFunction, Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { RoomScheduleStatus } from '~/constants/enum'
import fnbOrderService from '~/services/fnbOrder.service'
import fnbMenuItemService from '~/services/fnbMenuItem.service'
import databaseService from '~/services/database.service'

/**
 * @description Save FNB Order for client app using room ID
 * @path /client/fnb/orders/room/:roomId
 * @method POST
 */
export const saveClientFnbOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomId = parseInt(req.params.roomId, 10)
    const { order } = req.body

    // Validate roomId
    if (isNaN(roomId) || roomId <= 0) {
      throw new ErrorWithStatus({
        message: 'Invalid room ID. Must be a positive number',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get room by roomId
    const room = await databaseService.rooms.findOne({ roomId })

    if (!room) {
      throw new ErrorWithStatus({
        message: `Room with ID ${roomId} not found`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Find current active schedule for the room (booked or in use)
    const currentSchedule = await databaseService.roomSchedule.findOne({
      roomId: room._id,
      status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] }
    })

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Create or update the order using the found roomScheduleId
    const result = await fnbOrderService.upsertFnbOrder(currentSchedule._id.toString(), order, 'client-app')

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.UPSERT_FNB_ORDER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Upsert item to FNB order for client app using room ID
 * @path /client/fnb/orders/upsert-item
 * @method POST
 */
export const upsertClientFnbOrderItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId, itemId, quantity, category, createdBy } = req.body

    // Validate input
    if (!roomId || !itemId || quantity === undefined || !category) {
      throw new ErrorWithStatus({
        message: 'roomId, itemId, quantity, and category are required',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Validate roomId
    const roomIdNum = parseInt(roomId, 10)
    if (isNaN(roomIdNum) || roomIdNum <= 0) {
      throw new ErrorWithStatus({
        message: 'Invalid room ID. Must be a positive number',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Validate quantity
    if (quantity < 0) {
      throw new ErrorWithStatus({
        message: 'Quantity must be >= 0',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Validate category
    if (!['drink', 'snack'].includes(category)) {
      throw new ErrorWithStatus({
        message: 'Category must be either "drink" or "snack"',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get room by roomId
    const room = await databaseService.rooms.findOne({ roomId: roomIdNum })

    if (!room) {
      throw new ErrorWithStatus({
        message: `Room with ID ${roomIdNum} not found`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Find current active schedule for the room (booked or in use)
    const currentSchedule = await databaseService.roomSchedule.findOne({
      roomId: room._id,
      status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] }
    })

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session found for room ${room.roomName || roomIdNum}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get current order
    const existingOrders = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())
    const currentOrder = existingOrders.length > 0 ? existingOrders[0] : null

    // Calculate current quantity in order
    let currentQuantity = 0
    if (currentOrder) {
      if (category === 'drink' && currentOrder.order.drinks[itemId]) {
        currentQuantity = currentOrder.order.drinks[itemId]
      } else if (category === 'snack' && currentOrder.order.snacks[itemId]) {
        currentQuantity = currentOrder.order.snacks[itemId]
      }
    }

    // Calculate quantity delta
    const delta = quantity - currentQuantity

    // Find item and check inventory
    let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
    let isVariant = false

    if (!item) {
      const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
      if (menuItem) {
        item = menuItem
        isVariant = true
      }
    }

    if (!item) {
      throw new ErrorWithStatus({
        message: `Item with ID ${itemId} not found`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Check inventory if increasing quantity
    if (delta > 0) {
      const availableQuantity = item.inventory?.quantity ?? 0
      if (availableQuantity < delta) {
        throw new ErrorWithStatus({
          message: `Not enough inventory for item ${item.name}`,
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
    }

    // Update inventory
    if (item.inventory && delta !== 0) {
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

    // Update order
    const updatedOrder = {
      drinks: { ...(currentOrder?.order.drinks || {}) },
      snacks: { ...(currentOrder?.order.snacks || {}) }
    }

    if (category === 'drink') {
      if (quantity > 0) {
        updatedOrder.drinks[itemId] = quantity
      } else {
        delete updatedOrder.drinks[itemId]
      }
    } else {
      if (quantity > 0) {
        updatedOrder.snacks[itemId] = quantity
      } else {
        delete updatedOrder.snacks[itemId]
      }
    }

    // Upsert order
    const result = await fnbOrderService.upsertFnbOrder(currentSchedule._id.toString(), updatedOrder, createdBy)

    // Get updated item info
    const updatedItem = isVariant
      ? await fnbMenuItemService.getMenuItemById(itemId)
      : await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Upsert order item successfully',
      result: {
        order: result,
        item: {
          itemId,
          itemName: item.name,
          category,
          quantity,
          availableQuantity: updatedItem?.inventory?.quantity ?? 0
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Check inventory availability for multiple items
 * @path /client/fnb/inventory/check
 * @method POST
 */
export const checkInventoryAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body

    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ErrorWithStatus({
        message: 'Items array is required and must not be empty',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Validate each item
    for (const item of items) {
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        throw new ErrorWithStatus({
          message: 'Each item must have valid itemId and quantity > 0',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
    }

    // Check inventory availability
    const result = await fnbOrderService.checkInventoryAvailability(items)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Inventory check completed',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get FNB Order by Room ID for client app
 * @path /client/fnb/orders/room/:roomId
 * @method GET
 */
export const getClientFnbOrderByRoomSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomId = parseInt(req.params.roomId, 10)

    // Validate roomId
    if (isNaN(roomId) || roomId <= 0) {
      throw new ErrorWithStatus({
        message: 'Invalid room ID. Must be a positive number',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Get room by roomId
    const room = await databaseService.rooms.findOne({ roomId })

    if (!room) {
      throw new ErrorWithStatus({
        message: `Room with ID ${roomId} not found`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Find current active schedule for the room (booked or in use)
    const currentSchedule = await databaseService.roomSchedule.findOne({
      roomId: room._id,
      status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] }
    })

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get orders for the found roomScheduleId
    const result = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDERS_BY_ROOM_SCHEDULE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
