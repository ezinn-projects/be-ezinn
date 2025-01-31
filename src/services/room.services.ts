import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import databaseService from './database.services'
import { IRoom, Room } from '~/models/schemas/Room.schema'
import { ObjectId } from 'mongodb'
import { ROOM_MESSAGES } from '~/constants/messages'

class RoomServices {
  async addRoom(payload: IAddRoomRequestBody) {
    const result = await databaseService.rooms.insertOne({
      ...payload,
      createdAt: new Date().toISOString()
    })

    return new Room({
      ...payload,
      _id: result.insertedId,
      createdAt: new Date().toISOString()
    })
  }

  async getRooms() {
    return await databaseService.rooms.find().toArray()
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
