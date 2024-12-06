import express, { Express } from 'express'
import { createServer, Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { RoomSocket } from '~/sockets/room.socket'
import roomRoutes from '~/routes/room.routes'

class Server {
  private app: Express
  private httpServer: HttpServer
  private io: SocketIOServer
  private readonly PORT = process.env.PORT || 8080

  constructor() {
    this.app = express()
    this.httpServer = createServer(this.app)
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*' // Tùy chỉnh CORS theo nhu cầu
      }
    })

    this.initializeMiddleware()
    this.initializeRoutes()
    this.initializeWebSocket()
  }

  // Khởi tạo middleware
  private initializeMiddleware() {
    this.app.use(express.json())
  }

  // Khởi tạo routes
  private initializeRoutes() {
    this.app.use('/api/rooms', roomRoutes) // Thêm các routes cần thiết
  }

  // Khởi tạo WebSocket logic
  private initializeWebSocket() {
    RoomSocket(this.io)
  }

  // Chạy server
  public start() {
    this.httpServer.listen(this.PORT, () => {
      console.log(`Server is running on http://localhost:${this.PORT}`)
    })
  }
}

const serverService = new Server()
export default serverService
