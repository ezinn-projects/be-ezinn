import cors from 'cors'
import express, { Express } from 'express'
import { createServer, Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import roomRoutes from '~/routes/room.routes'
import { RoomSocket } from '~/sockets/room.socket'

class Server {
  private app: Express
  private httpServer: HttpServer
  public io: SocketIOServer
  private readonly PORT = process.env.SOCKET_SERVER_PORT || 8080

  constructor() {
    this.app = express()
    this.httpServer = createServer(this.app)
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: [
          'https://admin.jozo.com.vn',
          'https://control.jozo.com.vn',
          'https://video.jozo.com.vn',
          'https://jozo.com.vn',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:5173',
          'http://localhost:5174'
        ],
        credentials: true
      },
      allowEIO3: true,
      transports: ['websocket', 'polling']
    })

    this.initializeMiddleware()
    this.initializeRoutes()
    this.initializeWebSocket()
  }

  // Khởi tạo middleware
  private initializeMiddleware() {
    this.app.use(
      cors({
        origin: [
          'https://admin.jozo.com.vn',
          'https://control.jozo.com.vn',
          'https://video.jozo.com.vn',
          'https://jozo.com.vn',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:5173',
          'http://localhost:5174'
        ],
        credentials: true
      })
    )
    this.app.use(express.json())
  }

  // Khởi tạo routes
  private initializeRoutes() {
    this.app.use('/api/rooms', roomRoutes)
    // this.app.use('/api/song-queue', songQueueRouter)
  }

  // Khởi tạo WebSocket logic
  private initializeWebSocket() {
    RoomSocket(this.io)
  }

  // Chạy server
  public start() {
    this.httpServer.listen(this.PORT, () => {
      console.log(`Socket server is running on http://localhost:${this.PORT}`)
    })
  }
}

const serverService = new Server()
export default serverService
