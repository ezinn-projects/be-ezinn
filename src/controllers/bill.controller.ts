import { Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import billService from '~/services/bill.service'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import weekday from 'dayjs/plugin/weekday'

// Extend dayjs with the required plugins
dayjs.extend(weekOfYear)
dayjs.extend(weekday)

export const getBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime } = req.query

  const bill = await billService.getBill(scheduleId, actualEndTime as string)
  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get bill successfully',
    result: bill
  })
}

export const printBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, paymentMethod } = req.body

  const billData = await billService.getBill(scheduleId, actualEndTime as string, paymentMethod)

  const bill = await billService.printBill(billData)

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Print bill successfully',
    result: bill
  })
}

/**
 * Get total revenue for a specific date
 * @param req Request object containing date in query params
 * @param res Response object
 * @returns Total revenue and bill details for the specified date
 */
export const getDailyRevenue = async (req: Request, res: Response) => {
  const { date } = req.query

  if (!date) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Date parameter is required (ISO date string format)'
    })
  }

  try {
    // Validate date format
    if (!dayjs(date as string).isValid()) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid date format. Please use ISO date string format'
      })
    }

    const revenueData = await billService.getDailyRevenue(date as string)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get daily revenue successfully',
      result: {
        date: date,
        formattedDate: dayjs(date as string).format('DD/MM/YYYY'),
        totalRevenue: revenueData.totalRevenue,
        billCount: revenueData.bills.length,
        bills: revenueData.bills
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting daily revenue',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Get total revenue for a specific week
 * @param req Request object containing date in query params
 * @param res Response object
 * @returns Total revenue and bill details for the specified week
 */
export const getWeeklyRevenue = async (req: Request, res: Response) => {
  const { date } = req.query

  if (!date) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Date parameter is required (ISO date string format)'
    })
  }

  try {
    // Validate date format
    if (!dayjs(date as string).isValid()) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid date format. Please use ISO date string format'
      })
    }

    const revenueData = await billService.getWeeklyRevenue(date as string)
    const startDateFormatted = dayjs(revenueData.startDate).format('DD/MM/YYYY')
    const endDateFormatted = dayjs(revenueData.endDate).format('DD/MM/YYYY')
    const weekNumber = dayjs(date as string).week()
    const year = dayjs(date as string).year()

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get weekly revenue successfully',
      result: {
        week: weekNumber,
        year: year,
        dateRange: `${startDateFormatted} - ${endDateFormatted}`,
        startDate: revenueData.startDate,
        endDate: revenueData.endDate,
        totalRevenue: revenueData.totalRevenue,
        billCount: revenueData.bills.length,
        bills: revenueData.bills
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting weekly revenue',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Get total revenue for a specific month
 * @param req Request object containing date in query params
 * @param res Response object
 * @returns Total revenue and bill details for the specified month
 */
export const getMonthlyRevenue = async (req: Request, res: Response) => {
  const { date } = req.query

  if (!date) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Date parameter is required (ISO date string format)'
    })
  }

  try {
    // Validate date format
    if (!dayjs(date as string).isValid()) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid date format. Please use ISO date string format'
      })
    }

    const revenueData = await billService.getMonthlyRevenue(date as string)
    const monthName = dayjs(date as string).format('MMMM')
    const year = dayjs(date as string).year()
    const startDateFormatted = dayjs(revenueData.startDate).format('DD/MM/YYYY')
    const endDateFormatted = dayjs(revenueData.endDate).format('DD/MM/YYYY')

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get monthly revenue successfully',
      result: {
        month: monthName,
        year: year,
        dateRange: `${startDateFormatted} - ${endDateFormatted}`,
        startDate: revenueData.startDate,
        endDate: revenueData.endDate,
        totalRevenue: revenueData.totalRevenue,
        billCount: revenueData.bills.length,
        bills: revenueData.bills
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting monthly revenue',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Get total revenue for a custom date range
 * @param req Request object containing startDate and endDate in query params
 * @param res Response object
 * @returns Total revenue and bill details for the specified date range
 */
export const getCustomRangeRevenue = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query

  if (!startDate || !endDate) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'startDate và endDate là bắt buộc (định dạng ISO date string)'
    })
  }

  try {
    // Validate date format
    if (!dayjs(startDate as string).isValid() || !dayjs(endDate as string).isValid()) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng ISO date string'
      })
    }

    const revenueData = await billService.getRevenueByCustomRange(startDate as string, endDate as string)
    const startDateFormatted = dayjs(revenueData.startDate).format('DD/MM/YYYY')
    const endDateFormatted = dayjs(revenueData.endDate).format('DD/MM/YYYY')

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Lấy dữ liệu doanh thu thành công',
      result: {
        dateRange: `${startDateFormatted} - ${endDateFormatted}`,
        startDate: revenueData.startDate,
        endDate: revenueData.endDate,
        totalRevenue: revenueData.totalRevenue,
        billCount: revenueData.bills.length,
        bills: revenueData.bills
      }
    })
  } catch (error: any) {
    return res.status(error.status || HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: error.message || 'Lỗi khi lấy dữ liệu doanh thu',
      error: error.message || 'Unknown error'
    })
  }
}
