import { AddSongRequestBody } from '~/models/requests/Song.request'
import redis from '~/services/redis.service'
import { historyService } from '~/services/songHistory.service'
import youtubeDl, { Payload } from 'youtube-dl-exec'
import ytSearch from 'yt-search'

class RoomMusicServices {
  async addSongToQueue(roomId: string, song: AddSongRequestBody, position: 'top' | 'end') {
    const queueKey = `room_${roomId}_queue`

    if (position === 'top') {
      await redis.lpush(queueKey, JSON.stringify(song))
    } else if (position === 'end') {
      await redis.rpush(queueKey, JSON.stringify(song))
    }

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

    // Lấy thời gian hiện tại và lưu bài hát đang phát
    const timestamp = Date.now() // Thời gian hiện tại
    const duration = song.duration || 0 // Cần thêm duration từ metadata

    const nowPlayingData = {
      ...song,
      timestamp,
      duration
    }

    console.log('nowPlayingData', nowPlayingData)

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

  /**
   * @description Lấy thông tin video từ YouTube và map thành AddSongRequestBody
   * @param url - Đường dẫn video YouTube
   * @returns AddSongRequestBody
   * @author QuangDoo
   */
  async getVideoInfo(videoId: string): Promise<AddSongRequestBody> {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

      // Configure youtube-dl with basic options
      const info = (await youtubeDl(videoUrl, {
        dumpSingleJson: true,
        format: 'b', // Using 'b' instead of 'best' as recommended
        addHeader: [
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 googlebot youtube.com',
          'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language: en-US,en;q=0.5',
          'Referer: https://www.youtube.com/',
          'youtube-dl-options: --no-check-certificate --no-warnings --skip-download'
        ],
        // Basic options to improve reliability
        noCheckCertificates: true,
        noWarnings: true,
        skipDownload: true
      })) as Payload & { url: string }

      return {
        video_id: videoId,
        title: info.title || '',
        duration: info.duration,
        url: info.url,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        author: info.uploader || 'Jozo music - recording'
      }
    } catch (error: unknown) {
      throw new Error(`Failed to fetch video data: ${(error as Error).message}`)
    }
  }

  async updateQueue(roomId: string, queue: AddSongRequestBody[]) {
    const queueKey = `room_${roomId}_queue`
    await redis.del(queueKey)
    await redis.rpush(queueKey, ...queue.map((song) => JSON.stringify(song)))
    console.log('queue', queue)
    return queue
  }

  /**
   * @description Play song at specific index in queue
   * @param roomId - Room ID
   * @param index - Index of song in queue to play
   * @returns The now playing song and updated queue
   * @author [Your Name]
   */
  async playChosenSong(
    roomId: string,
    index: number
  ): Promise<{ nowPlaying: AddSongRequestBody | null; queue: AddSongRequestBody[] }> {
    const queueKey = `room_${roomId}_queue`
    const nowPlayingKey = `room_${roomId}_now_playing`

    // Lấy danh sách bài hát trong hàng đợi
    const queue = (await redis.lrange(queueKey, 0, -1)).map((item: string) => JSON.parse(item))

    // Kiểm tra nếu index hợp lệ
    if (index < 0 || index >= queue.length) {
      // Trả về danh sách hiện tại nếu index không hợp lệ
      const currentNowPlaying = await this.getNowPlaying(roomId)
      return { nowPlaying: currentNowPlaying, queue }
    }

    // Lấy bài hát được chọn
    const chosenSong = queue[index]

    // Xóa bài hát khỏi hàng đợi
    queue.splice(index, 1)

    // Cập nhật lại hàng đợi trong Redis
    await redis.del(queueKey)
    if (queue.length > 0) {
      await redis.rpush(queueKey, ...queue.map((song) => JSON.stringify(song)))
    }

    // Cập nhật thông tin bài hát đang phát
    const timestamp = Date.now()
    const duration = chosenSong.duration || 0

    const nowPlayingData = {
      ...chosenSong,
      timestamp,
      duration
    }

    // Lưu vào Redis
    await redis.set(nowPlayingKey, JSON.stringify(nowPlayingData))

    // Trả về thông tin bài hát đang phát và hàng đợi đã cập nhật
    return { nowPlaying: nowPlayingData, queue }
  }

  async getSongName(keyword: string, isKaraoke: boolean = false): Promise<string[]> {
    try {
      if (keyword.length < 2) {
        return []
      }

      const searchQuery = isKaraoke ? `${keyword} karaoke` : keyword

      const searchResults = await ytSearch({
        query: searchQuery,
        pageStart: 1,
        pageEnd: 2
      })

      // Hàm chuyển text có dấu thành không dấu
      const removeAccents = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
      }

      const keywordNoAccent = removeAccents(keyword.toLowerCase())

      // Kiểm tra xem có phải đang tìm nghệ sĩ không
      const isSearchingArtist = searchResults.videos.some((video) =>
        video.author.name?.toLowerCase().includes(keyword.toLowerCase())
      )

      const calculateSimilarity = (str1: string, str2: string, checkAuthor: boolean = false): number => {
        const s1 = str1.toLowerCase()
        const s2 = str2.toLowerCase()

        // Nếu đang tìm nghệ sĩ và là author name
        if (isSearchingArtist && checkAuthor && s2.includes(s1)) {
          return 2000 // Ưu tiên cao nhất cho tên nghệ sĩ
        }

        // Kiểm tra chứa từ khóa chính xác
        if (s2.includes(s1)) return 1000

        // Tính số ký tự giống nhau liên tiếp
        let maxCommonLength = 0
        for (let i = 0; i < s1.length; i++) {
          for (let j = 0; j < s2.length; j++) {
            let length = 0
            while (i + length < s1.length && j + length < s2.length && s1[i + length] === s2[j + length]) {
              length++
            }
            maxCommonLength = Math.max(maxCommonLength, length)
          }
        }
        return maxCommonLength
      }

      const suggestions = searchResults.videos
        .sort((a, b) => {
          if (isKaraoke) {
            const aHasKaraoke = a.title.toLowerCase().includes('karaoke')
            const bHasKaraoke = b.title.toLowerCase().includes('karaoke')
            if (aHasKaraoke && !bHasKaraoke) return -1
            if (!aHasKaraoke && bHasKaraoke) return 1
          }

          // Tính điểm tương đồng cho cả title và author
          const aSimilarityTitle = calculateSimilarity(keyword, a.title)
          const bSimilarityTitle = calculateSimilarity(keyword, b.title)
          const aSimilarityAuthor = calculateSimilarity(keyword, a.author.name || '', true)
          const bSimilarityAuthor = calculateSimilarity(keyword, b.author.name || '', true)

          // Lấy điểm cao nhất giữa title và author
          const aSimilarity = Math.max(aSimilarityTitle, aSimilarityAuthor)
          const bSimilarity = Math.max(bSimilarityTitle, bSimilarityAuthor)

          if (aSimilarity !== bSimilarity) {
            return bSimilarity - aSimilarity
          }

          return (b.views || 0) - (a.views || 0)
        })
        .map((video) => {
          if (isSearchingArtist && video.author.name?.toLowerCase().includes(keyword.toLowerCase())) {
            return video.author.name
          }

          let title = video.title
            // Tách phần trước và sau dấu gạch ngang
            .split('-')[0]
            // Chỉ xóa một số từ khóa không cần thiết
            .replace(/(Official Music Video|Official MV|Official Video|MV|Lyric Video|Audio|Official|M\/V)/gi, '')
            .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          return title
        })
        .filter((title, index, self) => {
          const titleNoAccent = removeAccents(title.toLowerCase())
          return (
            // Loại bỏ các kết quả trùng lặp
            self.indexOf(title) === index &&
            // Kiểm tra cả dạng có dấu và không dấu
            (titleNoAccent.includes(keywordNoAccent) || title.toLowerCase().includes(keyword.toLowerCase()))
          )
        })
        .slice(0, 5)

      return suggestions
    } catch (error) {
      console.error('Error getting song suggestions:', error)
      return []
    }
  }
}

export const roomMusicServices = new RoomMusicServices()
