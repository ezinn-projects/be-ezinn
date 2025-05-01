import cors from 'cors'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import express from 'express'
import { finishSchedulerInADay, startBookingScheduler } from '~/jobs/bookingScheduler'
import { defaultErrorHandler } from '~/middlewares/error.middleware'
import billRouter from '~/routes/bill.routes'
import bookingRouter from '~/routes/booking.routes'
import fileRouter from '~/routes/file.routes'
import fnbMenuRouter from '~/routes/fnbMenu.routes'
import fnbOrderRouter from '~/routes/fnbOrder.route'
import priceRouter from '~/routes/price.routes'
import promotionRouter from '~/routes/promotion.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import roomScheduleRouter from '~/routes/roomSchedule.routes'
import roomTypeRouter from '~/routes/roomType.routes'
import usersRouter from '~/routes/users.routes'
import databaseService from '~/services/database.service'
import serverService from '~/services/server.service'
import { startScheduledJobs } from './jobs'
import holidayRouter from '~/routes/holiday.routes'
// Khởi tạo các plugins cho dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
// Thiết lập múi giờ mặc định cho Việt Nam
dayjs.tz.setDefault('Asia/Ho_Chi_Minh')
console.log('Dayjs configured with timezone:', dayjs().tz().format())

databaseService.connect()
serverService.start()

export const app = express()

const port = 4000

const allowedOrigins = [
  'https://admin.jozo.com.vn',
  'https://control.jozo.com.vn',
  'https://video.jozo.com.vn',
  'https://jozo.com.vn',
  'https://backend.jozo.com.vn',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
]

// Cấu hình CORS để chấp nhận mọi origin và các header cần thiết
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'development'
        ? function (origin, callback) {
            callback(null, true)
          }
        : allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
)
// Xử lý preflight requests
app.options(
  '*',
  cors({
    origin:
      process.env.NODE_ENV === 'development'
        ? function (origin, callback) {
            callback(null, true)
          }
        : allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization']
  })
)

// parse application/json sang object
app.use(express.json())

app.use('/users', usersRouter)

app.use('/room-types', roomTypeRouter)

app.use('/rooms', roomRouter)

app.use('/room-music', roomMusicRouter)

app.use('/price', priceRouter)

app.use('/file', fileRouter)

app.use('/room-schedule', roomScheduleRouter)

app.use('/fnb-order', fnbOrderRouter)

app.use('/bill', billRouter)

app.use('/fnb-menu', fnbMenuRouter)

app.use('/promotions', promotionRouter)

// Thêm route cho bookings API
app.use('/bookings', bookingRouter)

app.use('/holidays', holidayRouter)

app.use(defaultErrorHandler)

// Sau khi các route và middleware đã được cấu hình, khởi chạy scheduler
startBookingScheduler()

// Start auto finish all schedule in a day
finishSchedulerInADay()

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)

  // Start the scheduled jobs
  startScheduledJobs()
})
