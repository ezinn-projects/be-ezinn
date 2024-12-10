import { AddSongRequestBody } from '~/models/requests/Song.request'
import redis from '~/services/redis.service'
import { historyService } from '~/services/songHistory.service'
import { getVideoUrl } from './video.service'

class RoomMusicServices {
  async addSongToQueue(roomId: string, song: AddSongRequestBody, position: 'top' | 'end') {
    const queueKey = `room_${roomId}_queue`

    if (position === 'top') {
      // Thêm vào đầu danh sách
      await redis.lpush(queueKey, JSON.stringify(song))
    } else if (position === 'end') {
      // Thêm vào cuối danh sách
      await redis.rpush(queueKey, JSON.stringify(song))
    }

    // console.log('redis.lrange', await redis.get(queueKey))

    // Trả về danh sách hiện tại
    return (await redis.lrange(queueKey, 0, -1)).map((item: string) => JSON.parse(item))
  }

  async removeSongFromQueue(roomId: string, index: number) {
    const queueKey = `room_${roomId}_queue`

    // Lấy độ dài hiện tại của queue
    const len = await redis.llen(queueKey)

    if (index >= 0 && index < len) {
      // Di chuyển phần tử cuối cùng đến vị trí cần xóa
      const lastElement = await redis.lindex(queueKey, -1)
      if (lastElement) {
        await redis.lset(queueKey, index, lastElement)
      }

      // Cắt bỏ phần tử cuối cùng
      await redis.ltrim(queueKey, 0, -2)
    }

    // Trả về danh sách sau khi cập nhật
    return (await redis.lrange(queueKey, 0, -1)).map((item: string) => JSON.parse(item))
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

  async playNextSong(roomId: string): Promise<{ nowPlaying: AddSongRequestBody | null; queue: AddSongRequestBody[] }> {
    const queueKey = `room_${roomId}_queue`
    const nowPlayingKey = `room_${roomId}_now_playing`

    // Lấy bài hát đầu tiên trong queue
    const nowPlaying = await redis.lpop(queueKey)

    if (!nowPlaying) {
      return { nowPlaying: null, queue: [] } // Không còn bài hát trong hàng đợi
    }

    const song = JSON.parse(nowPlaying)

    // Lấy URL của bài hát
    const videoUrl = await getVideoUrl(song.video_id)

    // Lấy thời gian hiện tại và lưu bài hát đang phát
    const timestamp = Date.now() // Thời gian hiện tại
    const duration = song.duration || 0 // Cần thêm duration từ metadata

    const nowPlayingData = {
      ...song,
      url: videoUrl,
      timestamp,
      duration
    }

    // Lưu vào Redis
    await redis.set(nowPlayingKey, JSON.stringify(nowPlayingData))

    // Lấy danh sách bài hát còn lại trong hàng đợi
    const updatedQueue = (await redis.lrange(queueKey, 0, -1)).map((item: string) => JSON.parse(item))

    return { nowPlaying: nowPlayingData, queue: updatedQueue }
  }

  /**
   * @description Get songs in queue
   * @param roomId
   * @returns
   * @author QuangDoo
   */
  async getSongsInQueue(roomId: string): Promise<AddSongRequestBody[]> {
    const queueKey = `room_${roomId}_queue`
    return (await redis.lrange(queueKey, 0, -1)).map((item: string) => JSON.parse(item))
  }

  /**
   * @description Get now playing song
   * @param roomId
   * @returns
   * @author QuangDoo
   */
  async getNowPlaying(roomId: string): Promise<AddSongRequestBody | null> {
    const nowPlayingKey = `room_${roomId}_now_playing`
    const nowPlaying = await redis.get(nowPlayingKey)

    if (!nowPlaying) {
      return null // Không có bài hát đang phát
    }

    const parsedNowPlaying = JSON.parse(nowPlaying)

    // Tính toán current_time dựa trên timestamp
    const currentTime = Math.min(
      Math.floor((Date.now() - parsedNowPlaying.timestamp) / 1000), // Tính thời gian đã phát (giây)
      parsedNowPlaying.duration || 0 // Không vượt quá duration
    )

    return {
      ...parsedNowPlaying,
      currentTime
    }
  }

  /**
   * @description Remove all songs in queue
   * @param roomId
   * @author QuangDoo
   */
  async removeAllSongsInQueue(roomId: string) {
    const queueKey = `room_${roomId}_queue`
    await redis.del(queueKey)
  }
}

export const roomMusicServices = new RoomMusicServices()
