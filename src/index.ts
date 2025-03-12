import cors from 'cors'
import express from 'express'
import { defaultErrorHandler } from '~/middlewares/error.middleware'
import fileRouter from '~/routes/file.routes'
import priceRouter from '~/routes/price.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import usersRouter from '~/routes/users.routes'
import databaseService from '~/services/database.services'
import serverService from '~/services/server.services'
import roomTypeRouter from '~/routes/roomType.routes'
import roomScheduleRouter from '~/routes/roomSchedule.routes'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { startBookingScheduler } from '~/jobs/bookingScheduler'
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

app.use(defaultErrorHandler)

// Sau khi các route và middleware đã được cấu hình, khởi chạy scheduler
startBookingScheduler()

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
