import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import databaseService from './database.services'
import { Room } from '~/models/schemas/Room.schema'

class RoomServices {
  async addRoom(payload: IAddRoomRequestBody) {
    const result = await databaseService.rooms.insertOne(new Room(payload))

    return new Room({
      ...payload,
      _id: result.insertedId,
      createdAt: new Date().toISOString()
    })
  }
}

export const roomServices = new RoomServices()
