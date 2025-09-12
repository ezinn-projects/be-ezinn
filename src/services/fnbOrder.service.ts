import { ObjectId } from 'mongodb'
import { RoomScheduleFNBOrder, FNBOrder, FNBOrderHistoryRecord } from '~/models/schemas/FNB.schema'
import databaseService from './database.service'
import fnbMenuItemService from './fnbMenuItem.service'

class FnbOrderService {
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

  async getFnbOrdersByRoomSchedule(roomScheduleId: string): Promise<RoomScheduleFNBOrder[]> {
    const orders = await databaseService.fnbOrder.find({ roomScheduleId: new ObjectId(roomScheduleId) }).toArray()

    return orders.map(
      (order) =>
        new RoomScheduleFNBOrder(order.roomScheduleId.toString(), order.order, order.createdBy, order.updatedBy)
    )
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
    user?: string
  ): Promise<RoomScheduleFNBOrder | null> {
    const filter = { roomScheduleId: new ObjectId(roomScheduleId) }

    // Lấy dữ liệu hiện tại để merge
    const existingOrder = await databaseService.fnbOrder.findOne(filter)
    const currentDrinks = existingOrder?.order?.drinks || {}
    const currentSnacks = existingOrder?.order?.snacks || {}

    // Merge drinks: chỉ cập nhật những item có trong request, giữ nguyên những item cũ
    let mergedDrinks = { ...currentDrinks }
    if (order.drinks) {
      // Lọc bỏ các item có quantity = 0
      const validDrinks = Object.fromEntries(
        Object.entries(order.drinks).filter(([_, quantity]) => (quantity as number) > 0)
      )
      mergedDrinks = { ...mergedDrinks, ...validDrinks }
    }

    // Merge snacks: chỉ cập nhật những item có trong request, giữ nguyên những item cũ
    let mergedSnacks = { ...currentSnacks }
    if (order.snacks) {
      // Lọc bỏ các item có quantity = 0
      const validSnacks = Object.fromEntries(
        Object.entries(order.snacks).filter(([_, quantity]) => (quantity as number) > 0)
      )
      mergedSnacks = { ...mergedSnacks, ...validSnacks }
    }

    const validUpdate = {
      $set: {
        'order.drinks': mergedDrinks,
        'order.snacks': mergedSnacks,
        updatedAt: new Date(),
        updatedBy: user || 'system'
      },
      $setOnInsert: {
        createdAt: new Date(),
        createdBy: user || 'system'
      },
      $push: {
        history: {
          timestamp: new Date(),
          updatedBy: user || 'system',
          changes: order
        }
      }
    }

    const updatedOrder = await databaseService.fnbOrder.findOneAndUpdate(filter, validUpdate, {
      upsert: true,
      returnDocument: 'after' as const
    })
    if (!updatedOrder) return null

    return new RoomScheduleFNBOrder(
      updatedOrder.roomScheduleId.toString(),
      updatedOrder.order,
      updatedOrder.createdBy,
      updatedOrder.updatedBy,
      updatedOrder.history || []
    )
  }
}

const fnbOrderService = new FnbOrderService()
export default fnbOrderService
