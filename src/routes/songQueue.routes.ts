import { Router } from 'express'
import { addSong, playNextSong, removeSong } from '~/controllers/songQueue.controller'
import { addSongValidator } from '~/middlewares/songQueue.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

const songQueueRouter = Router()
/**
 * @description Add song to queue
 * @path /song-queue/rooms/:roomId/queue
 * @method POST
 * @body {videoId: string, title: string, thumbnail: string, channelTitle: string} @type {AddSongRequestBody}
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
songQueueRouter.delete('/:roomId', wrapRequestHanlder(removeSong)) // Xóa bài hát khỏi hàng đợi

/**
 * @description Play next song
 * @path /song-queue/rooms/:roomId/play
 * @method POST
 * @author QuangDoo
 */
songQueueRouter.post('/:roomId/play', wrapRequestHanlder(playNextSong)) // Phát bài hát tiếp theo

export default songQueueRouter
