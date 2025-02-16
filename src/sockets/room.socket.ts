import { Server, Socket } from 'socket.io'
import redis from '~/services/redis.service'
import { roomMusicServices } from '~/services/roomMusic.service'

interface CommandPayload {
  action: string
  data?: any
}

interface VideoEventPayload {
  event: 'play' | 'pause' | 'seek'
  videoId: string
  currentTime: number
}

export const RoomSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id)

    // Lấy thông tin roomId từ query
    const roomId = socket.handshake.query.roomId as string
    console.log('roomId:', roomId)
    if (roomId) {
      socket.join(roomId) // Gán socket vào room
      console.log(`Socket ${socket.id} joined room ${roomId}`)
    }

    // Xử lý lệnh từ client
    socket.on('command', (payload: CommandPayload) => {
      console.log(`Received command in room ${roomId}:`, payload)

      // Phát lệnh đến các client khác trong room
      io.to(roomId).emit('command', payload)
    })

    // Xử lý video_event (play, pause, seek)
    socket.on('video_event', async (payload: VideoEventPayload) => {
      console.log(`Received video_event in room ${roomId}:`, payload)

      try {
        // Lưu trạng thái video vào Redis
        await redis.set(
          `room_${roomId}_now_playing`,
          JSON.stringify({
            videoId: payload.videoId,
            event: payload.event,
            currentTime: payload.currentTime,
            timestamp: Date.now()
          })
        )

        // Phát lại sự kiện video cho các client khác
        socket.to(roomId).emit('video_event', payload)
      } catch (error) {
        console.error(`Failed to save video state for room ${roomId}:`, error)
        socket.emit('error', { message: 'Failed to save video state', error })
      }
    })

    socket.on('video_ready', (payload: { roomId: string; videoId: string }) => {
      console.log(`Video ready for room ${payload.roomId}:`, payload.videoId)

      // Phát sự kiện play cho tất cả client trong room
      io.to(payload.roomId).emit('playback_event', {
        event: 'play',
        videoId: payload.videoId,
        currentTime: 0 // Bắt đầu từ đầu
      })

      // Lưu trạng thái vào Redis (nếu cần)
      redis.set(
        `room_${payload.roomId}_playback`,
        JSON.stringify({
          videoId: payload.videoId,
          event: 'play',
          currentTime: 0,
          timestamp: Date.now()
        })
      )
    })

    // Phục hồi trạng thái video khi client reconnect
    socket.on('get_video_state', async () => {
      try {
        const videoState = await redis.get(`room_${roomId}_now_playing`)
        if (videoState) {
          socket.emit('video_event', JSON.parse(videoState))
        }
      } catch (error) {
        console.error(`Failed to get video state for room ${roomId}:`, error)
        socket.emit('error', { message: 'Failed to get video state', error })
      }
    })

    // Xử lý play_song (ví dụ: bắt đầu bài hát mới)
    socket.on('play_song', async (payload: { videoId: string }) => {
      try {
        console.log(`Play song request in room ${roomId}:`, payload)

        // Lưu trạng thái video mới vào Redis
        await redis.set(
          `room_${roomId}_now_playing`,
          JSON.stringify({
            videoId: payload.videoId,
            event: 'play',
            currentTime: 0,
            timestamp: Date.now()
          })
        )

        // Phát sự kiện play_song tới tất cả client trong room
        io.to(roomId).emit('play_song', { videoId: payload.videoId })
      } catch (error) {
        console.error(`Failed to process play_song for room ${roomId}:`, error)
        socket.emit('error', { message: 'Failed to play song', error })
      }
    })

    // Xử lý đồng bộ hàng đợi
    socket.on('synchronize_queue', (payload: { queue: any[] }) => {
      console.log(`Synchronizing queue in room ${roomId}:`, payload)

      // Phát sự kiện đồng bộ tới tất cả các client trong room
      io.to(roomId).emit('synchronize_queue', payload)
    })

    // Trong file xử lý socket của Backend
    socket.on('get_now_playing', async ({ roomId }) => {
      const nowPlaying = await roomMusicServices.getNowPlaying(roomId)
      socket.emit('now_playing', nowPlaying)
    })

    socket.on('next_song', async ({ roomId }) => {
      try {
        // Broadcast sự kiện này đến tất cả clients trong cùng room
        io.to(roomId).emit('next_song')

        // Hoặc nếu bạn muốn xử lý logic thêm ở server
        const nowPlaying = await roomMusicServices.getNowPlaying(roomId)
        io.to(roomId).emit('now_playing', nowPlaying)
      } catch (error) {
        console.error('Error handling next song:', error)
      }
    })

    // Khi client ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })
}
