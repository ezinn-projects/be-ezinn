import cors from 'cors'
import express from 'express'
import { defaultErrorHandler } from '~/middlewares/error.middleware'
import houseRulesRouter from '~/routes/houseRules.routes'
import roomRouter from '~/routes/room.routes'
import roomTypeRouter from '~/routes/roomType.routes'
import songQueueRouter from '~/routes/songQueue.routes'
import usersRouter from '~/routes/users.routes'
import databaseService from '~/services/database.services'
import serverService from '~/services/server.services'

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

app.use('/song-queue', songQueueRouter)

app.use(defaultErrorHandler)

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})

// import youtubedl from 'youtube-dl-exec'
// import express from 'express'
// import cors from 'cors'

// const app = express()
// const port = 4000

// app.use(cors())
// app.use(express.json())

// app.get('/get_video_url', async (req, res) => {
//   const videoId = req.query.video_id

//   if (!videoId) {
//     return res.status(400).json({ error: 'Missing video_id' })
//   }

//   const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

//   try {
//     const output = await youtubedl(youtubeUrl, {
//       dumpSingleJson: true,
//       format: 'best[height<=1080][ext=mp4]' // Chọn chất lượng tốt nhất đến 1080p
//     })

//     const videoUrl = output.url
//     res.json({ url: videoUrl })
//   } catch (error) {
//     console.error(`Error fetching video URL: ${error.message}`)
//     res.status(500).json({ error: 'Failed to fetch video URL' })
//   }
// })

// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`)
// })
