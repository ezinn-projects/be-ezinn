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
import billRouter from '~/routes/bill.routes'
import fnbMenuRouter from './routes/fnbMenu.routes'
import promotionRouter from './routes/promotion.routes'
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

app.use('/bill', billRouter)

app.use('/fnb-menu', fnbMenuRouter)

app.use('/promotions', promotionRouter)

app.use(defaultErrorHandler)

// Sau khi các route và middleware đã được cấu hình, khởi chạy scheduler
startBookingScheduler()

// Start auto finish all schedule in a day
finishSchedulerInADay()

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
