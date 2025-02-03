import cors from 'cors'
import express from 'express'
import { defaultErrorHandler } from '~/middlewares/error.middleware'
import houseRulesRouter from '~/routes/houseRules.routes'
import roomRouter from '~/routes/room.routes'
import roomMusicRouter from '~/routes/roomMusic.routes'
import roomTypeRouter from '~/routes/roomType.routes'
import usersRouter from '~/routes/users.routes'
import databaseService from '~/services/database.services'
import serverService from '~/services/server.services'
import priceRouter from '~/routes/price.routes'
import fileRouter from '~/routes/file.routes'

databaseService.connect()
serverService.start()

export const app = express()

const port = 4000

app.use(cors())
// parse application/json sang object
app.use(express.json())

app.use('/users', usersRouter)

app.use('/house-rules', houseRulesRouter)

app.use('/room-types', roomTypeRouter)

app.use('/rooms', roomRouter)

app.use('/room-music', roomMusicRouter)

app.use('/price', priceRouter)

app.use('/file', fileRouter)

app.use(defaultErrorHandler)

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
