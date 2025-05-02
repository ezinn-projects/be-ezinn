import { Router } from 'express'
import ytSearch from 'yt-search'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import {
  addSong,
  controlPlayback,
  getSongName,
  getSongsInQueue,
  getVideoInfo,
  playChosenSong,
  playNextSong,
  removeAllSongsInQueue,
  removeSong,
  sendNotification,
  streamVideo,
  updateQueue
} from '~/controllers/roomMusic.controller'
import { VideoSchema } from '~/models/schemas/Video.schema'
import { roomMusicServices } from '~/services/roomMusic.service'
import { getMediaUrls } from '~/services/video.service'
import { wrapRequestHandler } from '~/utils/handlers'

const roomMusicRouter = Router()

/**
 * @description Add song to queue
 * @path /song-queue/rooms/:roomId/queue
 * @method POST
 * @body {video_id: string, title: string, thumbnail: string, author: string, position?: "top" | "end"} @type {AddSongRequestBody}
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/queue', wrapRequestHandler(addSong)) // Thêm bài hát vào hàng đợi

/**
 * @description Remove song from queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @body {index: number} @type {{ index: number }}
 * @author QuangDoo
 */
roomMusicRouter.delete('/:roomId/queue/:index', wrapRequestHandler(removeSong)) // Xóa bài hát khỏi hàng đợi

/**
 * @description Remove all songs in queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @author QuangDoo
 */
roomMusicRouter.delete('/:roomId/queue', wrapRequestHandler(removeAllSongsInQueue)) // Xóa tất cả bài hát trong hàng đợi

/**
 * @description Control song playback
 * @path /song-queue/rooms/:roomId/playback/:action
 * @method POST
 * @params action: "play" | "pause"
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/playback/:action', wrapRequestHandler(controlPlayback)) // Điều khiển phát/dừng

/**
 * @description Play next song in queue
 * @path /song-queue/rooms/:roomId/play
 * @method POST
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/play-next-song', wrapRequestHandler(playNextSong)) // Phát bài hát tiếp theo

/**
 * @description Play chosen song at specific index
 * @path /room-music/:roomId/play-chosen-song
 * @method POST
 * @body {videoIndex: number}
 * @author [Your Name]
 */
roomMusicRouter.post('/:roomId/play-chosen-song', wrapRequestHandler(playChosenSong)) // Phát bài hát được chọn

/**
 * @description Get songs in queue
 * @path /song-queue/:roomId
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId', wrapRequestHandler(getSongsInQueue)) // Lấy danh sách bài hát trong hàng đợi

/**
 * @description Get now playing song
 * @path /song-queue/:roomId/now-playing
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId/now-playing', async (req, res, next) => {
  try {
    const { roomId } = req.params
    let nowPlaying = await roomMusicServices.getNowPlaying(roomId)

    res.status(HTTP_STATUS_CODE.OK).json({ result: nowPlaying })
  } catch (error) {
    console.error('Error fetching video details:', error)
    next(error)
  }
}) // Lấy bài hát đang phát

/**
 * @description search songs
 * @path /rooms/search-songs
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId/search-songs', async (req, res) => {
  const { q, limit = '50' } = req.query
  const parsedLimit = parseInt(limit as string, 10)

  // Validate search query
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid search query' })
  }

  // Validate limit parameter
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 50' })
  }

  try {
    // Tìm kiếm trên YouTube với từ khóa âm nhạc và ưu tiên nội dung Việt Nam
    const vietnameseKeywords = ['vpop', 'v-pop', 'việt nam', 'vietnamese']

    // Phân tích query để xác định xem có phải đang tìm kiếm nghệ sĩ hay không
    const queryWords = q
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1)

    // Thêm từ khóa phù hợp vào query để cải thiện kết quả tìm kiếm
    let searchQuery = `"${q}" music`

    // Tạo các tham số tìm kiếm
    const searchOptions = {
      region: 'VN',
      hl: 'vi', // Ngôn ngữ tiếng Việt
      pageStart: 1,
      pageEnd: 3 // Tăng số trang kết quả
    }

    const searchResults = await ytSearch({ query: searchQuery, ...searchOptions })

    // Xác định các video âm nhạc dựa trên phân tích nội dung
    const musicVideos = searchResults.videos.filter((video) => {
      // Kết hợp thông tin để phân tích
      const content = (video.title + ' ' + video.author.name + ' ' + (video.description || '')).toLowerCase()

      // Phân tích thời lượng (hầu hết bài hát có thời lượng từ 1-15 phút)
      const duration = video.duration.seconds
      const isValidDuration = duration >= 30 && duration <= 900
      if (!isValidDuration) return false

      // Phân tích nội dung dựa trên đặc điểm video âm nhạc
      // 1. Video có nhãn "Music" trong thể loại - bỏ qua vì không có thuộc tính category

      // 2. Phát hiện các chỉ báo âm nhạc trong nội dung
      const musicIndicators = [
        'music',
        'song',
        'audio',
        'lyrics',
        'karaoke',
        'sing',
        'vocal',
        'album',
        'nhạc',
        'bài hát',
        'ca khúc',
        'âm nhạc',
        'mv',
        'official',
        'concert',
        'live'
      ]
      const hasMusicIndicator = musicIndicators.some((indicator) => content.includes(indicator))

      // 3. Phát hiện các chỉ báo không liên quan đến âm nhạc
      const nonMusicIndicators = [
        'gameplay',
        'tutorial',
        'podcast',
        'news',
        'documentary',
        'talk show',
        'hướng dẫn',
        'tin tức',
        'chính trị',
        'thể thao',
        'football'
      ]
      const hasNonMusicIndicator = nonMusicIndicators.some((indicator) => content.includes(indicator))

      // Tính điểm phù hợp với nội dung âm nhạc (0-3)
      let musicScore = 0
      if (hasMusicIndicator) musicScore += 2
      if (!hasNonMusicIndicator) musicScore += 1

      // Quyết định dựa trên điểm số
      return musicScore >= 2
    })

    // Sắp xếp kết quả theo mức độ phù hợp với truy vấn
    musicVideos.sort((a, b) => {
      const aContent = (a.title + ' ' + a.author.name + ' ' + (a.description || '')).toLowerCase()
      const bContent = (b.title + ' ' + b.author.name + ' ' + (b.description || '')).toLowerCase()
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()

      // Đánh giá độ chính xác của truy vấn
      const queryLower = q.toLowerCase()

      // Ưu tiên 1: Tiêu đề chứa chính xác cụm từ tìm kiếm (không thay đổi thứ tự từ)
      const aExactPhraseMatch = aTitle.includes(queryLower)
      const bExactPhraseMatch = bTitle.includes(queryLower)

      if (aExactPhraseMatch && !bExactPhraseMatch) return -1
      if (!aExactPhraseMatch && bExactPhraseMatch) return 1

      // Ưu tiên 2: Tiêu đề bắt đầu bằng cụm từ tìm kiếm
      const aStartsWithQuery = aTitle.startsWith(queryLower)
      const bStartsWithQuery = bTitle.startsWith(queryLower)

      if (aStartsWithQuery && !bStartsWithQuery) return -1
      if (!aStartsWithQuery && bStartsWithQuery) return 1

      // Ưu tiên 3: Tìm kiếm từng từ riêng lẻ trong tiêu đề và đếm số từ khớp
      const queryWords = queryLower.split(/\s+/).filter((word) => word.length > 1)
      let aMatchCount = 0
      let bMatchCount = 0

      queryWords.forEach((word) => {
        if (aTitle.includes(word)) aMatchCount++
        if (bTitle.includes(word)) bMatchCount++
      })

      // Nếu số từ khớp khác nhau, ưu tiên video có nhiều từ khớp hơn
      if (aMatchCount !== bMatchCount) {
        return bMatchCount - aMatchCount
      }

      // Ưu tiên 4: Nội dung chứa đầy đủ cụm từ tìm kiếm
      const aContentMatch = aContent.includes(queryLower)
      const bContentMatch = bContent.includes(queryLower)

      if (aContentMatch && !bContentMatch) return -1
      if (!aContentMatch && bContentMatch) return 1

      // Ưu tiên 5: Độ dài tiêu đề gần với độ dài truy vấn hơn
      const aLengthDiff = Math.abs(aTitle.length - queryLower.length)
      const bLengthDiff = Math.abs(bTitle.length - queryLower.length)

      if (aLengthDiff < bLengthDiff) return -1
      if (aLengthDiff > bLengthDiff) return 1

      // Ưu tiên nội dung Việt Nam (nếu có)
      const aHasVietnameseIndicator = vietnameseKeywords.some((k) => aContent.includes(k))
      const bHasVietnameseIndicator = vietnameseKeywords.some((k) => bContent.includes(k))

      if (aHasVietnameseIndicator && !bHasVietnameseIndicator) return -1
      if (!aHasVietnameseIndicator && bHasVietnameseIndicator) return 1

      // Ưu tiên video có nhiều lượt xem hơn
      return (b.views || 0) - (a.views || 0)
    })

    // Loại bỏ các video trùng lặp (dựa trên ID)
    const uniqueVideos = Array.from(new Map(musicVideos.map((video) => [video.videoId, video])).values())

    // Trích xuất danh sách video
    const videos = uniqueVideos.slice(0, parsedLimit).map(
      (video) =>
        new VideoSchema({
          video_id: video.videoId,
          title: video.title,
          duration: video.duration.seconds,
          url: video.url,
          thumbnail: video.thumbnail || '',
          author: video.author.name
        })
    )

    return res.status(HTTP_STATUS_CODE.OK).json({ result: videos })
  } catch (error) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to search YouTube',
      message: (error as Error).message
    })
  }
})

/**
 * @description Get song name
 * @path /autocomplete
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId/autocomplete', wrapRequestHandler(getSongName))

/**
 * @description Get video info
 * @path /song-queue/rooms/:roomId/:videoId
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId/:videoId', wrapRequestHandler(getVideoInfo))

/**
 * @description Update queue
 * @path /song-queue/rooms/:roomId/queue
 * @method PUT
 * @author QuangDoo
 */
roomMusicRouter.put('/:roomId/queue', wrapRequestHandler(updateQueue))

/**
 * @description send notification to admin by room index
 * @path /song-queue/rooms/:roomId/send-notification
 * @method POST
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/send-notification', wrapRequestHandler(sendNotification))

/**
 * @description Stream video
 * @path /rooms/:roomId/:videoId/stream
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId/:videoId/stream', wrapRequestHandler(streamVideo))

// Hàm bỏ dấu tiếng Việt để so sánh
function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

roomMusicRouter.get('/:roomId/song-info/:videoId', async (req, res) => {
  try {
    const { roomId, videoId } = req.params

    if (!videoId) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        error: 'Video ID is required'
      })
    }

    console.log(`Requesting media URLs for video ID: ${videoId}`)
    const { audioUrl, videoUrl } = await getMediaUrls(videoId)

    res.status(HTTP_STATUS_CODE.OK).json({
      result: { roomId, videoId, audioUrl, videoUrl }
    })
  } catch (error) {
    // Ghi chi tiết lỗi để debug
    console.error('Error detail:', error)

    // Trả về thông tin lỗi cụ thể cho client
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to retrieve song information',
      detail: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default roomMusicRouter
