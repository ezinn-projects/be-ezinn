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

    // Hàm trợ giúp phân tích query để xác định khả năng là tên nghệ sĩ
    const isLikelyArtistQuery = (query: string): boolean => {
      // 1. Kiểm tra các dấu hiệu như "ca sĩ", "singer", "artist" trong query
      const artistIndicators = [
        'ca si',
        'ca sĩ',
        'nghệ sĩ',
        'nghe si',
        'singer',
        'artist',
        'band',
        'rapper',
        'nhóm nhạc'
      ]
      if (artistIndicators.some((indicator) => removeAccents(query.toLowerCase()).includes(indicator))) {
        return true
      }

      // 2. Kiểm tra xem query có phải là cụm từ ngắn (thường tên nghệ sĩ là 2-4 từ)
      const wordCount = query.split(/\s+/).length
      if (wordCount >= 2 && wordCount <= 4) {
        return true
      }

      // 3. Kiểm tra một số đặc điểm phổ biến trong tên nghệ sĩ (viết hoa, ký hiệu đặc biệt)
      const hasSpecialFormat =
        /[A-Z]{2,}/.test(query) || // Chứa từ viết hoa
        /[._\-+&]/.test(query) // Chứa ký hiệu đặc biệt trong tên nhóm nhạc

      return hasSpecialFormat
    }

    // Xác định query có khả năng là nghệ sĩ không
    const isArtistQuery = isLikelyArtistQuery(q)

    // Kiểm tra xem query có chứa từ khóa liên quan đến Việt Nam không
    const hasVietnameseKeyword = vietnameseKeywords.some((keyword) => q.toLowerCase().includes(keyword.toLowerCase()))

    // Thêm từ khóa phù hợp vào query để cải thiện kết quả tìm kiếm
    let searchQuery = `${q} lyrics music audio`

    if (hasVietnameseKeyword) {
      searchQuery = `${q} vpop vietnamese lyrics music audio`
    } else if (isArtistQuery) {
      // Đối với query có khả năng là nghệ sĩ, sử dụng ít từ khóa thêm vào
      searchQuery = `${q} music`
    }

    // Thêm tham số region=VN để ưu tiên kết quả ở zone Việt Nam
    const searchOptions = {
      region: 'VN',
      hl: 'vi', // Ngôn ngữ tiếng Việt
      pageStart: 1,
      pageEnd: isArtistQuery ? 3 : 2 // Tăng số trang kết quả cho query nghệ sĩ
    }

    const searchResults = await ytSearch({ query: searchQuery, ...searchOptions })

    // Xác định nếu đây thực sự là nghệ sĩ dựa trên kết quả tìm kiếm
    // (nếu nhiều video có cùng tác giả khớp với từ khóa tìm kiếm)
    const authorFrequency: Record<string, number> = {}
    searchResults.videos.forEach((video) => {
      const authorName = video.author.name.toLowerCase()
      if (authorName.includes(q.toLowerCase()) || removeAccents(authorName).includes(removeAccents(q.toLowerCase()))) {
        authorFrequency[authorName] = (authorFrequency[authorName] || 0) + 1
      }
    })

    // Xác định xem có phải là nghệ sĩ phổ biến (nếu tên tác giả xuất hiện nhiều lần)
    const popularArtistThreshold = 3 // Ngưỡng để xác định nghệ sĩ phổ biến
    const isConfirmedArtist = Object.values(authorFrequency).some((count) => count >= popularArtistThreshold)

    // Kết hợp cả hai đánh giá để xác định xem đây có phải là nghệ sĩ nổi tiếng không
    const isFamousArtist = isArtistQuery || isConfirmedArtist

    // Lọc và chỉ giữ lại các video liên quan đến âm nhạc
    const musicVideos = searchResults.videos.filter((video) => {
      const lowerTitle = video.title.toLowerCase()
      const lowerAuthor = video.author.name.toLowerCase()
      const lowerDescription = (video.description || '').toLowerCase()

      // Các từ khóa thường xuất hiện trong video âm nhạc
      const musicKeywords = [
        'audio',
        'lyrics',
        'music',
        'mv',
        'official',
        'song',
        'nhạc',
        'bài hát',
        'karaoke',
        'vpop',
        'v-pop',
        'live',
        'performance'
      ]
      const nonMusicKeywords = ['podcast', 'talk show', 'news', 'tin tức', 'gameplay', 'tutorial', 'hướng dẫn']

      // Nếu là nghệ sĩ nổi tiếng, giảm yêu cầu về từ khóa
      if (isFamousArtist) {
        // Kiểm tra xem video này có phải của nghệ sĩ được tìm kiếm không
        const isArtistMatch =
          lowerAuthor.includes(q.toLowerCase()) || removeAccents(lowerAuthor).includes(removeAccents(q.toLowerCase()))

        // Hoặc tên nghệ sĩ xuất hiện trong tiêu đề
        const artistInTitle = queryWords.some(
          (word) => lowerTitle.includes(word) || removeAccents(lowerTitle).includes(removeAccents(word))
        )

        if (isArtistMatch || artistInTitle) {
          // Kiểm tra không có từ khóa không liên quan đến âm nhạc
          const hasNonMusicKeyword = nonMusicKeywords.some(
            (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
          )

          // Kiểm tra thời lượng video (mở rộng phạm vi thời lượng cho nghệ sĩ nổi tiếng)
          const duration = video.duration.seconds
          const isValidDuration = duration >= 30 && duration <= 900 // 30 giây đến 15 phút

          return !hasNonMusicKeyword && isValidDuration
        }
      }

      // Xử lý trường hợp thông thường (không phải nghệ sĩ hoặc không khớp trực tiếp)
      // Kiểm tra xem video có chứa các từ khóa âm nhạc không
      const hasMusicKeyword = musicKeywords.some(
        (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
      )

      // Kiểm tra xem video có chứa các từ khóa không liên quan đến âm nhạc không
      const hasNonMusicKeyword = nonMusicKeywords.some(
        (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
      )

      // Kiểm tra thời lượng video (hầu hết bài hát có thời lượng từ 1-10 phút)
      const duration = video.duration.seconds
      const isValidDuration = duration >= 60 && duration <= 600

      return hasMusicKeyword && !hasNonMusicKeyword && isValidDuration
    })

    // Sắp xếp kết quả: ưu tiên nội dung Việt Nam lên đầu
    musicVideos.sort((a, b) => {
      const aContent = (a.title + ' ' + a.author.name + ' ' + (a.description || '')).toLowerCase()
      const bContent = (b.title + ' ' + b.author.name + ' ' + (b.description || '')).toLowerCase()

      // Kiểm tra nội dung Việt Nam dựa trên các từ khóa
      const aHasVietnameseKeywords = vietnameseKeywords.some((keyword) => aContent.includes(keyword.toLowerCase()))
      const bHasVietnameseKeywords = vietnameseKeywords.some((keyword) => bContent.includes(keyword.toLowerCase()))

      // Kiểm tra nội dung Việt Nam dựa trên dấu tiếng Việt
      const aHasVietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
        aContent
      )
      const bHasVietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
        bContent
      )

      // Tính điểm ưu tiên cho nội dung Việt Nam
      const aVietnameseScore = (aHasVietnameseKeywords ? 2 : 0) + (aHasVietnameseDiacritics ? 1 : 0)
      const bVietnameseScore = (bHasVietnameseKeywords ? 2 : 0) + (bHasVietnameseDiacritics ? 1 : 0)

      // Ưu tiên nội dung Việt Nam lên đầu
      if (aVietnameseScore > bVietnameseScore) return -1
      if (aVietnameseScore < bVietnameseScore) return 1

      // Nếu query chứa chính xác từ khóa tìm kiếm, ưu tiên hơn
      const queryLower = q.toLowerCase()
      const aExactMatch = aContent.includes(queryLower)
      const bExactMatch = bContent.includes(queryLower)

      if (aExactMatch && !bExactMatch) return -1
      if (!aExactMatch && bExactMatch) return 1

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

export default roomMusicRouter
