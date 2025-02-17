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
        origin: (origin, callback) => {
          const allowedOrigins = ['http://localhost:3000', 'http://203.145.46.244', 'http://203.145.46.244:3001']
          // Nếu không có origin (ví dụ từ các công cụ hay server-side) hoặc origin có trong danh sách cho phép
          if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
          }
          return callback(new Error('Origin not allowed: ' + origin))
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
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
    // Sử dụng middleware của cors để tự động xử lý preflight và thiết lập header cho đúng
    this.app.use(
      cors({
        origin: ['http://localhost:3000', 'http://203.145.46.244', 'http://203.145.46.244:3001'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
        credentials: true
      })
    )

    // Không cần thiết lập header thủ công nữa
    this.app.use(express.json())
  }

  // Khởi tạo routes
  private initializeRoutes() {
    this.app.use('/api/rooms', roomRoutes)
    // Các route khác nếu có
  }

  // Khởi tạo WebSocket logic
  private initializeWebSocket() {
    RoomSocket(this.io)
  }

  // Chạy server
  public start() {
    this.httpServer.listen(Number(this.PORT), '0.0.0.0', () => {
      console.log(`Socket server is running on port ${this.PORT}`)
    })
  }
}

const serverService = new Server()
export default serverService
