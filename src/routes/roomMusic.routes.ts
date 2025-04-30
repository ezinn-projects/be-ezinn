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
  const { q, limit = '70' } = req.query
  const parsedLimit = parseInt(limit as string, 70)

  // Validate search query
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid search query' })
  }

  // Validate limit parameter
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 100' })
  }

  try {
    // Tìm kiếm trên YouTube với từ khóa âm nhạc và ưu tiên nội dung Việt Nam
    const vietnameseKeywords = ['vpop', 'v-pop', 'việt nam', 'vietnamese']

    // Kiểm tra xem query có chứa từ khóa liên quan đến Việt Nam không
    const hasVietnameseKeyword = vietnameseKeywords.some((keyword) => q.toLowerCase().includes(keyword.toLowerCase()))

    // Thêm từ khóa Việt Nam vào query để ưu tiên kết quả ở zone Việt Nam
    let searchQuery = `${q} lyrics music audio vietnam`
    if (hasVietnameseKeyword) {
      searchQuery = `${q} vpop vietnamese lyrics music audio`
    }

    // Thêm tham số region=VN để ưu tiên kết quả ở zone Việt Nam
    const searchOptions = {
      region: 'VN',
      hl: 'vi', // Ngôn ngữ tiếng Việt
      maxResults: 100 // Tăng số lượng kết quả tìm kiếm
    }

    const searchResults = await ytSearch({ query: searchQuery, ...searchOptions })

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
        'music video',
        'official music video',
        'official mv',
        'lyric video',
        'audio official',
        'audio lyrics',
        'audio vietsub',
        'vietsub lyrics',
        'vietsub + lyrics',
        'vietsub & lyrics',
        'vietsub',
        'lyrics vietsub',
        'lyrics + vietsub',
        'lyrics & vietsub',
        'audio vietsub lyrics',
        'audio + vietsub + lyrics',
        'audio & vietsub & lyrics',
        'audio vietsub & lyrics',
        'audio & vietsub lyrics',
        'audio + vietsub & lyrics',
        'audio & vietsub + lyrics',
        'audio + vietsub lyrics',
        'audio lyrics vietsub',
        'audio + lyrics + vietsub',
        'audio & lyrics & vietsub',
        'audio lyrics & vietsub',
        'audio & lyrics vietsub',
        'audio + lyrics & vietsub',
        'audio & lyrics + vietsub',
        'audio + lyrics vietsub',
        'vietsub audio lyrics',
        'vietsub + audio + lyrics',
        'vietsub & audio & lyrics',
        'vietsub audio & lyrics',
        'vietsub & audio lyrics',
        'vietsub + audio & lyrics',
        'vietsub & audio + lyrics',
        'vietsub + audio lyrics',
        'vietsub lyrics audio',
        'vietsub + lyrics + audio',
        'vietsub & lyrics & audio',
        'vietsub lyrics & audio',
        'vietsub & lyrics audio',
        'vietsub + lyrics & audio',
        'vietsub & lyrics + audio',
        'vietsub + lyrics audio',
        'lyrics audio vietsub',
        'lyrics + audio + vietsub',
        'lyrics & audio & vietsub',
        'lyrics audio & vietsub',
        'lyrics & audio vietsub',
        'lyrics + audio & vietsub',
        'lyrics & audio + vietsub',
        'lyrics + audio vietsub',
        'lyrics vietsub audio',
        'lyrics + vietsub + audio',
        'lyrics & vietsub & audio',
        'lyrics vietsub & audio',
        'lyrics & vietsub audio',
        'lyrics + vietsub & audio',
        'lyrics & vietsub + audio',
        'lyrics + vietsub audio'
      ]

      // Các từ khóa không liên quan đến âm nhạc
      const nonMusicKeywords = [
        'podcast',
        'talk show',
        'news',
        'tin tức',
        'gameplay',
        'tutorial',
        'hướng dẫn',
        'thủ tướng',
        'chính phủ',
        'bộ trưởng',
        'chủ tịch',
        'tổng thống',
        'phát biểu',
        'họp báo',
        'hội nghị',
        'hội thảo',
        'diễn đàn',
        'thảo luận',
        'phỏng vấn',
        'interview',
        'press conference',
        'speech',
        'address',
        'statement',
        'announcement',
        'thông báo',
        'công bố',
        'tuyên bố',
        'phát biểu',
        'họp báo',
        'hội nghị',
        'hội thảo',
        'diễn đàn',
        'thảo luận',
        'phỏng vấn',
        'interview',
        'press conference',
        'speech',
        'address',
        'statement',
        'announcement',
        'thông báo',
        'công bố',
        'tuyên bố',
        'thủ tướng',
        'chính phủ',
        'bộ trưởng',
        'chủ tịch',
        'tổng thống',
        'phát biểu',
        'họp báo',
        'hội nghị',
        'hội thảo',
        'diễn đàn',
        'thảo luận',
        'phỏng vấn',
        'interview',
        'press conference',
        'speech',
        'address',
        'statement',
        'announcement',
        'thông báo',
        'công bố',
        'tuyên bố'
      ]

      // Kiểm tra xem video có chứa các từ khóa âm nhạc không
      const hasMusicKeyword = musicKeywords.some(
        (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
      )

      // Kiểm tra xem video có chứa các từ khóa không liên quan đến âm nhạc không
      const hasNonMusicKeyword = nonMusicKeywords.some(
        (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
      )

      // Kiểm tra thời lượng video (mở rộng khoảng thời gian từ 1-15 phút)
      const duration = video.duration.seconds
      const isValidDuration = duration >= 60 && duration <= 900

      // Nếu có từ khóa âm nhạc và không có từ khóa không liên quan, cho phép thời lượng dài hơn
      if (hasMusicKeyword && !hasNonMusicKeyword) {
        return true
      }

      // Nếu không thỏa điều kiện trên, kiểm tra thời lượng
      return isValidDuration
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

      return 0
    })

    // Trích xuất danh sách video
    const videos = musicVideos.slice(0, parsedLimit).map(
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

export default roomMusicRouter
