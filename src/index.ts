import cors from 'cors'
import express, { Express } from 'express'
import { createServer, Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

import { defaultErrorHandler } from '~/middlewares/error.middleware'
import fileRouter from '~/routes/file.routes'
import priceRouter from '~/routes/price.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import usersRouter from '~/routes/users.routes'
import roomTypeRouter from '~/routes/roomType.routes'
import databaseService from '~/services/database.services'
import { RoomSocket } from '~/sockets/room.socket'

// Kết nối CSDL
databaseService.connect()

// Tạo Express app
const app: Express = express()

// Danh sách các origin được phép
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://203.145.46.244:3000',
  'http://203.145.46.244:3001'
]

// Cấu hình CORS cho Express
app.use(
  cors({
    origin: (origin, callback) => {
      // Nếu không có origin (ví dụ: gọi từ server hoặc công cụ test) thì cho phép
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `Origin ${origin} không được phép truy cập.`
        return callback(new Error(msg), false)
      }
      return callback(null, true)
    },
    credentials: true
  })
)

// Parse JSON body
app.use(express.json())

// Định nghĩa các route
app.use('/users', usersRouter)
app.use('/room-types', roomTypeRouter)
app.use('/rooms', roomRouter)
app.use('/room-music', roomMusicRouter)
app.use('/price', priceRouter)
app.use('/file', fileRouter)
app.use(defaultErrorHandler)

// Tạo HTTP server dùng cho Express và Socket.IO
const httpServer: HttpServer = createServer(app)

// Cấu hình Socket.IO với cùng danh sách allowedOrigins
const io: SocketIOServer = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error(`Origin ${origin} không được phép`), false)
      }
      return callback(null, true)
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
})

// Khởi tạo logic Socket.IO (ví dụ: xử lý phòng chat)
RoomSocket(io)

// Khởi chạy server trên cổng mong muốn (ví dụ: port 4000)
const PORT = process.env.PORT || 4000
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server đang chạy trên port ${PORT}`)
})
