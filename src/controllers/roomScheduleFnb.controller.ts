import { NextFunction, Request, Response } from 'express'
import { ObjectId } from 'mongodb'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { FNB_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { RoomScheduleStatus } from '~/constants/enum'
import fnbOrderService from '~/services/fnbOrder.service'
import fnbMenuItemService from '~/services/fnbMenuItem.service'
import databaseService from '~/services/database.service'
import { roomMusicServices } from '~/services/roomMusic.service'

/**
 * @description SUBMIT client cart - MERGE vào order hiện tại (cộng dồn)
 * @path POST /client/fnb/orders/room/:roomId/submit-cart
 * @method POST
 *
 * Client workflow:
 * 1. User xây dựng cart ở LOCAL (FE state)
 * 2. Submit cart → Backend MERGE vào order hiện tại
 * 3. Clear local cart
 */
export const submitClientCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomId = parseInt(req.params.roomId, 10)
    const { cart } = req.body // Client's local cart

    // Validate roomId
    if (isNaN(roomId) || roomId <= 0) {
      throw new ErrorWithStatus({
        message: 'Invalid room ID. Must be a positive number',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Validate cart
    if (!cart || (!cart.drinks && !cart.snacks)) {
      throw new ErrorWithStatus({
        message: 'Cart is empty',
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

    // Find current active schedule for the room
    const now = new Date()
    const currentSchedule = await databaseService.roomSchedule.findOne(
      {
        roomId: room._id,
        status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] },
        endTime: { $gt: now }
      },
      {
        sort: { createdAt: -1 }
      }
    )

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get current order from DB
    const currentOrder = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    // MERGE cart vào order hiện tại (cộng dồn)
    const mergedOrder = {
      drinks: { ...(currentOrder?.order.drinks || {}) },
      snacks: { ...(currentOrder?.order.snacks || {}) }
    }

    console.log('=== SUBMIT CLIENT CART ===')
    console.log('Current order:', currentOrder?.order)
    console.log('Client cart:', cart)

    // Cộng dồn drinks từ cart
    for (const [itemId, quantity] of Object.entries(cart.drinks || {})) {
      const currentQty = mergedOrder.drinks[itemId] || 0
      const newQty = currentQty + (quantity as number)
      if (newQty > 0) {
        mergedOrder.drinks[itemId] = newQty
        console.log(`  Drink ${itemId}: ${currentQty} + ${quantity} = ${newQty}`)
      }
    }

    // Cộng dồn snacks từ cart
    for (const [itemId, quantity] of Object.entries(cart.snacks || {})) {
      const currentQty = mergedOrder.snacks[itemId] || 0
      const newQty = currentQty + (quantity as number)
      if (newQty > 0) {
        mergedOrder.snacks[itemId] = newQty
        console.log(`  Snack ${itemId}: ${currentQty} + ${quantity} = ${newQty}`)
      }
    }

    console.log('Merged order:', mergedOrder)

    // Calculate inventory changes (chỉ lấy items từ cart vì đó là items mới thêm)
    const cartItems = { ...cart.drinks, ...cart.snacks }
    const inventoryUpdates: Array<{ itemId: string; delta: number; item: any; isVariant: boolean }> = []
    const itemsCache = new Map<string, { item: any; isVariant: boolean }>()

    // Validate và update inventory cho items trong cart
    for (const itemId of Object.keys(cartItems)) {
      const delta = cartItems[itemId] || 0

      if (delta > 0) {
        // Find item
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

        // Check inventory
        const availableQuantity = item.inventory?.quantity ?? 0
        if (availableQuantity < delta) {
          throw new ErrorWithStatus({
            message: `Not enough inventory for item ${item.name}. Available: ${availableQuantity}, Required: ${delta}`,
            status: HTTP_STATUS_CODE.BAD_REQUEST
          })
        }

        inventoryUpdates.push({ itemId, delta, item, isVariant })
        itemsCache.set(itemId, { item, isVariant })
      }
    }

    // Update inventory
    for (const { itemId, delta, item, isVariant } of inventoryUpdates) {
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
    }

    // Save merged order (dùng SET mode vì đã merge rồi)
    const result = await fnbOrderService.upsertFnbOrder(
      currentSchedule._id.toString(),
      mergedOrder,
      'client-app',
      'set' // SET vì đã merge ở trên
    )

    if (!result) {
      throw new ErrorWithStatus({
        message: 'Failed to save order to database',
        status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      })
    }

    // Send notification to admin - CHỈ GỬI ITEMS TRONG CART (món mới thêm)
    try {
      const orderNotificationData = {
        orderId: result._id?.toString() || 'unknown',
        items: [] as Array<{
          itemId: string
          name: string
          quantity: number
          price: number
        }>,
        totalAmount: 0,
        customerInfo: {
          roomName: room.roomName || `Phòng ${roomId}`,
          roomScheduleId: currentSchedule._id.toString()
        }
      }

      // FIX: Chỉ gửi items trong CART (món khách vừa đặt), không phải toàn bộ order
      const cartItems = { ...cart.drinks, ...cart.snacks }

      console.log('=== DEBUG NOTIFICATION ===')
      console.log('Cart:', JSON.stringify(cart))
      console.log('Cart items:', JSON.stringify(cartItems))
      console.log('Items cache size:', itemsCache.size)

      for (const [itemId, quantity] of Object.entries(cartItems)) {
        const qty = quantity as number
        if (qty > 0) {
          let item: any
          let isVariant = false

          if (itemsCache.has(itemId)) {
            const cached = itemsCache.get(itemId)!
            item = cached.item
            isVariant = cached.isVariant
          } else {
            item = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })

            if (!item) {
              const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
              if (menuItem) {
                item = menuItem
                isVariant = true
              }
            }
          }

          if (item) {
            orderNotificationData.items.push({
              itemId,
              name: item.name,
              quantity: qty, // Quantity từ CART, không phải merged order
              price: item.price || 0
            })
            orderNotificationData.totalAmount += (item.price || 0) * qty
          }
        }
      }

      console.log('Notification items count:', orderNotificationData.items.length)
      console.log('Notification data:', JSON.stringify(orderNotificationData))

      if (orderNotificationData.items.length > 0) {
        await roomMusicServices.sendNewOrderNotificationToAdmin(roomId.toString(), orderNotificationData)
        console.log(
          `✅ Đã gửi thông báo đơn hàng mới đến admin cho phòng ${roomId} với ${orderNotificationData.items.length} món MỚI từ cart`
        )
      } else {
        console.log('⚠️ KHÔNG GỬI NOTIFICATION - items.length = 0')
      }
      console.log('=== END DEBUG NOTIFICATION ===')
    } catch (notificationError) {
      console.error('❌ Lỗi khi gửi thông báo đến admin:', notificationError)
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Đặt món thành công',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @deprecated Use submitClientCart instead
 * @description ADD items to FNB Order (cộng dồn số lượng) - FOR ADMIN REMOTE OPERATIONS ONLY
 * @path POST /client/fnb/orders/room/:roomId/add
 * @method POST
 */
export const addClientFnbOrderItems = async (req: Request, res: Response, next: NextFunction) => {
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
    // Dựa vào endTime > now để lọc schedule còn hiệu lực
    // Sort theo createdAt để lấy schedule mới nhất
    const now = new Date()
    const currentSchedule = await databaseService.roomSchedule.findOne(
      {
        roomId: room._id,
        status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] },
        endTime: { $gt: now } // Chỉ lấy schedule chưa kết thúc
      },
      {
        sort: { createdAt: -1 } // Lấy schedule mới nhất
      }
    )

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get current order to calculate delta
    const currentOrder = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    // Calculate inventory changes - delta là số lượng thêm/bớt trong request
    const allItems = { ...order.drinks, ...order.snacks }
    const inventoryUpdates: Array<{ itemId: string; delta: number; item: any; isVariant: boolean }> = []

    // Cache để tránh query lại các items đã có thông tin
    const itemsCache = new Map<string, { item: any; isVariant: boolean }>()

    // Calculate deltas for each item (delta = số lượng thêm/bớt trong request)
    for (const itemId of Object.keys(allItems)) {
      const delta = allItems[itemId] || 0

      if (delta !== 0) {
        // Find item
        let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
        let isVariant = false

        if (!item) {
          const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
          if (menuItem) {
            item = menuItem
            isVariant = true
          }
        }

        if (item) {
          inventoryUpdates.push({ itemId, delta, item, isVariant })
          // Cache item info để dùng lại cho notification
          itemsCache.set(itemId, { item, isVariant })
        }
      }
    }

    // Check inventory availability and update inventory
    for (const { itemId, delta, item, isVariant } of inventoryUpdates) {
      // Check inventory if increasing quantity
      if (delta > 0) {
        const availableQuantity = item.inventory?.quantity ?? 0
        if (availableQuantity < delta) {
          throw new ErrorWithStatus({
            message: `Not enough inventory for item ${item.name}. Available: ${availableQuantity}, Required: ${delta}`,
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
    }

    // ADD mode: Cộng dồn số lượng
    const result = await fnbOrderService.upsertFnbOrder(
      currentSchedule._id.toString(),
      order,
      'client-app',
      'add' // ADD mode - cộng dồn số lượng
    )

    // Validate that order was saved successfully
    if (!result) {
      throw new ErrorWithStatus({
        message: 'Failed to save order to database',
        status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      })
    }

    // Send notification to admin about new order
    try {
      // Chuẩn bị dữ liệu đơn hàng để gửi thông báo
      const orderNotificationData = {
        orderId: result._id?.toString() || 'unknown',
        items: [] as Array<{
          itemId: string
          name: string
          quantity: number
          price: number
        }>,
        totalAmount: 0,
        customerInfo: {
          roomName: room.roomName || `Phòng ${roomId}`,
          roomScheduleId: currentSchedule._id.toString()
        }
      }

      // FIX: Lấy thông tin từ order đã SAVE thành công (result.order), không phải từ inventoryUpdates
      // Vì inventoryUpdates chỉ chứa items có thay đổi, dẫn đến notification thiếu món
      const savedOrder = result.order
      const allOrderItems = { ...savedOrder.drinks, ...savedOrder.snacks }

      // Lấy thông tin chi tiết cho TẤT CẢ các món trong order đã lưu
      for (const [itemId, quantity] of Object.entries(allOrderItems)) {
        if (quantity > 0) {
          // Sử dụng cache nếu có, tránh query database lại
          let item: any
          let isVariant = false

          if (itemsCache.has(itemId)) {
            const cached = itemsCache.get(itemId)!
            item = cached.item
            isVariant = cached.isVariant
          } else {
            // Query nếu chưa có trong cache
            item = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })

            if (!item) {
              const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
              if (menuItem) {
                item = menuItem
                isVariant = true
              }
            }
          }

          if (item) {
            orderNotificationData.items.push({
              itemId,
              name: item.name,
              quantity: quantity as number,
              price: item.price || 0
            })
            orderNotificationData.totalAmount += (item.price || 0) * (quantity as number)
          }
        }
      }

      // Chỉ gửi notification nếu có món trong order
      if (orderNotificationData.items.length > 0) {
        await roomMusicServices.sendNewOrderNotificationToAdmin(roomId.toString(), orderNotificationData)
        console.log(
          `✅ Đã gửi thông báo đơn hàng mới đến admin cho phòng ${roomId} với ${orderNotificationData.items.length} món`
        )
      } else {
        console.log(`⚠️ Không gửi notification vì order không có món nào`)
      }
    } catch (notificationError) {
      console.error('❌ Lỗi khi gửi thông báo đến admin:', notificationError)
      // Không fail toàn bộ request nếu chỉ lỗi notification
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Add items to order successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description REMOVE items from FNB Order (giảm số lượng)
 * @path POST /client/fnb/orders/room/:roomId/remove
 * @method POST
 */
export const removeClientFnbOrderItems = async (req: Request, res: Response, next: NextFunction) => {
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

    // Find current active schedule for the room
    const now = new Date()
    const currentSchedule = await databaseService.roomSchedule.findOne(
      {
        roomId: room._id,
        status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] },
        endTime: { $gt: now }
      },
      {
        sort: { createdAt: -1 }
      }
    )

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get current order
    const currentOrder = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    // Calculate inventory changes - delta là số lượng GIẢM (số dương)
    const allItems = { ...order.drinks, ...order.snacks }
    const inventoryUpdates: Array<{ itemId: string; delta: number; item: any; isVariant: boolean }> = []

    // Cache để tránh query lại các items đã có thông tin
    const itemsCache = new Map<string, { item: any; isVariant: boolean }>()

    // Calculate deltas for each item (delta = số lượng giảm)
    for (const itemId of Object.keys(allItems)) {
      const removeQuantity = allItems[itemId] || 0

      if (removeQuantity !== 0) {
        // Find item
        let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
        let isVariant = false

        if (!item) {
          const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
          if (menuItem) {
            item = menuItem
            isVariant = true
          }
        }

        if (item) {
          // Delta âm vì đang trả lại inventory
          inventoryUpdates.push({ itemId, delta: -removeQuantity, item, isVariant })
          itemsCache.set(itemId, { item, isVariant })
        }
      }
    }

    // Update inventory (trả lại kho)
    for (const { itemId, delta, item, isVariant } of inventoryUpdates) {
      if (item.inventory) {
        const newInventoryQuantity = item.inventory.quantity - delta // delta âm nên sẽ CỘNG vào kho
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
    }

    // REMOVE mode: Giảm số lượng
    const result = await fnbOrderService.upsertFnbOrder(
      currentSchedule._id.toString(),
      order,
      'client-app',
      'remove' // REMOVE mode - giảm số lượng
    )

    // Validate that order was saved successfully
    if (!result) {
      throw new ErrorWithStatus({
        message: 'Failed to save order to database',
        status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      })
    }

    // Send notification to admin
    try {
      const orderNotificationData = {
        orderId: result._id?.toString() || 'unknown',
        items: [] as Array<{
          itemId: string
          name: string
          quantity: number
          price: number
        }>,
        totalAmount: 0,
        customerInfo: {
          roomName: room.roomName || `Phòng ${roomId}`,
          roomScheduleId: currentSchedule._id.toString()
        }
      }

      const savedOrder = result.order
      const allOrderItems = { ...savedOrder.drinks, ...savedOrder.snacks }

      for (const [itemId, quantity] of Object.entries(allOrderItems)) {
        if (quantity > 0) {
          let item: any
          let isVariant = false

          if (itemsCache.has(itemId)) {
            const cached = itemsCache.get(itemId)!
            item = cached.item
            isVariant = cached.isVariant
          } else {
            item = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })

            if (!item) {
              const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
              if (menuItem) {
                item = menuItem
                isVariant = true
              }
            }
          }

          if (item) {
            orderNotificationData.items.push({
              itemId,
              name: item.name,
              quantity: quantity as number,
              price: item.price || 0
            })
            orderNotificationData.totalAmount += (item.price || 0) * (quantity as number)
          }
        }
      }

      if (orderNotificationData.items.length > 0) {
        await roomMusicServices.sendNewOrderNotificationToAdmin(roomId.toString(), orderNotificationData)
        console.log(`✅ Đã gửi thông báo cập nhật đơn hàng (remove) đến admin cho phòng ${roomId}`)
      }
    } catch (notificationError) {
      console.error('❌ Lỗi khi gửi thông báo đến admin:', notificationError)
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Remove items from order successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description SET FNB Order (ghi đè toàn bộ order)
 * @path PUT /client/fnb/orders/room/:roomId
 * @method PUT
 */
export const setClientFnbOrder = async (req: Request, res: Response, next: NextFunction) => {
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

    // Find current active schedule for the room
    const now = new Date()
    const currentSchedule = await databaseService.roomSchedule.findOne(
      {
        roomId: room._id,
        status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] },
        endTime: { $gt: now }
      },
      {
        sort: { createdAt: -1 }
      }
    )

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get current order to calculate delta
    const currentOrder = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    // Calculate inventory changes
    const newItems = { ...order.drinks, ...order.snacks }
    const currentItems = {
      ...(currentOrder?.order.drinks || {}),
      ...(currentOrder?.order.snacks || {})
    }

    const inventoryUpdates: Array<{ itemId: string; delta: number; item: any; isVariant: boolean }> = []
    const itemsCache = new Map<string, { item: any; isVariant: boolean }>()

    // Calculate delta for all items (new and old)
    const allItemIds = new Set([...Object.keys(currentItems), ...Object.keys(newItems)])

    for (const itemId of allItemIds) {
      const newQuantity = newItems[itemId] || 0
      const currentQuantity = currentItems[itemId] || 0
      const delta = newQuantity - currentQuantity

      if (delta !== 0) {
        // Find item
        let item: any = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })
        let isVariant = false

        if (!item) {
          const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
          if (menuItem) {
            item = menuItem
            isVariant = true
          }
        }

        if (item) {
          inventoryUpdates.push({ itemId, delta, item, isVariant })
          itemsCache.set(itemId, { item, isVariant })
        }
      }
    }

    // Check inventory availability and update inventory
    for (const { itemId, delta, item, isVariant } of inventoryUpdates) {
      // Check inventory if increasing quantity
      if (delta > 0) {
        const availableQuantity = item.inventory?.quantity ?? 0
        if (availableQuantity < delta) {
          throw new ErrorWithStatus({
            message: `Not enough inventory for item ${item.name}. Available: ${availableQuantity}, Required: ${delta}`,
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
    }

    // SET mode: Ghi đè toàn bộ order
    const result = await fnbOrderService.upsertFnbOrder(
      currentSchedule._id.toString(),
      order,
      'client-app',
      'set' // SET mode - ghi đè toàn bộ
    )

    // Validate that order was saved successfully
    if (!result) {
      throw new ErrorWithStatus({
        message: 'Failed to save order to database',
        status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      })
    }

    // Send notification to admin
    try {
      const orderNotificationData = {
        orderId: result._id?.toString() || 'unknown',
        items: [] as Array<{
          itemId: string
          name: string
          quantity: number
          price: number
        }>,
        totalAmount: 0,
        customerInfo: {
          roomName: room.roomName || `Phòng ${roomId}`,
          roomScheduleId: currentSchedule._id.toString()
        }
      }

      const savedOrder = result.order
      const allOrderItems = { ...savedOrder.drinks, ...savedOrder.snacks }

      for (const [itemId, quantity] of Object.entries(allOrderItems)) {
        if (quantity > 0) {
          let item: any
          let isVariant = false

          if (itemsCache.has(itemId)) {
            const cached = itemsCache.get(itemId)!
            item = cached.item
            isVariant = cached.isVariant
          } else {
            item = await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })

            if (!item) {
              const menuItem = await fnbMenuItemService.getMenuItemById(itemId)
              if (menuItem) {
                item = menuItem
                isVariant = true
              }
            }
          }

          if (item) {
            orderNotificationData.items.push({
              itemId,
              name: item.name,
              quantity: quantity as number,
              price: item.price || 0
            })
            orderNotificationData.totalAmount += (item.price || 0) * (quantity as number)
          }
        }
      }

      if (orderNotificationData.items.length > 0) {
        await roomMusicServices.sendNewOrderNotificationToAdmin(roomId.toString(), orderNotificationData)
        console.log(`✅ Đã gửi thông báo cập nhật đơn hàng (set) đến admin cho phòng ${roomId}`)
      }
    } catch (notificationError) {
      console.error('❌ Lỗi khi gửi thông báo đến admin:', notificationError)
    }

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
    // Dựa vào endTime > now để lọc schedule còn hiệu lực
    // Sort theo createdAt để lấy schedule mới nhất
    const now = new Date()
    const currentSchedule = await databaseService.roomSchedule.findOne(
      {
        roomId: room._id,
        status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] },
        endTime: { $gt: now } // Chỉ lấy schedule chưa kết thúc
      },
      {
        sort: { createdAt: -1 } // Lấy schedule mới nhất
      }
    )

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session found for room ${room.roomName || roomIdNum}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get current order
    const currentOrder = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

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

    // Validate that order was saved successfully
    if (!result) {
      throw new ErrorWithStatus({
        message: 'Failed to save order to database',
        status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
      })
    }

    // Get updated item info
    const updatedItem = isVariant
      ? await fnbMenuItemService.getMenuItemById(itemId)
      : await databaseService.fnbMenu.findOne({ _id: new ObjectId(itemId) })

    // Send notification to admin about order update
    try {
      const orderNotificationData = {
        orderId: result._id?.toString() || 'unknown',
        items: [] as Array<{
          itemId: string
          name: string
          quantity: number
          price: number
        }>,
        totalAmount: 0,
        customerInfo: {
          roomName: room.roomName || `Phòng ${roomIdNum}`,
          roomScheduleId: currentSchedule._id.toString()
        }
      }

      // Lấy thông tin TẤT CẢ các món trong order đã lưu
      const savedOrder = result.order
      const allOrderItems = { ...savedOrder.drinks, ...savedOrder.snacks }

      for (const [orderItemId, orderQuantity] of Object.entries(allOrderItems)) {
        if (orderQuantity > 0) {
          // Tìm item info
          let orderItem: any
          if (orderItemId === itemId) {
            // Dùng luôn item đã có
            orderItem = item
          } else {
            orderItem = await databaseService.fnbMenu.findOne({ _id: new ObjectId(orderItemId) })
            if (!orderItem) {
              const menuItem = await fnbMenuItemService.getMenuItemById(orderItemId)
              if (menuItem) {
                orderItem = menuItem
              }
            }
          }

          if (orderItem) {
            orderNotificationData.items.push({
              itemId: orderItemId,
              name: orderItem.name,
              quantity: orderQuantity as number,
              price: orderItem.price || 0
            })
            orderNotificationData.totalAmount += (orderItem.price || 0) * (orderQuantity as number)
          }
        }
      }

      // Chỉ gửi notification nếu có món trong order
      if (orderNotificationData.items.length > 0) {
        await roomMusicServices.sendNewOrderNotificationToAdmin(roomIdNum.toString(), orderNotificationData)
        console.log(
          `✅ Đã gửi thông báo cập nhật đơn hàng đến admin cho phòng ${roomIdNum} (${quantity > 0 ? 'thêm' : 'xóa'} ${item.name})`
        )
      }
    } catch (notificationError) {
      console.error('❌ Lỗi khi gửi thông báo đến admin:', notificationError)
      // Không fail toàn bộ request nếu chỉ lỗi notification
    }

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
    // Dựa vào endTime > now để lọc schedule còn hiệu lực
    // Sort theo createdAt để lấy schedule mới nhất
    const now = new Date()
    const currentSchedule = await databaseService.roomSchedule.findOne(
      {
        roomId: room._id,
        status: { $in: [RoomScheduleStatus.Booked, RoomScheduleStatus.InUse] },
        endTime: { $gt: now } // Chỉ lấy schedule chưa kết thúc
      },
      {
        sort: { createdAt: -1 } // Lấy schedule mới nhất
      }
    )

    if (!currentSchedule) {
      throw new ErrorWithStatus({
        message: `No active session (booked or in use) found for room ${room.roomName || roomId}`,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Get order for the found roomScheduleId
    const result = await fnbOrderService.getFnbOrdersByRoomSchedule(currentSchedule._id.toString())

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: FNB_MESSAGES.GET_FNB_ORDERS_BY_ROOM_SCHEDULE_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
