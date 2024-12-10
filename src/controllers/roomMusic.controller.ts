import { Request, Response } from 'express'
import { NextFunction } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { SONG_QUEUE_MESSAGES } from '~/constants/messages'
import { AddSongRequestBody } from '~/models/requests/Song.request'
import serverService from '~/services/server.services'
import { roomMusicServices } from '~/services/roomMusic.service'
import redis from '~/services/redis.service'

/**
 * @description Add song to queue
 * @path /song-queue/rooms/:roomId/queue
 * @method POST
 * @body {video_id: string, title: string, thumbnail: string, author: string, position?: "top" | "end"} @type {AddSongRequestBody}
 * @author QuangDoo
 */
export const addSong = async (
  req: Request<ParamsDictionary, any, AddSongRequestBody & { position?: 'top' | 'end' }>,
  res: Response,
  next: NextFunction
) => {
  const { roomId } = req.params
  const { video_id, title, thumbnail, author, position = 'end', duration } = req.body

  try {
    const updatedQueue = await roomMusicServices.addSongToQueue(
      roomId,
      { video_id, title, thumbnail, author, duration },
      position
    )

    let nowPlaying = await roomMusicServices.getNowPlaying(roomId)

    if (!nowPlaying) {
      const { nowPlaying, queue } = await roomMusicServices.playNextSong(roomId)
      return res.status(HTTP_STATUS_CODE.CREATED).json({
        message: SONG_QUEUE_MESSAGES.ADD_SONG_TO_QUEUE_SUCCESS,
        result: {
          nowPlaying,
          queue
        }
      })
    }

    res.status(HTTP_STATUS_CODE.CREATED).json({
      message: SONG_QUEUE_MESSAGES.ADD_SONG_TO_QUEUE_SUCCESS,
      result: {
        now_Playing: nowPlaying,
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
    const updatedQueue = await roomMusicServices.removeSongFromQueue(roomId, Number(index))
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
    await roomMusicServices.removeAllSongsInQueue(roomId)
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
    const { nowPlaying, queue } = await roomMusicServices.playNextSong(roomId)

    if (!nowPlaying) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: SONG_QUEUE_MESSAGES.NO_SONG_IN_QUEUE
      })
    }

    await redis.set(`room_${roomId}_playback`, 'play')

    // Emit socket event
    serverService.io.to(roomId).emit(`room_${roomId}_playback`, 'play')

    serverService.io.to(roomId).emit('play_song', nowPlaying)

    res.status(HTTP_STATUS_CODE.OK).json({
      message: SONG_QUEUE_MESSAGES.SONG_IS_NOW_PLAYING,
      result: {
        nowPlaying,
        queue
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
    const queue = await roomMusicServices.getSongsInQueue(roomId)
    const nowPlaying = await roomMusicServices.getNowPlaying(roomId)

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

/**
 * @description Control song playback (play/pause)
 * @path /song-queue/rooms/:roomId/playback/:action
 * @method POST
 * @params action: "play" | "pause"
 * @author QuangDoo
 */
export const controlPlayback = async (req: Request<ParamsDictionary, any>, res: Response, next: NextFunction) => {
  const { roomId, action } = req.params
  const { current_time } = req.body // Client gửi current_time kèm theo lệnh

  try {
    const nowPlaying = await roomMusicServices.getNowPlaying(roomId)

    if (!nowPlaying) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: SONG_QUEUE_MESSAGES.NO_SONG_IN_QUEUE
      })
    }

    if (action === 'pause') {
      // Cập nhật current_time vào Redis khi pause
      await redis.set(`room_${roomId}_current_time`, current_time)
    } else if (action === 'play') {
      // Tính timestamp mới khi phát lại
      const newTimestamp = Math.floor(Date.now() / 1000) - (current_time || 0)
      await redis.set(`room_${roomId}_timestamp`, newTimestamp)
    }

    // Lưu trạng thái playback
    await redis.set(`room_${roomId}_playback`, action)

    // Emit socket event
    serverService.io.to(roomId).emit(`room_${roomId}_playback`, { action, current_time })

    res.status(HTTP_STATUS_CODE.OK).json({
      message: action === 'play' ? SONG_QUEUE_MESSAGES.SONG_PLAYING : SONG_QUEUE_MESSAGES.SONG_PAUSED,
      result: { action, current_time }
    })
  } catch (error) {
    next(error)
  }
}
