import { Request, Response } from 'express'
import { NextFunction } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { SONG_QUEUE_MESSAGES } from '~/constants/messages'
import { AddSongRequestBody } from '~/models/requests/Song.request'
import serverService from '~/services/server.services'
import { songQueueServices } from '~/services/songQueue.service'

/**
 * @description Add song to queue
 * @path /song-queue/rooms/:roomId/queue
 * @method POST
 * @body {videoId: string, title: string, thumbnail: string, channelTitle: string, position?: "top" | "end"} @type {AddSongRequestBody}
 * @author QuangDoo
 */
export const addSong = async (
  req: Request<ParamsDictionary, any, AddSongRequestBody & { position?: 'top' | 'end' }>,
  res: Response,
  next: NextFunction
) => {
  const { roomId } = req.params
  const { videoId, title, thumbnail, channelTitle, position = 'end', duration } = req.body

  try {
    const updatedQueue = await songQueueServices.addSongToQueue(
      roomId,
      { videoId, title, thumbnail, channelTitle, duration },
      position
    )

    let nowPlaying = await songQueueServices.getNowPlaying(roomId)

    if (!nowPlaying && updatedQueue.length === 1) {
      nowPlaying = await songQueueServices.playNextSong(roomId)
    }

    res.status(HTTP_STATUS_CODE.CREATED).json({
      message: SONG_QUEUE_MESSAGES.ADD_SONG_TO_QUEUE_SUCCESS,
      result: {
        nowPlaying,
        queue: updatedQueue
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Remove song from queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @body {index: number} @type {{ index: number }}
 * @author QuangDoo
 */
export const removeSong = async (
  req: Request<ParamsDictionary, any, { index: string }>,
  res: Response,
  next: NextFunction
) => {
  const { roomId, index } = req.params

  try {
    const updatedQueue = await songQueueServices.removeSongFromQueue(roomId, Number(index))
    res.status(HTTP_STATUS_CODE.OK).json({
      message: SONG_QUEUE_MESSAGES.REMOVE_SONG_FROM_QUEUE_SUCCESS,
      result: {
        queue: updatedQueue
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Remove all songs in queue
 * @path /song-queue/rooms/:roomId/queue
 * @method DELETE
 * @author QuangDoo
 */
export const removeAllSongsInQueue = async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params
  try {
    await songQueueServices.removeAllSongsInQueue(roomId)
    res.status(HTTP_STATUS_CODE.OK).json({ message: SONG_QUEUE_MESSAGES.REMOVE_ALL_SONGS_IN_QUEUE_SUCCESS })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Play next song
 * @path /song-queue/rooms/:roomId/play
 * @method POST
 * @author QuangDoo
 */
export const playNextSong = async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params

  try {
    const nowPlaying = await songQueueServices.playNextSong(roomId)

    if (!nowPlaying) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: SONG_QUEUE_MESSAGES.NO_SONG_IN_QUEUE
      })
    }

    serverService.io.to(roomId).emit('play_song', nowPlaying)

    res.status(HTTP_STATUS_CODE.OK).json({
      message: SONG_QUEUE_MESSAGES.SONG_IS_NOW_PLAYING,
      result: {
        nowPlaying
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @description Get songs in queue
 * @path /song-queue/:roomId
 * @method GET
 * @author QuangDoo
 */
export const getSongsInQueue = async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params

  try {
    const queue = await songQueueServices.getSongsInQueue(roomId)
    const nowPlaying = await songQueueServices.getNowPlaying(roomId)

    res.status(HTTP_STATUS_CODE.OK).json({
      message: SONG_QUEUE_MESSAGES.GET_SONGS_IN_QUEUE_SUCCESS,
      result: {
        nowPlaying,
        queue
      }
    })
  } catch (error) {
    next(error)
  }
}
