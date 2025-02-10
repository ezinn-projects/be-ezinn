import { AddRoomTypeRequestBody } from '~/models/requests/RoomType.request'
import RoomType from '~/models/schemas/RoomType.schema'
import databaseService from './database.services'
import { ObjectId } from 'mongodb'

class RoomTypeServices {
  async addRoomType(payload: AddRoomTypeRequestBody) {
    const result = await databaseService.roomTypes.insertOne({
      ...payload,
      created_at: new Date(),
      updated_at: new Date(),
      images: payload.images || [],
      type: payload.type
    })

    return new RoomType({
      ...payload,
      _id: result.insertedId,
      created_at: new Date(),
      updated_at: new Date(),
      images: payload.images || [],
      type: payload.type
    })
  }

  async getRoomTypes() {
    // Lấy tất cả room types
    const roomTypes = await databaseService.roomTypes.find().toArray()

    // Lấy bảng giá hiện tại
    const currentPrice = await databaseService.price.findOne({
      effective_date: { $lte: new Date() },
      $or: [{ end_date: null }, { end_date: { $gte: new Date() } }]
    })

    // Kết hợp thông tin room type với giá
    const roomTypesWithPrices = roomTypes.map((roomType) => {
      const roomTypePrices = currentPrice?.time_slots.map((slot) => ({
        timeSlot: `${slot.start}-${slot.end}`,
        price: slot.prices.find((p) => p.room_type === roomType.type)?.price || 0
      }))

      return {
        ...roomType,
        prices: roomTypePrices || []
      }
    })

    return roomTypesWithPrices
  }

  async getRoomTypeById(roomTypeId: string) {
    if (!ObjectId.isValid(roomTypeId)) {
      throw new Error('Invalid ID format')
    }

    const result = await databaseService.roomTypes.findOne({ _id: new ObjectId(roomTypeId) })
    if (!result) {
      throw new Error('Room type not found')
    }

    return new RoomType(result)
  }

  async updateRoomTypeById(roomTypeId: string, payload: AddRoomTypeRequestBody) {
    const result = await databaseService.roomTypes.findOneAndUpdate(
      { _id: new ObjectId(roomTypeId) },
      { $set: payload }
    )

    return result ? new RoomType({ ...result, ...payload }) : null
  }

  async deleteRoomTypeById(roomTypeId: string) {
    const result = await databaseService.roomTypes.deleteOne({ _id: new ObjectId(roomTypeId) })

    return result.deletedCount > 0
  }

  async deleteManyRoomTypes(roomTypeIds: string[]) {
    const result = await databaseService.roomTypes.deleteMany({
      _id: { $in: roomTypeIds.map((id) => new ObjectId(id)) }
    })

    return result.deletedCount > 0
  }
}

export const roomTypeServices = new RoomTypeServices()
