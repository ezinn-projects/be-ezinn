import { Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import billService from '~/services/bill.service'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import weekday from 'dayjs/plugin/weekday'
import { ObjectId } from 'mongodb'

// Extend dayjs with the required plugins
dayjs.extend(weekOfYear)
dayjs.extend(weekday)

export const getBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, promotionId } = req.query

  const bill = await billService.getBill(scheduleId, actualEndTime as string, undefined, promotionId as string)
  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get bill successfully',
    result: bill
  })
}

export const printBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, paymentMethod, promotionId } = req.body

  const billData = await billService.getBill(scheduleId, actualEndTime as string, paymentMethod, promotionId as string)

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

/**
 * Clean duplicate bills
 * @param req Request object containing optional date in query params
 * @param res Response object
 * @returns Result of cleaning operation
 */
export const cleanDuplicateBills = async (req: Request, res: Response) => {
  const { date } = req.query

  try {
    const result = await billService.cleanDuplicateBills(date as string)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Dọn dẹp hóa đơn trùng lặp thành công',
      result: {
        beforeCount: result.beforeCount,
        afterCount: result.afterCount,
        removedCount: result.removedCount
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi khi dọn dẹp hóa đơn trùng lặp',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Clean bills associated with non-finished room schedules
 * @param req Request object
 * @param res Response object
 * @returns Result of cleaning operation
 */
export const cleanUpNonFinishedBills = async (req: Request, res: Response) => {
  try {
    const result = await billService.cleanUpNonFinishedBills()

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Dọn dẹp hóa đơn thuộc lịch chưa hoàn thành thành công',
      result: {
        beforeCount: result.beforeCount,
        afterCount: result.afterCount,
        removedCount: result.removedCount
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Lỗi khi dọn dẹp hóa đơn thuộc lịch chưa hoàn thành',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Test bill with specific discount percentage without saving to the database
 * @param req Request
 * @param res Response
 */
export const testBillWithDiscount = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, discountPercentage = 0 } = req.body

  try {
    // Get bill data using the regular method but without specifying a promotionId
    // This will either use no promotion or the default active one
    const bill = await billService.getBill(scheduleId, actualEndTime as string)

    // Create a temporary promotion object for testing
    const testPromotion = {
      _id: new ObjectId(),
      name: `Test Discount ${discountPercentage}%`,
      description: `Test discount of ${discountPercentage}%`,
      discountPercentage: Number(discountPercentage),
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000), // 1 day later
      isActive: true,
      appliesTo: 'all',
      createdAt: new Date()
    }

    // Check if bill has negative values due to endTime before startTime
    let needsTimeCorrection = false
    if (new Date(bill.endTime) < new Date(bill.startTime)) {
      needsTimeCorrection = true
      console.warn('Warning: End time is before start time in the schedule, adjusting for test purposes')
    }

    // Apply the test discount to each item in the bill (ignoring any existing discounts)
    const discountedItems = bill.items.map((item) => {
      // Ensure positive quantity and price
      const fixedQuantity = Math.abs(item.quantity)
      // Use the original price if available, otherwise calculate from price * quantity
      const basePrice = item.originalPrice || item.price * fixedQuantity
      const discountAmount = Math.floor((basePrice * Number(discountPercentage)) / 100)

      // Make sure description doesn't already include a discount from soft opening
      const baseDescription = item.description.includes('(Giam')
        ? item.description.split('(Giam')[0].trim()
        : item.description

      return {
        price: item.price,
        quantity: fixedQuantity,
        description: `${baseDescription} (Test -${discountPercentage}%)`,
        // Keep track of the original price
        originalPrice: basePrice,
        // Discount percentage for this test
        discountPercentage: Number(discountPercentage),
        // Discount name for this test
        discountName: `Test ${discountPercentage}%`,
        // Calculate the final discounted price
        discountedTotalPrice: basePrice - discountAmount
      }
    })

    // Calculate new total amount
    const totalAmount = discountedItems.reduce((acc, item) => acc + item.discountedTotalPrice, 0)

    // Create the test bill response
    const testBill = {
      ...bill,
      items: discountedItems,
      totalAmount,
      // Replace any existing promotion with our test one
      activePromotion: {
        name: testPromotion.name,
        discountPercentage: testPromotion.discountPercentage,
        appliesTo: testPromotion.appliesTo
      },
      isTestMode: true,
      timeWarning: needsTimeCorrection
        ? 'Warning: End time is earlier than start time in this schedule. Values have been adjusted for testing.'
        : undefined
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Test bill with discount generated successfully (replacing any existing promotions)',
      result: testBill
    })
  } catch (error) {
    console.error('Error generating test bill:', error)
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error generating test bill',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
