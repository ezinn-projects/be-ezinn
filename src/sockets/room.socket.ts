import { Server, Socket } from 'socket.io'

interface CommandPayload {
  action: string
  data?: any
}

export const RoomSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id)

    // Lấy thông tin roomId từ query
    const roomId = socket.handshake.query.roomId as string
    if (roomId) {
      socket.join(roomId) // Gán socket vào room
      console.log(`Socket ${socket.id} joined room ${roomId}`)
    }

    // Xử lý các lệnh từ client
    socket.on('command', (payload: CommandPayload) => {
      console.log(`Received command in room ${roomId}:`, payload)

      // Phát lệnh đến các client khác trong room
      io.to(roomId).emit('command', payload)
    })

    // Khi client ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })
}
