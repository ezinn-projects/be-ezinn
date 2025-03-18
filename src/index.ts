import cors from 'cors'
import express from 'express'
import { defaultErrorHandler } from '~/middlewares/error.middleware'
import fileRouter from '~/routes/file.routes'
import priceRouter from '~/routes/price.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import usersRouter from '~/routes/users.routes'
import databaseService from '~/services/database.service'
import serverService from '~/services/server.service'
import roomTypeRouter from '~/routes/roomType.routes'
import roomScheduleRouter from '~/routes/roomSchedule.routes'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { finishSchedulerInADay, startBookingScheduler } from '~/jobs/bookingScheduler'
import fnbOrderRouter from '~/routes/fnbOrder.route'
// Khởi tạo plugin
dayjs.extend(utc)
dayjs.extend(timezone)

databaseService.connect()
serverService.start()

export const app = express()

const port = 4000

app.use(cors())
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

app.use(defaultErrorHandler)

// Sau khi các route và middleware đã được cấu hình, khởi chạy scheduler
startBookingScheduler()

// Start auto finish all schedule in a day
finishSchedulerInADay()

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
