import { ObjectId } from 'mongodb'
import { RoomScheduleFNBOrder, FNBOrder } from '~/models/schemas/FNB.schema'
import databaseService from './database.service'

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

  async updateFnbOrder(id: string, order: Partial<FNBOrder>, updatedBy?: string): Promise<RoomScheduleFNBOrder | null> {
    const existingOrder = await this.getFnbOrderById(id)
    if (!existingOrder) return null

    const updateResult = await databaseService.fnbOrder.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          order: { ...existingOrder.order, ...order },
          updatedAt: new Date(),
          updatedBy: updatedBy || 'system'
        }
      },
      { returnDocument: 'after' }
    )

    return updateResult
      ? new RoomScheduleFNBOrder(
          updateResult.roomScheduleId.toString(),
          updateResult.order,
          updateResult.createdBy,
          updateResult.updatedBy
        )
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

  async upsertFnbOrder(
    roomScheduleId: string,
    order: Partial<FNBOrder>,
    user?: string
  ): Promise<RoomScheduleFNBOrder | null> {
    // Lọc bỏ các key mà value là object rỗng
    const filteredOrder: Partial<FNBOrder> = {}
    for (const key in order) {
      if (order.hasOwnProperty(key)) {
        const value = order[key as keyof FNBOrder]
        // Nếu value là object và rỗng, bỏ qua key đó
        if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
          continue
        }
        filteredOrder[key as keyof FNBOrder] = value
      }
    }

    const filter = { roomScheduleId: new ObjectId(roomScheduleId) }

    const updatePipeline = [
      {
        $set: {
          order: { $mergeObjects: [{ $ifNull: ['$order', {}] }, filteredOrder] },
          updatedAt: new Date(),
          updatedBy: user || 'system',
          createdAt: { $ifNull: ['$createdAt', new Date()] },
          createdBy: { $ifNull: ['$createdBy', user || 'system'] }
        }
      }
    ]

    const options = { upsert: true, returnDocument: 'after' as const }
    const updatedOrder = await databaseService.fnbOrder.findOneAndUpdate(filter, updatePipeline, options)
    if (!updatedOrder) return null
    return new RoomScheduleFNBOrder(
      updatedOrder.roomScheduleId.toString(),
      updatedOrder.order,
      updatedOrder.createdBy,
      updatedOrder.updatedBy
    )
  }
}

const fnbOrderService = new FnbOrderService()
export default fnbOrderService
