import cors from 'cors'
import type { CorsOptions } from 'cors'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import express from 'express'

import { defaultErrorHandler } from '~/middlewares/error.middleware'
import databaseService from '~/services/database.service'
import serverService from '~/services/server.service'

import billRouter from '~/routes/bill.routes'
import bookingRouter from '~/routes/booking.routes'
import clientFnbRouter from '~/routes/clientFnb.routes'
import fileRouter from '~/routes/file.routes'
import fnbMenuRouter from '~/routes/fnbMenu.routes'
import fnbMenuItemRouter from '~/routes/fnbMenuItem.routes'
import fnbOrderRouter from '~/routes/fnbOrder.routes'
import holidayRouter from '~/routes/holiday.routes'
import priceRouter from '~/routes/price.routes'
import printRouter from '~/routes/print.routes'
import promotionRouter from '~/routes/promotion.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import roomScheduleRouter from '~/routes/roomSchedule.routes'
import roomTypeRouter from '~/routes/roomType.routes'
import usersRouter from '~/routes/users.routes'

import { finishSchedulerInADay } from '~/jobs/bookingScheduler'

// Thiết lập timezone cho dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Ho_Chi_Minh')
console.log('Dayjs timezone:', dayjs().tz().format())

// Kết nối DB, start services
databaseService.connect()
serverService.start()

export const app = express()
const port = 4000

// Danh sách các origin được phép
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:5137',
  'https://video.jozo.com.vn',
  'https://control.jozo.com.vn',
  'https://jozo.com.vn',
  'https://admin.jozo.com.vn',
  'http://video.jozo.com.vn',
  'http://control.jozo.com.vn',
  'http://jozo.com.vn',
  'http://admin.jozo.com.vn'
]

// CORS: echo lại Origin, cho phép credentials, headers và methods cần thiết
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, false)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  exposedHeaders: ['Authorization', 'Content-Length', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}

// 1. Gắn cors lên đầu, trước mọi middleware khác
app.use(cors(corsOptions))
// 2. Cho phép preflight OPTIONS cho tất cả route
app.options('*', cors(corsOptions))

// Body parser
app.use(express.json())

// Các route
app.use('/users', usersRouter)
app.use('/room-types', roomTypeRouter)
app.use('/rooms', roomRouter)
app.use('/room-music', roomMusicRouter)
app.use('/price', priceRouter)
app.use('/file', fileRouter)
app.use('/room-schedule', roomScheduleRouter)
app.use('/fnb-orders', fnbOrderRouter)
app.use('/bill', billRouter)
app.use('/fnb-menu', fnbMenuRouter)
app.use('/promotions', promotionRouter)
app.use('/bookings', bookingRouter)
app.use('/holidays', holidayRouter)
app.use('/client/fnb', clientFnbRouter)
app.use('/print', printRouter)
app.use('/fnb-menu-item', fnbMenuItemRouter)

// Error handler
app.use(defaultErrorHandler)

// Scheduler jobs
// startBookingScheduler()
finishSchedulerInADay()

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
  // startScheduledJobs()
})
