import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import databaseService from './database.services'
import { IRoom, Room } from '~/models/schemas/Room.schema'
import { ObjectId } from 'mongodb'
import { ROOM_MESSAGES } from '~/constants/messages'

class RoomServices {
  async addRoom(payload: IAddRoomRequestBody) {
    const result = await databaseService.rooms.insertOne({
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: payload.images || []
    })

    return new Room({
      ...payload,
      _id: result.insertedId,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: payload.images || []
    })
  }

  async getRooms() {
    // Lấy danh sách phòng
    const rooms = await databaseService.rooms.find().toArray()

    // Lấy bảng giá hiện tại
    const currentPrice = await databaseService.price.findOne({
      effective_date: { $lte: new Date() },
      $or: [{ end_date: null }, { end_date: { $gte: new Date() } }]
    })

    // Kết hợp thông tin phòng với giá
    const roomsWithPrices = rooms.map((room) => {
      const roomPrices = currentPrice?.time_slots.map((slot) => ({
        timeSlot: `${slot.start}-${slot.end}`,
        price: slot.prices.find((p) => p.room_type === room.roomType)?.price || 0
      }))

      return {
        ...room,
        prices: roomPrices || []
      }
    })

    return roomsWithPrices
  }

  async getRoom(id: string) {
    const result = await databaseService.rooms.findOne({ _id: new ObjectId(id) })
    if (!result) throw new Error(ROOM_MESSAGES.ROOM_NOT_FOUND)
    return result
  }

  async updateRoom(id: string, payload: Partial<IRoom>) {
    const result = await databaseService.rooms.updateOne({ _id: new ObjectId(id) }, { $set: payload })
    return result
  }

  async deleteRoom(id: string) {
    return await databaseService.rooms.deleteOne({ _id: new ObjectId(id) })
  }
}

export const roomServices = new RoomServices()
