import { Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { holidayService } from '~/services/holiday.service'
import { ErrorWithStatus } from '~/models/Error'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const addHoliday = async (req: Request, res: Response) => {
  try {
    const { date, name, description } = req.body

    if (!date || !name) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Date and name are required'
      })
    }

    // Validate date format
    if (!dayjs(date).isValid()) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid date format'
      })
    }

    const holiday = await holidayService.addHoliday({
      date: new Date(date),
      name,
      description
    })

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: 'Holiday added successfully',
      holiday
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error adding holiday',
      error: error.message
    })
  }
}

export const getHolidays = async (req: Request, res: Response) => {
  try {
    const holidays = await holidayService.getHolidays()
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get holidays successfully',
      holidays
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting holidays',
      error: error.message
    })
  }
}

export const updateHoliday = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { date, name, description } = req.body

    if (!date && !name && !description) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'At least one field (date, name, description) is required'
      })
    }

    // Validate date format if provided
    if (date && !dayjs(date).isValid()) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid date format'
      })
    }

    const updateData: any = {}
    if (date) updateData.date = new Date(date)
    if (name) updateData.name = name
    if (description) updateData.description = description

    const holiday = await holidayService.updateHoliday(id, updateData)

    if (!holiday) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'Holiday not found'
      })
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Holiday updated successfully',
      holiday
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error updating holiday',
      error: error.message
    })
  }
}

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const success = await holidayService.deleteHoliday(id)

    if (!success) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'Holiday not found'
      })
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Holiday deleted successfully'
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error deleting holiday',
      error: error.message
    })
  }
}
