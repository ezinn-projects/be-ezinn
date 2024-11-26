import cors from 'cors'
import express from 'express'
import usersRouter from '~/routes/users.routes'
import databaseService from '~/services/database.services'
import { defaultErrorHandler } from './middlewares/error.middleware'
import houseRulesRouter from './routes/houseRules.routes'
import roomTypeRouter from './routes/roomType.routes'
import roomRouter from './routes/room.routes'

databaseService.connect()

export const app = express()

const port = 4000

app.use(cors())
// parse application/json sang object
app.use(express.json())

app.use('/users', usersRouter)

app.use('/house-rules', houseRulesRouter)

app.use('/room-types', roomTypeRouter)

app.use('/rooms', roomRouter)

app.use(defaultErrorHandler)

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})
