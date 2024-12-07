import { AddSongRequestBody } from '~/models/requests/Song.request'
import redis from '~/services/redis.service'
import { historyService } from '~/services/songHistory.service'
import { getVideoUrl } from './video.service'

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

  async moveSongToHistory(roomId: string) {
    const queueKey = `room_${roomId}_queue`

    // Lấy bài hát đầu tiên trong hàng đợi
    const nowPlaying = await redis.lpop(queueKey)

    if (nowPlaying) {
      const song = JSON.parse(nowPlaying)

      // Lưu bài hát đã phát vào MongoDB
      await historyService.saveSongHistory(roomId, song)
      return song
    }

    return null // Nếu không có bài hát nào trong hàng đợi
  }

  async playNextSong(roomId: string): Promise<AddSongRequestBody | null> {
    const queueKey = `room_${roomId}_queue`

    // Lấy bài hát đầu tiên trong queue
    const nowPlaying = await redis.lpop(queueKey)

    if (!nowPlaying) {
      return null
    }

    const song = JSON.parse(nowPlaying)

    // Lấy URL của bài hát
    const videoUrl = await getVideoUrl(song.videoId)

    // Thêm URL vào bài hát và trả về
    return { ...song, url: videoUrl }
  }
}

export const songQueueServices = new SongQueueServices()
