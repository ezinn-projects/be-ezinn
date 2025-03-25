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
        if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
          continue
        }
        filteredOrder[key as keyof FNBOrder] = value
      }
    }

    const filter = { roomScheduleId: new ObjectId(roomScheduleId) }

    // Update document (không dùng pipeline)
    const update = {
      $set: {
        order: {
          drinks: filteredOrder.drinks || {},
          snacks: filteredOrder.snacks || {}
        },
        updatedAt: new Date(),
        updatedBy: user || ' Ive',
        createdAt: { $ifNull: ['$createdAt', new Date()] },
        createdBy: { $ifNull: ['$createdBy', user || 'system'] }
      },
      $push: {
        history: {
          timestamp: new Date(),
          updatedBy: user || 'system',
          changes: filteredOrder
        }
      }
    }

    const validUpdate = {
      $set: {
        'order.drinks': filteredOrder.drinks || {},
        'order.snacks': filteredOrder.snacks || {},
        updatedAt: new Date(),
        updatedBy: user || ' Ive'
      },
      $setOnInsert: {
        createdAt: new Date(),
        createdBy: user || 'system'
      },
      $push: {
        history: {
          timestamp: new Date(),
          updatedBy: user || 'system',
          changes: filteredOrder
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
