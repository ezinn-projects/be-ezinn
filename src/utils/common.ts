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

/**
 * Lọc các item có quantity = 0 khỏi order detail
 */
export function cleanOrderDetail(orderDetail: any) {
  // Lọc drinks/snacks object
  if (orderDetail.order && orderDetail.order.drinks) {
    orderDetail.order.drinks = Object.fromEntries(
      Object.entries(orderDetail.order.drinks).filter(([_, quantity]) => (quantity as number) > 0)
    )
  }
  if (orderDetail.order && orderDetail.order.snacks) {
    orderDetail.order.snacks = Object.fromEntries(
      Object.entries(orderDetail.order.snacks).filter(([_, quantity]) => (quantity as number) > 0)
    )
  }
  // Lọc drinks/snacks array
  if (orderDetail.items && orderDetail.items.drinks) {
    orderDetail.items.drinks = orderDetail.items.drinks.filter((item: any) => item.quantity > 0)
  }
  if (orderDetail.items && orderDetail.items.snacks) {
    orderDetail.items.snacks = orderDetail.items.snacks.filter((item: any) => item.quantity > 0)
  }
  return orderDetail
}

/**
 * Sinh mã booking 4 chữ số ngẫu nhiên (1000-9999)
 * Tránh các mã đặc biệt như 0000, 0123, v.v.
 * @returns string - mã booking 4 chữ số
 */
export function rand4(): string {
  // luôn 4 chữ số, tránh 0000, 0123, v.v. -> dùng 1000–9999
  return String(Math.floor(1000 + Math.random() * 9000))
}

/**
 * Sinh mã booking duy nhất với kiểm tra trùng lặp
 * @param checkDuplicate - hàm kiểm tra trùng lặp trong database
 * @returns Promise<string> - mã booking duy nhất
 */
export async function generateUniqueBookingCode(checkDuplicate: (code: string) => Promise<boolean>): Promise<string> {
  let attempts = 0
  const maxAttempts = 100 // Tránh vòng lặp vô hạn

  while (attempts < maxAttempts) {
    const code = rand4()
    const isDuplicate = await checkDuplicate(code)

    if (!isDuplicate) {
      return code
    }

    attempts++
  }

  // Nếu không tìm được mã duy nhất sau maxAttempts lần thử
  throw new Error('Không thể sinh mã booking duy nhất sau nhiều lần thử')
}
