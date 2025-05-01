import cors from 'cors'
import express from 'express'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

import databaseService from '~/services/database.service'
import serverService from '~/services/server.service'
import { defaultErrorHandler } from '~/middlewares/error.middleware'

import usersRouter from '~/routes/users.routes'
import roomTypeRouter from '~/routes/roomType.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import priceRouter from '~/routes/price.routes'
import fileRouter from '~/routes/file.routes'
import roomScheduleRouter from '~/routes/roomSchedule.routes'
import fnbOrderRouter from '~/routes/fnbOrder.route'
import billRouter from '~/routes/bill.routes'
import fnbMenuRouter from '~/routes/fnbMenu.routes'
import promotionRouter from '~/routes/promotion.routes'
import bookingRouter from '~/routes/booking.routes'
import holidayRouter from '~/routes/holiday.routes'

import { startScheduledJobs } from './jobs'
import { finishSchedulerInADay, startBookingScheduler } from '~/jobs/bookingScheduler'

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

// CORS: echo lại Origin, cho phép credentials, headers và methods cần thiết
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization']
}

// (Tuỳ chọn) Debug log Origin mỗi request
app.use((req, _, next) => {
  console.log('[CORS] Origin:', req.headers.origin)
  next()
})

// Load CORS middleware ngay đầu
app.use(cors(corsOptions))
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
app.use('/fnb-order', fnbOrderRouter)
app.use('/bill', billRouter)
app.use('/fnb-menu', fnbMenuRouter)
app.use('/promotions', promotionRouter)
app.use('/bookings', bookingRouter)
app.use('/holidays', holidayRouter)

// Error handler
app.use(defaultErrorHandler)

// Scheduler jobs
startBookingScheduler()
finishSchedulerInADay()

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
  startScheduledJobs()
})
