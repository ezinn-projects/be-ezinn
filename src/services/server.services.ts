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
        origin: ['http://localhost:3000', 'http://203.145.46.244', 'http://203.145.46.244:3001'],
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
    this.app.use(
      cors({
        origin: ['http://localhost:3000', 'http://203.145.46.244', 'http://203.145.46.244:3001'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
        credentials: true
      })
    )

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
      res.header('Access-Control-Allow-Credentials', 'true')
      next()
    })

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
    this.httpServer.listen(Number(this.PORT), '0.0.0.0', () => {
      console.log(`Socket server is running on http://localhost:${this.PORT}`)
    })
  }
}

const serverService = new Server()
export default serverService
