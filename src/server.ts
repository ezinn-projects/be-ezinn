import { createServer } from 'http'
import { Server } from 'socket.io'
import { RoomSocket } from '~/sockets/room.socket'
import { app } from './index'

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*' // Cho phép CORS (tuỳ chỉnh theo yêu cầu)
  }
})

console.log('io', io)

// Tích hợp logic room vào WebSocket server
RoomSocket(io)

// Khởi động server
const PORT = 8080
httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
