import { Router } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import {
  addSong,
  controlPlayback,
  getSongsInQueue,
  playNextSong,
  removeAllSongsInQueue,
  removeSong
} from '~/controllers/roomMusic.controller'
import { addSongValidator } from '~/middlewares/roomMusic.middleware'
import { roomMusicServices } from '~/services/roomMusic.service'
import { wrapRequestHanlder } from '~/utils/handlers'

const roomMusicRouter = Router()

/**
 * @description Add song to queue
 * @path /song-queue/:roomId
 * @method POST
 * @body {video_id: string, title: string, thumbnail: string, author: string, position?: "top" | "end"} @type {AddSongRequestBody}
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId', addSongValidator, wrapRequestHanlder(addSong)) // Thêm bài hát vào hàng đợi

/**
 * @description Remove song from queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @body {video_id: string} @type {AddSongRequestBody}
 * @author QuangDoo
 */
roomMusicRouter.delete('/:roomId/:index', wrapRequestHanlder(removeSong)) // Xóa bài hát khỏi hàng đợi

/**
 * @description Remove all songs in queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @author QuangDoo
 */
roomMusicRouter.delete('/:roomId', wrapRequestHanlder(removeAllSongsInQueue)) // Xóa tất cả bài hát trong hàng đợi

/**
 * @description Play next song
 * @path /song-queue/rooms/:roomId/play
 * @method POST
 * @author QuangDoo
 */
roomMusicRouter.post('/:roomId/play-next-song', wrapRequestHanlder(playNextSong)) // Phát bài hát tiếp theo

/**
 * @description Get songs in queue
 * @path /song-queue/:roomId
 * @method GET
 * @author QuangDoo
 */
roomMusicRouter.get('/:roomId', wrapRequestHanlder(getSongsInQueue)) // Lấy danh sách bài hát trong hàng đợi

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
roomMusicRouter.post('/:roomId/playback/:action', wrapRequestHanlder(controlPlayback)) // Điều khiển phát nhạc (play/pause)

export default roomMusicRouter
