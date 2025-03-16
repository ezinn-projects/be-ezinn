import { Router } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import {
  addSong,
  controlPlayback,
  getSongName,
  getSongsInQueue,
  getVideoInfo,
  playNextSong,
  removeAllSongsInQueue,
  removeSong,
  updateQueue
} from '~/controllers/roomMusic.controller'
import { addSongValidator } from '~/middlewares/roomMusic.middleware'
import { VideoSchema } from '~/models/schemas/Video.schema'
import { roomMusicServices } from '~/services/roomMusic.service'
import { wrapRequestHandler } from '~/utils/handlers'
import ytSearch from 'yt-search'

const roomMusicRouter = Router()

/**
 * @description Add song to queue
 * @path /song-queue/:roomId
 * @method POST
 * @body {video_id: string, title: string, thumbnail: string, author: string, position?: "top" | "end"} @type {AddSongRequestBody}
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId', addSongValidator, wrapRequestHandler(addSong)) // Thêm bài hát vào hàng đợi

/**
 * @description Remove song from queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @body {video_id: string} @type {AddSongRequestBody}
 * @author QuangDoo
 */
roomMusicRouter.delete('/:roomId/:index', wrapRequestHandler(removeSong)) // Xóa bài hát khỏi hàng đợi

/**
 * @description Remove all songs in queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @author QuangDoo
 */
roomMusicRouter.delete('/:roomId', wrapRequestHandler(removeAllSongsInQueue)) // Xóa tất cả bài hát trong hàng đợi

/**
 * @description Play next song
 * @path /song-queue/rooms/:roomId/play
 * @method POST
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/play-next-song', wrapRequestHandler(playNextSong)) // Phát bài hát tiếp theo

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
 * @description Control song playback (play/pause)
 * @path /song-queue/rooms/:roomId/playback/:action
 * @method POST
 * @params action: "play" | "pause"
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/playback/:action', wrapRequestHandler(controlPlayback)) // Điều khiển phát nhạc (play/pause)

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
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 100' })
  }

  try {
    // Tìm kiếm trên YouTube với từ khóa âm nhạc
    const searchQuery = `${q} lyrics music audio`
    const searchResults = await ytSearch(searchQuery)

    // Lọc và chỉ giữ lại các video liên quan đến âm nhạc
    const musicVideos = searchResults.videos.filter((video) => {
      const lowerTitle = video.title.toLowerCase()
      const lowerAuthor = video.author.name.toLowerCase()
      const lowerDescription = (video.description || '').toLowerCase()

      // Các từ khóa thường xuất hiện trong video âm nhạc
      const musicKeywords = ['audio', 'lyrics', 'music', 'mv', 'official', 'song', 'nhạc', 'bài hát', 'karaoke']
      const nonMusicKeywords = ['podcast', 'talk show', 'news', 'tin tức', 'gameplay', 'tutorial', 'hướng dẫn']

      // Kiểm tra xem video có chứa các từ khóa âm nhạc không
      const hasMusicKeyword = musicKeywords.some(
        (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
      )

      // Kiểm tra xem video có chứa các từ khóa không liên quan đến âm nhạc không
      const hasNonMusicKeyword = nonMusicKeywords.some(
        (keyword) => lowerTitle.includes(keyword) || lowerDescription.includes(keyword)
      )

      // Kiểm tra thời lượng video (hầu hết bài hát có thời lượng từ 2-10 phút)
      const duration = video.duration.seconds
      const isValidDuration = duration >= 60 && duration <= 600

      return hasMusicKeyword && !hasNonMusicKeyword && isValidDuration
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

export default roomMusicRouter
