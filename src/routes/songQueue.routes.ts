import { Router } from 'express'
import ytdl from 'ytdl-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import {
  addSong,
  getSongsInQueue,
  playNextSong,
  removeAllSongsInQueue,
  removeSong
} from '~/controllers/songQueue.controller'
import { addSongValidator } from '~/middlewares/songQueue.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

const songQueueRouter = Router()
/**
 * @description Add song to queue
 * @path /song-queue/:roomId
 * @method POST
 * @body {videoId: string, title: string, thumbnail: string, channelTitle: string, position?: "top" | "end"} @type {AddSongRequestBody}
 * @author QuangDoo
 */
songQueueRouter.post('/:roomId', addSongValidator, wrapRequestHanlder(addSong)) // Thêm bài hát vào hàng đợi

/**
 * @description Remove song from queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @body {videoId: string} @type {AddSongRequestBody}
 * @author QuangDoo
 */
songQueueRouter.delete('/:roomId/:index', wrapRequestHanlder(removeSong)) // Xóa bài hát khỏi hàng đợi

/**
 * @description Remove all songs in queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @author QuangDoo
 */
songQueueRouter.delete('/:roomId', wrapRequestHanlder(removeAllSongsInQueue)) // Xóa tất cả bài hát trong hàng đợi

/**
 * @description Play next song
 * @path /song-queue/rooms/:roomId/play
 * @method POST
 * @author QuangDoo
 */
songQueueRouter.post('/:roomId/play', wrapRequestHanlder(playNextSong)) // Phát bài hát tiếp theo

/**
 * @description Get songs in queue
 * @path /song-queue/:roomId
 * @method GET
 * @author QuangDoo
 */
songQueueRouter.get('/:roomId', wrapRequestHanlder(getSongsInQueue)) // Lấy danh sách bài hát trong hàng đợi

/**
 * @description Get now playing song
 * @path /song-queue/:roomId/now-playing
 * @method GET
 * @author QuangDoo
 */
songQueueRouter.get('/song-info/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params
    // URL của video
    const url = `https://www.youtube.com/watch?v=${videoId}`

    // Lấy thông tin video
    const info = await ytdl.getInfo(url)

    // Trích xuất thông tin cần thiết
    const videoDetails = {
      title: info.videoDetails.title, // Tiêu đề video
      duration: parseInt(info.videoDetails.lengthSeconds, 10), // Thời lượng (giây)
      url: info.videoDetails.video_url, // URL của video
      thumbnails: info.videoDetails.thumbnails, // Danh sách thumbnail
      author: info.videoDetails.author.name // Tên kênh
    }

    console.log('Video Details:', videoDetails)
    res.status(HTTP_STATUS_CODE.OK).json({ videoDetails })
  } catch (error) {
    console.error('Error fetching video details:', error)
    next(error)
  }
}) // Lấy bài hát đang phát

export default songQueueRouter
