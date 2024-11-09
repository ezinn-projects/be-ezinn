import { AddRoomTypeRequestBody } from '~/models/requests/RoomType.request'
import RoomType from '~/models/schemas/RoomType.schema'
import databaseService from './database.services'
import { ObjectId } from 'mongodb'

class RoomTypeServices {
  async addRoomType(payload: AddRoomTypeRequestBody) {
    const result = await databaseService.roomTypes.insertOne(new RoomType(payload))

    return new RoomType({
      _id: result.insertedId,
      ...payload
    })
  }

  async getRoomTypes() {
    const result = await databaseService.roomTypes.find().toArray()

    return result.map((roomType) => new RoomType(roomType))
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

    return result ? new RoomType(result) : null
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
