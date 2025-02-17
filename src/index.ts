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

databaseService.connect()
serverService.start()

export const app = express()

const port = 4000

app.use(
  cors({
    origin: '*',
    credentials: true
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

app.use(defaultErrorHandler)

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
