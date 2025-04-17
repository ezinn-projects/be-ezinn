import { IAddRoomRequestBody } from '~/models/requests/Room.request'
import databaseService from './database.service'
import { IRoom, Room } from '~/models/schemas/Room.schema'
import { ObjectId } from 'mongodb'
import { ROOM_MESSAGES } from '~/constants/messages'
import redis from './redis.service'
import { EventEmitter } from 'events'

export const roomEventEmitter = new EventEmitter()

class RoomServices {
  async addRoom(payload: IAddRoomRequestBody) {
    const result = await databaseService.rooms.insertOne({
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return new Room({
      ...payload,
      _id: result.insertedId,
      createdAt: new Date(),
      updatedAt: new Date()
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
    // Remove _id from payload to prevent immutable field modification
    const { _id, ...updateData } = payload

    const result = await databaseService.rooms.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    )
    return result
  }

  async deleteRoom(id: string) {
    return await databaseService.rooms.deleteOne({ _id: new ObjectId(id) })
  }

  async solveRequest(roomId: string) {
    // delete notification in redis
    const notificationKey = `room_${roomId}_notification`
    await redis.del(notificationKey)
    return true
  }

  async turnOffVideos() {
    // Clean up all rooms
    for (let i = 1; i <= 7; i++) {
      const roomId = `${i}`
      // Clean up Redis data
      await Promise.all([
        redis.del(`room_${roomId}_queue`),
        redis.del(`room_${roomId}_now_playing`),
        redis.del(`room_${roomId}_playback`),
        redis.del(`room_${roomId}_current_time`),
        redis.set(`room_${roomId}_off_status`, 'true')
      ])

      // Emit events for socket service to handle
      roomEventEmitter.emit('queue_updated', { roomId, queue: [] })
      roomEventEmitter.emit('videos_turned_off', { roomId })
    }

    return true
  }
  async getRoomStatus(roomId: string) {
    const roomStatus = await redis.get(`room_${roomId}_off_status`)
    return roomStatus
  }

  async setRoomStatus(roomId: string, status: string) {
    await redis.set(`room_${roomId}_off_status`, status)
  }
}

export const roomServices = new RoomServices()
