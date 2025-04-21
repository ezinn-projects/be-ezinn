import multer from 'multer'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'

/**
 * Parses a date string and returns a Date object.
 * Throws an ErrorWithStatus with HTTP_STATUS_CODE.BAD_REQUEST if the date is invalid.
 *
 * @param dateStr - The date string to parse
 * @returns The parsed Date object
 */
export function parseDate(dateStr: string): Date {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new ErrorWithStatus({
      message: `Invalid date format: ${dateStr}`,
      status: HTTP_STATUS_CODE.BAD_REQUEST
    })
  }
  return date
}

/**
 * Multer middleware configuration for handling file uploads.
 * Uses memory storage to store files in memory as Buffer objects.
 */
export const upload = multer({ storage: multer.memoryStorage() })

import ytdl from 'youtube-dl-exec'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Hàm nội bộ dùng lại cho cả getVideoInfo & streamVideo */
export async function fetchVideoInfo(videoId: string) {
  const info = (await ytdl(`https://youtu.be/${videoId}`, {
    dumpSingleJson: true,
    forceIpv4: true,
    geoBypassCountry: 'VN',
    format: 'bestvideo+bestaudio/best',
    addHeader: [`User-Agent: ${UA}`, 'Referer: https://www.youtube.com/']
  })) as any

  const hlsFormat = info.formats.find(
    (f: any) => f.manifest_url && (f.manifest_url.includes('.m3u8') || f.protocol === 'hls')
  )

  if (!hlsFormat) {
    const playable = info.formats.find((f: any) => f.vcodec !== 'none' && f.acodec !== 'none')
    if (!playable) throw new Error('No streaming format found')

    return {
      video_id: videoId,
      title: info.title,
      duration: info.duration,
      url: playable.url,
      headers: playable.http_headers,
      thumbnail: info.thumbnail,
      author: info.uploader,
      format_type: 'progressive'
    }
  }

  return {
    video_id: videoId,
    title: info.title,
    duration: info.duration,
    url: hlsFormat.manifest_url || hlsFormat.url,
    headers: hlsFormat.http_headers,
    thumbnail: info.thumbnail,
    author: info.uploader,
    format_type: 'hls'
  }
}
