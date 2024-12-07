import { Request, Response } from 'express'
// import { addSongToQueue, removeSongFromQueue } from '~/services/songQueue.service'
import { type ParamsDictionary } from 'express-serve-static-core'
import { AddSongRequestBody } from '~/models/requests/Song.request'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { NextFunction } from 'express'
import { SONG_QUEUE_MESSAGES } from '~/constants/messages'
import { songQueueServices } from '~/services/songQueue.service'
import { playNextSong } from '~/utils/songUtil'

/**
 * @description Add song to queue
 * @path /song-queue/rooms/:roomId/queue
 * @method POST
 * @body {videoId: string, title: string, thumbnail: string, channelTitle: string} @type {AddSongRequestBody}
 * @author QuangDoo
 */
export const addSong = async (
  req: Request<ParamsDictionary, any, AddSongRequestBody>,
  res: Response,
  next: NextFunction
) => {
  const { roomId } = req.params
  const { videoId, title, thumbnail, channelTitle } = req.body

  try {
    const updatedQueue = await songQueueServices.addSongToQueue(roomId, { videoId, title, thumbnail, channelTitle })

    // Nếu hàng đợi chỉ có 1 bài hát, tự động phát bài hát đó
    if (updatedQueue.length === 1) {
      const nowPlaying = await playNextSong(roomId)
      return res.status(201).json({ message: 'Song added and playing', nowPlaying })
    }

    res
      .status(HTTP_STATUS_CODE.CREATED)
      .json({ message: SONG_QUEUE_MESSAGES.ADD_SONG_TO_QUEUE_SUCCESS, result: updatedQueue })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Remove song from queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @body {videoId: string} @type {AddSongRequestBody}
 * @author QuangDoo
 */
export const removeSong = async (
  req: Request<ParamsDictionary, any, AddSongRequestBody>,
  res: Response,
  next: NextFunction
) => {
  const { roomId } = req.params
  const { videoId } = req.body

  try {
    const updatedQueue = await songQueueServices.removeSongFromQueue(roomId, videoId)
    res
      .status(HTTP_STATUS_CODE.OK)
      .json({ message: SONG_QUEUE_MESSAGES.REMOVE_SONG_FROM_QUEUE_SUCCESS, result: updatedQueue })
  } catch (error) {
    next(error)
  }
}
