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
