import { MongoClient, Collection } from 'mongodb'
import databaseService from './database.service'
import { SongHistory } from '~/models/schemas/SongHistiry.schema'

// Lớp dịch vụ xử lý lịch sử bài hát
class HistoryService {
  /**
   * Lưu bài hát vào lịch sử
   * @param roomId Mã phòng
   * @param song Thông tin bài hát (videoId, title, thumbnail, channelTitle)
   */
  async saveSongHistory(roomId: string, song: any) {
    const document = {
      roomId,
      ...song,
      playedAt: new Date() // Thời gian bài hát được phát
    }

    const result = await databaseService.songHistory.insertOne(new SongHistory(document))
    return result.insertedId
  }

  /**
   * Lấy lịch sử bài hát của một phòng
   * @param roomId Mã phòng
   */
  async getRoomHistory(roomId: string) {
    return await databaseService.songHistory
      .find({ roomId }) // Lọc theo roomId
      .sort({ playedAt: -1 }) // Sắp xếp theo thời gian giảm dần
      .toArray()
  }

  /**
   * Xóa lịch sử của một phòng
   * @param roomId Mã phòng
   */
  async clearRoomHistory(roomId: string) {
    const result = await databaseService.songHistory.deleteMany({ roomId })
    return result.deletedCount
  }
}

export const historyService = new HistoryService()
