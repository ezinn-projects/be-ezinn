import { AddSongRequestBody } from '~/models/requests/Song.request'
import redis from '~/services/redis.service'
import { historyService } from '~/services/songHistory.service'
import ytdl from 'youtube-dl-exec'
import ytSearch from 'yt-search'
import serverService from './server.service'
import { EventEmitter } from 'events'

export const roomMusicEventEmitter = new EventEmitter()

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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
   * @param videoId - ID của video YouTube
   * @returns AddSongRequestBody
   * @author QuangDoo
   */
  async getVideoInfo(videoId: string): Promise<AddSongRequestBody> {
    const videoUrl = `https://youtu.be/${videoId}`

    /** Gọi yt‑dlp qua youtube‑dl‑exec – mất ~400 ms */
    const info = (await ytdl(videoUrl, {
      dumpSingleJson: true, // JSON duy nhất
      noWarnings: true,
      noCheckCertificates: true,
      forceIpv4: true, // tránh IPv6 timeout
      geoBypassCountry: 'VN', // né khoá vùng
      // progressive ≤1080p; fallback 720p (22) → 360p (18)
      format: 'bestvideo[height<=1080][vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/22/18',
      // để yt‑dlp tự thêm header vào kết quả
      addHeader: [`User-Agent: ${UA}`, 'Referer: https://www.youtube.com/']
    })) as any

    /** tìm format đã "có sẵn audio" (progressive) */
    const playable = info.formats.find((f: any) => f.vcodec !== 'none' && f.acodec !== 'none')
    if (!playable) throw new Error('Không tìm thấy format MP4 phù hợp')

    // Tạo và trả về đối tượng phù hợp với AddSongRequestBody
    return {
      video_id: videoId,
      title: info.title ?? '',
      duration: info.duration,
      url: playable.url,
      thumbnail: info.thumbnail ?? info.thumbnails?.[0]?.url,
      author: info.uploader ?? 'Jozo music - recording'
    }
  }

  async updateQueue(roomId: string, queue: AddSongRequestBody[]) {
    const queueKey = `room_${roomId}_queue`
    await redis.del(queueKey)
    await redis.rpush(queueKey, ...queue.map((song) => JSON.stringify(song)))

    return queue
  }

  /**
   * @description Play song at specific index in queue
   * @param roomId - Room ID
   * @param index - Index of song in queue to play
   * @returns The now playing song and updated queue
   * @author QuangDoo
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
      // Hàm chuyển text có dấu thành không dấu
      const removeAccents = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
      }

      // Hàm tính khoảng cách Levenshtein để xử lý lỗi chính tả
      const calculateLevenshteinDistance = (a: string, b: string): number => {
        const matrix: number[][] = Array(a.length + 1)
          .fill(0)
          .map(() => Array(b.length + 1).fill(0))

        for (let i = 0; i <= a.length; i++) {
          matrix[i][0] = i
        }

        for (let j = 0; j <= b.length; j++) {
          matrix[0][j] = j
        }

        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1, // deletion
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j - 1] + cost // substitution
            )
          }
        }

        return matrix[a.length][b.length]
      }

      // Xử lý từ khóa tìm kiếm trước khi sử dụng
      const cleanKeyword = keyword.trim()

      // Danh sách các từ khóa phổ biến thường bị gõ sai
      const commonMisspellings: Record<string, string> = {
        'black pinkk': 'blackpink',
        blackpinkk: 'blackpink',
        bts: 'bts',
        twice: 'twice',
        'son tung': 'son tung mtp',
        sontung: 'son tung mtp'
      }

      // Tìm từ khóa gần nhất với misspelling
      let correctedKeyword = cleanKeyword

      // Tạo phiên bản không dấu, không khoảng trắng để so sánh
      const normalizedKeyword = removeAccents(cleanKeyword.toLowerCase()).replace(/\s+/g, '')

      for (const [misspelled, correct] of Object.entries(commonMisspellings)) {
        const normalizedMisspelled = removeAccents(misspelled.toLowerCase()).replace(/\s+/g, '')

        // So sánh với lỗi đánh máy phổ biến
        if (
          normalizedKeyword === normalizedMisspelled ||
          (normalizedKeyword.length > 4 &&
            (normalizedMisspelled.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedMisspelled)))
        ) {
          correctedKeyword = correct
          break
        }

        // Kiểm tra lỗi chính tả với khoảng cách Levenshtein
        if (
          normalizedKeyword.length > 4 &&
          calculateLevenshteinDistance(normalizedKeyword, normalizedMisspelled) <= 2
        ) {
          correctedKeyword = correct
          break
        }
      }

      // Xử lý các trường hợp từ khóa quá ngắn
      if (cleanKeyword.length < 2) {
        // Lấy các xu hướng tìm kiếm được cache
        const trendingKey = isKaraoke ? 'trending_karaoke_searches' : 'trending_music_searches'
        const cachedTrending = await redis.get(trendingKey)

        if (cachedTrending) {
          return JSON.parse(cachedTrending)
        }

        // Fallback mặc định nếu không có cache
        return isKaraoke
          ? ['Karaoke Việt Nam', 'Karaoke Nhạc Trẻ', 'Karaoke Bolero', 'Karaoke English', 'Karaoke Trữ Tình']
          : ['BLACKPINK', 'BTS', 'Sơn Tùng MTP', 'Bích Phương', 'Đen Vâu']
      }

      // Tạo cache key cho từ khóa tìm kiếm này
      const cacheKey = `search_results_${removeAccents(correctedKeyword.toLowerCase())}_${isKaraoke ? 'karaoke' : 'normal'}`

      // Kiểm tra cache
      const cachedResults = await redis.get(cacheKey)
      if (cachedResults) {
        return JSON.parse(cachedResults)
      }

      const searchQuery = isKaraoke ? `${correctedKeyword} karaoke` : correctedKeyword

      const searchResults = await ytSearch({
        query: searchQuery,
        pageStart: 1,
        pageEnd: 2
      })

      const keywordNoAccent = removeAccents(correctedKeyword.toLowerCase())

      // Kiểm tra xem có phải đang tìm nghệ sĩ không
      const isSearchingArtist = searchResults.videos.some((video) =>
        video.author.name?.toLowerCase().includes(correctedKeyword.toLowerCase())
      )

      const calculateSimilarity = (str1: string, str2: string, checkAuthor: boolean = false): number => {
        const s1 = str1.toLowerCase()
        const s2 = str2.toLowerCase()
        const s1NoAccent = removeAccents(s1)
        const s2NoAccent = removeAccents(s2)

        // Loại bỏ khoảng trắng cho việc so sánh
        const s1NoSpace = s1NoAccent.replace(/\s+/g, '')
        const s2NoSpace = s2NoAccent.replace(/\s+/g, '')

        // Nếu đang tìm nghệ sĩ và là author name
        if (isSearchingArtist && checkAuthor) {
          if (s2.includes(s1)) return 2000 // Ưu tiên cao nhất cho tên nghệ sĩ chính xác
          if (s2NoAccent.includes(s1NoAccent)) return 1800 // Ưu tiên cho tên nghệ sĩ không dấu
          if (s2NoSpace.includes(s1NoSpace)) return 1700 // Ưu tiên cho tên nghệ sĩ không dấu và không khoảng trắng
        }

        // Kiểm tra chứa từ khóa chính xác
        if (s2.startsWith(s1)) return 1500 // Ưu tiên bắt đầu bằng
        if (s2.includes(s1)) return 1000
        if (s2NoAccent.includes(s1NoAccent)) return 800

        // So sánh không có khoảng trắng
        if (s2NoSpace.includes(s1NoSpace)) return 750

        // Xử lý trường hợp lỗi chính tả
        if (s1.length > 4 && calculateLevenshteinDistance(s1NoSpace, s2NoSpace) <= 2) return 700

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

        // Nếu từ khóa rất ngắn nhưng match được >= 60% thì cũng đáng kể
        if (s1.length <= 3 && maxCommonLength >= s1.length * 0.6) {
          return 700
        }

        return maxCommonLength
      }

      // Lưu trữ cặp tên bài hát và nghệ sĩ
      const titleArtistPairs: { title: string; artist: string; score: number }[] = []

      const suggestions = searchResults.videos
        .sort((a, b) => {
          if (isKaraoke) {
            const aHasKaraoke = a.title.toLowerCase().includes('karaoke')
            const bHasKaraoke = b.title.toLowerCase().includes('karaoke')
            if (aHasKaraoke && !bHasKaraoke) return -1
            if (!aHasKaraoke && bHasKaraoke) return 1
          }

          // Tính điểm tương đồng cho cả title và author
          const aSimilarityTitle = calculateSimilarity(correctedKeyword, a.title)
          const bSimilarityTitle = calculateSimilarity(correctedKeyword, b.title)
          const aSimilarityAuthor = calculateSimilarity(correctedKeyword, a.author.name || '', true)
          const bSimilarityAuthor = calculateSimilarity(correctedKeyword, b.author.name || '', true)

          // Lấy điểm cao nhất giữa title và author
          const aSimilarity = Math.max(aSimilarityTitle, aSimilarityAuthor)
          const bSimilarity = Math.max(bSimilarityTitle, bSimilarityAuthor)

          if (aSimilarity !== bSimilarity) {
            return bSimilarity - aSimilarity
          }

          return (b.views || 0) - (a.views || 0)
        })
        .map((video) => {
          const artist = video.author.name || ''

          // Nếu đang tìm nghệ sĩ và tên tác giả có chứa từ khóa
          if (
            isSearchingArtist &&
            (artist.toLowerCase().includes(correctedKeyword.toLowerCase()) ||
              removeAccents(artist.toLowerCase()).includes(keywordNoAccent) ||
              removeAccents(artist.toLowerCase()).replace(/\s+/g, '').includes(keywordNoAccent.replace(/\s+/g, '')))
          ) {
            // Lưu cả tên nghệ sĩ và một số bài hát của họ
            titleArtistPairs.push({
              title: video.title
                .replace(/(Official Music Video|Official MV|Official Video|MV|Lyric Video|Audio|Official|M\/V)/gi, '')
                .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim(),
              artist,
              score: 2000 + (video.views || 0) / 1000000
            })

            return artist
          }

          let title = video.title
            // Tách phần trước và sau dấu gạch ngang
            .split('-')[0]
            // Chỉ xóa một số từ khóa không cần thiết
            .replace(/(Official Music Video|Official MV|Official Video|MV|Lyric Video|Audio|Official|M\/V)/gi, '')
            .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          // Lưu cặp title và artist cho mỗi kết quả
          titleArtistPairs.push({
            title,
            artist,
            score: calculateSimilarity(correctedKeyword, title) + (video.views || 0) / 1000000
          })

          return title
        })
        .filter((title, index, self) => {
          const titleNoAccent = removeAccents(title.toLowerCase())
          const titleNoSpace = titleNoAccent.replace(/\s+/g, '')
          const keywordNoSpace = keywordNoAccent.replace(/\s+/g, '')

          return (
            // Loại bỏ các kết quả trùng lặp
            self.indexOf(title) === index &&
            // Kiểm tra nhiều dạng khác nhau
            (titleNoAccent.includes(keywordNoAccent) ||
              title.toLowerCase().includes(correctedKeyword.toLowerCase()) ||
              titleNoSpace.includes(keywordNoSpace) ||
              calculateLevenshteinDistance(titleNoSpace, keywordNoSpace) <= 2)
          )
        })

      // Nếu đang tìm nghệ sĩ và có kết quả, thêm một số bài hát của nghệ sĩ đó vào kết quả
      let finalResults: string[] = []

      if (isSearchingArtist && titleArtistPairs.some((p) => p.score >= 2000)) {
        const artistName = titleArtistPairs.find((p) => p.score >= 2000)?.artist
        if (artistName) {
          // Lọc ra các bài hát của nghệ sĩ
          const artistSongs = titleArtistPairs
            .filter((p) => p.artist === artistName && p.title !== artistName)
            .sort((a, b) => b.score - a.score)
            .map((p) => `${p.title} - ${p.artist}`)
            .slice(0, 2)

          // Thêm bài hát của nghệ sĩ vào đầu kết quả
          finalResults = [artistName, ...artistSongs, ...suggestions.filter((s) => s !== artistName)].slice(0, 5)

          // Lưu vào trending artists cache nếu đây là nghệ sĩ
          this.updateSearchTrends(artistName, 'artist')
        }
      } else {
        finalResults = suggestions.slice(0, 5)

        // Lưu vào trending songs cache nếu có kết quả
        if (finalResults.length > 0) {
          this.updateSearchTrends(finalResults[0], 'song')
        }
      }

      // Nếu không có kết quả nhưng người dùng đang tìm kiếm từ khóa có sửa lỗi chính tả
      if (finalResults.length === 0 && correctedKeyword !== cleanKeyword) {
        // Thử lại với từ khóa gợi ý
        return this.getSongName(correctedKeyword, isKaraoke)
      }

      // Cache kết quả cho từ khóa này (thời hạn 1 giờ)
      await redis.setex(cacheKey, 3600, JSON.stringify(finalResults))

      return finalResults
    } catch (error) {
      console.error('Error getting song suggestions:', error)
      return []
    }
  }

  /**
   * Cập nhật xu hướng tìm kiếm
   * @param keyword Từ khóa được tìm kiếm
   * @param type Loại tìm kiếm (artist hoặc song)
   */
  private async updateSearchTrends(keyword: string, type: 'artist' | 'song'): Promise<void> {
    try {
      // Cập nhật trending searches
      const trendingKey = type === 'artist' ? 'trending_artists' : 'trending_songs'
      const trending = await redis.get(trendingKey)
      let trendingList: { keyword: string; count: number }[] = []

      if (trending) {
        trendingList = JSON.parse(trending)

        // Tìm từ khóa trong danh sách đã có
        const existingIndex = trendingList.findIndex((item) => item.keyword.toLowerCase() === keyword.toLowerCase())

        if (existingIndex >= 0) {
          // Tăng số lượt tìm kiếm
          trendingList[existingIndex].count += 1
        } else {
          // Thêm từ khóa mới
          trendingList.push({ keyword, count: 1 })
        }

        // Sắp xếp theo số lượt tìm kiếm
        trendingList.sort((a, b) => b.count - a.count)

        // Giới hạn danh sách
        trendingList = trendingList.slice(0, 15)
      } else {
        // Tạo danh sách mới
        trendingList = [{ keyword, count: 1 }]
      }

      // Lưu lại trending list với thời hạn 24 giờ
      await redis.setex(trendingKey, 24 * 3600, JSON.stringify(trendingList))

      // Cập nhật danh sách trending searches cho client
      const trendingSearchKey = type === 'artist' ? 'trending_music_searches' : 'trending_karaoke_searches'
      await redis.setex(
        trendingSearchKey,
        24 * 3600,
        JSON.stringify(trendingList.map((item) => item.keyword).slice(0, 5))
      )
    } catch (error) {
      console.error('Error updating search trends:', error)
    }
  }

  /**
   * @description Send notification from client to admin with roomId and message
   * @param roomId - Room ID
   * @param message - Notification message
   * @returns Promise<void>
   * @author QuangDoo
   */
  async sendNotificationToAdmin(roomId: string, message: string): Promise<{ message: string; timestamp: number }> {
    const notification = {
      message,
      timestamp: Date.now()
    }

    try {
      // Set Redis key with expiration (24 hours)
      const redisKey = `room_${roomId}_notification`
      await redis.setex(redisKey, 24 * 60 * 60, JSON.stringify(notification))

      // Emit event instead of using socket directly
      roomMusicEventEmitter.emit('admin_notification', { roomId, ...notification })

      return notification
    } catch (error) {
      console.error(`Error sending notification to room ${roomId}:`, error)
      throw new Error('Failed to send notification')
    }
  }

  /**
   * @description Solve request from client to admin with roomId and request
   * @param roomId - Room ID
   * @param request - Request message
   * @returns Promise<void>
   * @author QuangDoo
   */
  async solveRequest(roomId: string, request: string) {
    const notificationKey = `room_${roomId}_notification`
    const notification = await redis.get(notificationKey)
    if (!notification) {
      throw new Error('Notification not found')
    }
    // delete notification
    await redis.del(notificationKey)
  }
}

export const roomMusicServices = new RoomMusicServices()
