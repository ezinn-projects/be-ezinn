import { ObjectId } from 'mongodb'
import { RoomScheduleFNBOrder, FNBOrder, FNBOrderHistoryRecord } from '~/models/schemas/FNB.schema'
import databaseService from './database.service'
import fnbMenuItemService from './fnbMenuItem.service'

class FnbOrderService {
  private initialized = false

  /**
   * Khởi tạo service - đảm bảo unique index được tạo
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('=== INITIALIZING FNB ORDER SERVICE ===')
      await this.ensureUniqueIndex()
      this.initialized = true
      console.log('=== FNB ORDER SERVICE INITIALIZED ===')
    } catch (error) {
      console.error('Failed to initialize FNB Order Service:', error)
      throw error
    }
  }
  /**
   * Đảm bảo unique index trên roomScheduleId để tránh duplicate orders
   */
  async ensureUniqueIndex(): Promise<void> {
    try {
      console.log('=== ENSURING UNIQUE INDEX ===')

      // Bước 1: Cleanup duplicate orders trước
      await this.cleanupDuplicateOrders()

      // Bước 2: Xóa index cũ nếu có để tạo lại
      try {
        await databaseService.fnbOrder.dropIndex('unique_roomScheduleId')
        console.log('Dropped existing unique index')
      } catch (dropError) {
        console.log('No existing index to drop:', dropError)
      }

      // Bước 3: Tạo unique index mới
      await databaseService.fnbOrder.createIndex({ roomScheduleId: 1 }, { unique: true, name: 'unique_roomScheduleId' })
      console.log('Unique index on roomScheduleId created successfully')

      console.log('=== UNIQUE INDEX ENSURED ===')
    } catch (error) {
      console.error('Error creating unique index:', error)
      throw error
    }
  }

  /**
   * Xóa các duplicate orders cho cùng một room schedule (giữ lại order mới nhất)
   */
  async cleanupDuplicateOrders(): Promise<void> {
    try {
      console.log('=== STARTING CLEANUP DUPLICATE ORDERS ===')

      // Tìm các room schedule có nhiều hơn 1 order
      const duplicates = await databaseService.fnbOrder
        .aggregate([
          {
            $group: {
              _id: '$roomScheduleId',
              count: { $sum: 1 },
              orders: { $push: '$$ROOT' }
            }
          },
          {
            $match: {
              count: { $gt: 1 }
            }
          }
        ])
        .toArray()

      console.log(`Found ${duplicates.length} room schedules with duplicate orders`)

      for (const duplicate of duplicates) {
        const orders = duplicate.orders
        console.log(`Processing room schedule ${duplicate._id} with ${orders.length} orders`)

        // Sắp xếp theo createdAt (mới nhất trước)
        orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        // Giữ lại order đầu tiên (mới nhất), xóa các order còn lại
        const keepOrder = orders[0]
        const deleteOrders = orders.slice(1)

        console.log(
          `Room schedule ${duplicate._id}: keeping order ${keepOrder._id} (created: ${keepOrder.createdAt}), deleting ${deleteOrders.length} duplicates`
        )

        // Xóa các duplicate orders
        for (const orderToDelete of deleteOrders) {
          console.log(`Deleting duplicate order: ${orderToDelete._id} (created: ${orderToDelete.createdAt})`)
          await databaseService.fnbOrder.deleteOne({ _id: orderToDelete._id })
        }
      }

      console.log('=== CLEANUP DUPLICATE ORDERS COMPLETED ===')
    } catch (error) {
      console.error('Error cleaning up duplicate orders:', error)
      throw error
    }
  }

  async createFnbOrder(roomScheduleId: string, order: FNBOrder, createdBy?: string): Promise<RoomScheduleFNBOrder> {
    const newOrder = new RoomScheduleFNBOrder(roomScheduleId, order, createdBy, createdBy)
    const result = await databaseService.fnbOrder.insertOne(newOrder)
    newOrder._id = result.insertedId
    return newOrder
  }

  async getFnbOrderById(id: string): Promise<RoomScheduleFNBOrder | null> {
    const order = await databaseService.fnbOrder.findOne({ roomScheduleId: new ObjectId(id) })
    return order
      ? new RoomScheduleFNBOrder(order.roomScheduleId.toString(), order.order, order.createdBy, order.updatedBy)
      : null
  }

  async deleteFnbOrder(id: string): Promise<RoomScheduleFNBOrder | null> {
    const orderToDelete = await this.getFnbOrderById(id)
    if (!orderToDelete) return null

    await databaseService.fnbOrder.deleteOne({ _id: new ObjectId(id) })
    return orderToDelete
  }

  async getFnbOrdersByRoomSchedule(roomScheduleId: string): Promise<RoomScheduleFNBOrder | null> {
    const order = await databaseService.fnbOrder.findOne({ roomScheduleId: new ObjectId(roomScheduleId) })

    if (!order) return null

    return new RoomScheduleFNBOrder(order.roomScheduleId.toString(), order.order, order.createdBy, order.updatedBy)
  }

  // Method mới: Lưu order history khi complete
  async saveOrderHistory(
    roomScheduleId: string,
    order: FNBOrder,
    completedBy?: string,
    billId?: string
  ): Promise<FNBOrderHistoryRecord> {
    const historyRecord = new FNBOrderHistoryRecord(roomScheduleId, order, completedBy, billId)
    const result = await databaseService.fnbOrderHistory.insertOne(historyRecord)
    historyRecord._id = result.insertedId
    return historyRecord
  }

  // Method mới: Lấy order history theo room schedule ID
  async getOrderHistoryByRoomSchedule(roomScheduleId: string): Promise<FNBOrderHistoryRecord[]> {
    const historyRecords = await databaseService.fnbOrderHistory
      .find({ roomScheduleId: new ObjectId(roomScheduleId) })
      .toArray()
    return historyRecords.map(
      (record) =>
        new FNBOrderHistoryRecord(
          record.roomScheduleId.toString(),
          record.order,
          record.completedBy,
          record.billId?.toString()
        )
    )
  }

  // Method mới: Kiểm tra tồn kho cho multiple items
  async checkInventoryAvailability(items: { itemId: string; quantity: number }[]): Promise<{
    available: boolean
    unavailableItems: Array<{
      itemId: string
      itemName: string
      requestedQuantity: number
      availableQuantity: number
    }>
    availableItems: Array<{
      itemId: string
      itemName: string
      requestedQuantity: number
      availableQuantity: number
    }>
  }> {
    const unavailableItems: Array<{
      itemId: string
      itemName: string
      requestedQuantity: number
      availableQuantity: number
    }> = []

    const availableItems: Array<{
      itemId: string
      itemName: string
      requestedQuantity: number
      availableQuantity: number
    }> = []

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
        unavailableItems.push({
          itemId,
          itemName: 'Item not found',
          requestedQuantity: quantity,
          availableQuantity: 0
        })
        continue
      }

      const availableQuantity = item.inventory?.quantity ?? 0

      if (availableQuantity < quantity) {
        unavailableItems.push({
          itemId,
          itemName: item.name,
          requestedQuantity: quantity,
          availableQuantity
        })
      } else {
        availableItems.push({
          itemId,
          itemName: item.name,
          requestedQuantity: quantity,
          availableQuantity
        })
      }
    }

    return {
      available: unavailableItems.length === 0,
      unavailableItems,
      availableItems
    }
  }

  async upsertFnbOrder(
    roomScheduleId: string,
    order: Partial<FNBOrder>,
    user?: string,
    mode: 'add' | 'remove' | 'set' = 'add' // add = cộng dồn, remove = giảm đi, set = ghi đè
  ): Promise<RoomScheduleFNBOrder | null> {
    // Đảm bảo service đã được khởi tạo
    await this.initialize()

    const filter = { roomScheduleId: new ObjectId(roomScheduleId) }

    // Kiểm tra xem đã có order nào tồn tại chưa
    const existingOrder = await databaseService.fnbOrder.findOne(filter)
    console.log('Existing order found:', existingOrder ? 'YES' : 'NO')
    if (existingOrder) {
      console.log('Existing order ID:', existingOrder._id)
      console.log('Existing order data:', JSON.stringify(existingOrder, null, 2))
    }

    if (existingOrder) {
      // Nếu đã có order, chỉ update
      const currentDrinks = existingOrder.order?.drinks || {}
      const currentSnacks = existingOrder.order?.snacks || {}

      let mergedDrinks = { ...currentDrinks }
      if (order.drinks) {
        // Chỉ cập nhật/xóa những items có trong request hiện tại
        for (const [itemId, quantity] of Object.entries(order.drinks)) {
          if (quantity > 0) {
            mergedDrinks[itemId] = quantity
            console.log(`Set drink ${itemId} = ${quantity}`)
          } else {
            delete mergedDrinks[itemId]
            console.log(`Deleted drink ${itemId}`)
          }
        }

        console.log('Merged drinks:', mergedDrinks)
        console.log('=== END DEBUG DRINKS ===')
      }

      // Merge snacks: giữ nguyên items cũ, chỉ cập nhật/xóa items có trong request
      let mergedSnacks = { ...currentSnacks }

      if (mode === 'set') {
        // SET MODE: Ghi đè hoàn toàn với order mới
        console.log('=== SET MODE: Overwriting entire order ===')
        mergedDrinks = order.drinks || {}
        mergedSnacks = order.snacks || {}
      } else if (mode === 'add') {
        // ADD MODE: Cộng dồn số lượng
        if (order.drinks) {
          console.log('=== ADD MODE - DRINKS ===')
          console.log('Current drinks:', currentDrinks)
          console.log('Adding drinks:', order.drinks)

          for (const [itemId, addQuantity] of Object.entries(order.drinks)) {
            const currentQuantity = mergedDrinks[itemId] || 0
            const newQuantity = currentQuantity + (addQuantity as number)

            if (newQuantity > 0) {
              mergedDrinks[itemId] = newQuantity
              console.log(`  ✅ ${itemId}: ${currentQuantity} + ${addQuantity} = ${newQuantity}`)
            } else {
              delete mergedDrinks[itemId]
              console.log(`  🗑️ ${itemId}: deleted (quantity <= 0)`)
            }
          }

          console.log('Result drinks:', mergedDrinks)
        }

        if (order.snacks) {
          console.log('=== ADD MODE - SNACKS ===')
          console.log('Current snacks:', currentSnacks)
          console.log('Adding snacks:', order.snacks)

          for (const [itemId, addQuantity] of Object.entries(order.snacks)) {
            const currentQuantity = mergedSnacks[itemId] || 0
            const newQuantity = currentQuantity + (addQuantity as number)

            if (newQuantity > 0) {
              mergedSnacks[itemId] = newQuantity
              console.log(`  ✅ ${itemId}: ${currentQuantity} + ${addQuantity} = ${newQuantity}`)
            } else {
              delete mergedSnacks[itemId]
              console.log(`  🗑️ ${itemId}: deleted (quantity <= 0)`)
            }
          }

          console.log('Result snacks:', mergedSnacks)
        }
      } else if (mode === 'remove') {
        // REMOVE MODE: Giảm số lượng
        if (order.drinks) {
          console.log('=== REMOVE MODE - DRINKS ===')
          console.log('Current drinks:', currentDrinks)
          console.log('Removing drinks:', order.drinks)

          for (const [itemId, removeQuantity] of Object.entries(order.drinks)) {
            const currentQuantity = mergedDrinks[itemId] || 0
            const newQuantity = currentQuantity - (removeQuantity as number)

            if (newQuantity > 0) {
              mergedDrinks[itemId] = newQuantity
              console.log(`  ✅ ${itemId}: ${currentQuantity} - ${removeQuantity} = ${newQuantity}`)
            } else {
              delete mergedDrinks[itemId]
              console.log(`  🗑️ ${itemId}: deleted (quantity <= 0)`)
            }
          }

          console.log('Result drinks:', mergedDrinks)
        }

        if (order.snacks) {
          console.log('=== REMOVE MODE - SNACKS ===')
          console.log('Current snacks:', currentSnacks)
          console.log('Removing snacks:', order.snacks)

          for (const [itemId, removeQuantity] of Object.entries(order.snacks)) {
            const currentQuantity = mergedSnacks[itemId] || 0
            const newQuantity = currentQuantity - (removeQuantity as number)

            if (newQuantity > 0) {
              mergedSnacks[itemId] = newQuantity
              console.log(`  ✅ ${itemId}: ${currentQuantity} - ${removeQuantity} = ${newQuantity}`)
            } else {
              delete mergedSnacks[itemId]
              console.log(`  🗑️ ${itemId}: deleted (quantity <= 0)`)
            }
          }

          console.log('Result snacks:', mergedSnacks)
        }
      }

      const validUpdate = {
        $set: {
          'order.drinks': mergedDrinks,
          'order.snacks': mergedSnacks,
          updatedAt: new Date(),
          updatedBy: user || 'system'
        },
        $push: {
          history: {
            timestamp: new Date(),
            updatedBy: user || 'system',
            changes: order
          }
        }
      }

      console.log('Update operation:', JSON.stringify(validUpdate, null, 2))

      const updatedOrder = await databaseService.fnbOrder.findOneAndUpdate(filter, validUpdate, {
        returnDocument: 'after' as const
      })

      console.log('Updated order result:', updatedOrder ? 'SUCCESS' : 'FAILED')
      if (updatedOrder) {
        console.log('Updated order ID:', updatedOrder._id)
        console.log('Updated order data:', JSON.stringify(updatedOrder, null, 2))
      }

      if (!updatedOrder) return null

      const result = new RoomScheduleFNBOrder(
        updatedOrder.roomScheduleId.toString(),
        updatedOrder.order,
        updatedOrder.createdBy,
        updatedOrder.updatedBy,
        updatedOrder.history || []
      )
      result._id = updatedOrder._id

      console.log('Returning updated order with ID:', result._id)
      console.log('=== END DEBUG UPSERT FNB ORDER ===')
      return result
    } else {
      // Nếu chưa có order, tạo mới
      console.log('Creating new order...')
      const fullOrder: FNBOrder = {
        drinks: order.drinks || {},
        snacks: order.snacks || {}
      }
      const newOrder = new RoomScheduleFNBOrder(roomScheduleId, fullOrder, user, user)

      const result = await databaseService.fnbOrder.insertOne(newOrder)
      newOrder._id = result.insertedId
      return newOrder
    }
  }
}

const fnbOrderService = new FnbOrderService()
export default fnbOrderService
