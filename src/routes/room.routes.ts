import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import { addRoomController } from '~/controllers/room.controller'
import { protect } from '~/middlewares/auth.middleware'
import { addRoomValidator, checkRoomExists } from '~/middlewares/room.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'
import ytSearch from 'yt-search'
import { VideoSchema } from '~/models/schemas/Video.schema'

const roomRouter = Router()

/**
 * @description Add room
 * @path /rooms/add-room
 * @method POST
 * @body {roomId: string, roomName: string, roomType: string, maxCapacity: number, status: string, pricePerTime: {startTime: string, endTime: string, price: number}[], equipment: {name: string, quantity: number}[], description: string, images: string[]} @type {IAddRoomRequestBody}
 * @author QuangDoo
 */
roomRouter.post(
  '/add-room',
  protect([UserRole.Admin]), // Kiểm tra quyền trước
  addRoomValidator, // Kiểm tra dữ liệu từ request
  checkRoomExists, // Kiểm tra trùng lặp trong DB
  wrapRequestHanlder(addRoomController) // Xử lý logic tạo phòng
)

/**
 * @description search songs
 * @path /rooms/search-songs
 * @method GET
 * @author QuangDoo
 */
roomRouter.get('/search-songs', async (req, res) => {
  const { q, limit = 50 } = req.query

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter: q' })
  }

  try {
    // Tìm kiếm trên YouTube
    const searchResults = await ytSearch(q as string)

    // Trích xuất danh sách video
    const videos = searchResults.videos.slice(0, Number(limit)).map(
      (video) =>
        new VideoSchema({
          video_id: video.videoId,
          title: video.title,
          duration: video.duration.seconds, // Thời lượng (giây)
          url: video.url,
          thumbnail: video.thumbnail || '',
          author: video.author.name // Tên kênh
        })
    )

    res.json({ result: videos })
  } catch (error) {
    console.error('Error searching YouTube:', error)
    res.status(500).json({ error: 'Failed to search YouTube' })
  }
})
export default roomRouter
