import { Server, Socket } from 'socket.io'
import redis from '~/services/redis.service'

interface CommandPayload {
  action: string
  data?: any
}

export const RoomSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id)

    // Lấy thông tin roomId từ query
    const roomId = socket.handshake.query.roomId as string
    console.log('roomId :>> ', roomId)
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

    // Xử lý sự kiện play_song
    socket.on('play_song', async (payload: { videoId: string }) => {
      try {
        console.log(`Play song request in room ${roomId}:`, payload)

        // Lấy URL video qua videoId
        const song = await redis.get(`room_${roomId}_now_playing`)

        // Phát sự kiện play_song kèm URL tới các client trong room
        // io.to(roomId).emit('play_song', { url: song?.url })

        // console.log(`Sent play_song event to room ${roomId} with URL: ${song?.url}`)
      } catch (error) {
        console.error(`Failed to process play_song event for room ${roomId}:`, error)
        socket.emit('error', { message: 'Failed to play song', error })
      }
    })

    // Đồng bộ hàng đợi
    socket.on('synchronize_queue', (payload: { queue: any[] }) => {
      console.log(`Synchronizing queue in room ${roomId}:`, payload)

      // Phát sự kiện đồng bộ tới tất cả các client trong room
      io.to(roomId).emit('synchronize_queue', payload)
    })

    // Khi client ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })
}
