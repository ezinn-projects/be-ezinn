import { AddSongRequestBody } from '~/models/requests/Song.request'
import redis from '~/services/redis.service'

class SongQueueServices {
  async addSongToQueue(roomId: string, song: AddSongRequestBody) {
    const queueKey = `room_${roomId}_queue`
    await redis.lpush(queueKey, JSON.stringify(song))
    return await redis.lrange(queueKey, 0, -1) // Trả về danh sách hiện tại
  }

  async removeSongFromQueue(roomId: string, videoId: string) {
    const queueKey = `room_${roomId}_queue`
    const currentQueue = await redis.lrange(queueKey, 0, -1)

    // Lọc danh sách
    const updatedQueue = currentQueue.filter((item: string) => {
      const parsedSong = JSON.parse(item)
      return parsedSong.videoId !== videoId
    })

    // Cập nhật lại Redis
    await redis.del(queueKey)
    for (const song of updatedQueue) {
      await redis.lpush(queueKey, song)
    }

    return updatedQueue
  }
}

export const songQueueServices = new SongQueueServices()
