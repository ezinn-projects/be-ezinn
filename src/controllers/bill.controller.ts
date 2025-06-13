import { Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import billService from '~/services/bill.service'
import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import weekday from 'dayjs/plugin/weekday'
import { ObjectId } from 'mongodb'
import databaseService from '~/services/database.service'

// Extend dayjs with the required plugins
dayjs.extend(weekOfYear)
dayjs.extend(weekday)

export const getBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, actualStartTime, promotionId } = req.query

  const bill = await billService.getBill(
    scheduleId,
    actualEndTime as string,
    undefined,
    promotionId as string,
    actualStartTime as string
  )

  // Đảm bảo giữ nguyên số thập phân của quantity
  if (bill && bill.items) {
    bill.items.forEach((item) => {
      if (typeof item.quantity === 'number') {
        // Đảm bảo hiển thị đúng 2 chữ số thập phân
        item.quantity = parseFloat(item.quantity.toFixed(2))
      }
    })
  }

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get bill successfully',
    result: bill
  })
}

export const printBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, actualStartTime, paymentMethod, promotionId } = req.body

  const billData = await billService.getBill(
    scheduleId,
    actualEndTime as string,
    paymentMethod,
    promotionId as string,
    actualStartTime as string
  )

  // Đảm bảo giữ nguyên số thập phân của quantity
  if (billData && billData.items) {
    billData.items.forEach((item) => {
      if (typeof item.quantity === 'number') {
        // Đảm bảo hiển thị đúng 2 chữ số thập phân
        item.quantity = parseFloat(item.quantity.toFixed(2))
      }
    })
  }

  const bill = await billService.printBill(billData)

  // Đảm bảo giữ nguyên số thập phân khi trả về kết quả
  if (bill && bill.items) {
    bill.items.forEach((item) => {
      if (typeof item.quantity === 'number') {
        item.quantity = parseFloat(item.quantity.toFixed(2))
      }
    })
  }

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
  const { actualEndTime, actualStartTime, discountPercentage = 0 } = req.body

  try {
    // Get bill data using the regular method but without specifying a promotionId
    // This will either use no promotion or the default active one
    const bill = await billService.getBill(
      scheduleId,
      actualEndTime as string,
      undefined,
      undefined,
      actualStartTime as string
    )

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

/**
 * Get bill details by bill ID
 * @param req Request object containing billId in params
 * @param res Response object
 * @returns Bill details for the specified ID
 */
export const getBillById = async (req: Request, res: Response) => {
  const { billId } = req.params

  if (!billId) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Bill ID is required'
    })
  }

  try {
    // Validate ObjectId format
    if (!ObjectId.isValid(billId)) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid bill ID format'
      })
    }

    // Tìm hóa đơn trong database
    const bill = await databaseService.bills.findOne({ _id: new ObjectId(billId) })

    if (!bill) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'Bill not found'
      })
    }

    // Lấy thông tin phòng
    const room = await databaseService.rooms.findOne({ _id: bill.roomId })

    // Lấy thông tin lịch đặt phòng
    const schedule = await databaseService.roomSchedule.findOne({ _id: bill.scheduleId })

    // Format dates for better readability
    const formattedBill = {
      ...bill,
      roomName: room?.roomName || 'Unknown Room',
      roomType: room?.roomType || 'Unknown Type',
      customerName: schedule?.note || '',
      formattedStartTime: dayjs(bill.startTime).format('DD/MM/YYYY HH:mm'),
      formattedEndTime: dayjs(bill.endTime).format('DD/MM/YYYY HH:mm'),
      formattedCreatedAt: dayjs(bill.createdAt).format('DD/MM/YYYY HH:mm'),
      usageDuration: billService.calculateHours(bill.startTime, bill.endTime).toFixed(2),
      invoiceCode: bill.invoiceCode || 'N/A'
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get bill details successfully',
      result: formattedBill
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting bill details',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Get bills by room ID
 * @param req Request object containing roomId in params and optional date range in query
 * @param res Response object
 * @returns List of bills for the specified room
 */
export const getBillsByRoomId = async (req: Request, res: Response) => {
  const { roomId } = req.params
  const { startDate, endDate, limit } = req.query

  if (!roomId) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      message: 'Room ID is required'
    })
  }

  try {
    // Validate ObjectId format
    if (!ObjectId.isValid(roomId)) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid room ID format'
      })
    }

    // Xây dựng query filter
    const filter: any = { roomId: new ObjectId(roomId) }

    // Thêm điều kiện lọc theo thời gian nếu có
    if (startDate && endDate) {
      // Validate date format
      if (!dayjs(startDate as string).isValid() || !dayjs(endDate as string).isValid()) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          message: 'Invalid date format. Please use ISO date string format'
        })
      }

      const startDateObj = dayjs(startDate as string)
        .startOf('day')
        .toDate()
      const endDateObj = dayjs(endDate as string)
        .endOf('day')
        .toDate()

      filter.endTime = {
        $gte: startDateObj,
        $lte: endDateObj
      }
    }

    // Giới hạn số lượng kết quả trả về nếu có
    const queryLimit = limit ? parseInt(limit as string, 10) : 50

    // Lấy danh sách hóa đơn từ database
    const bills = await databaseService.bills
      .find(filter)
      .sort({ endTime: -1 }) // Sắp xếp theo thời gian kết thúc, mới nhất lên đầu
      .limit(queryLimit)
      .toArray()

    // Lấy thông tin phòng
    const room = await databaseService.rooms.findOne({ _id: new ObjectId(roomId) })

    // Format dates for better readability
    const formattedBills = await Promise.all(
      bills.map(async (bill) => {
        // Lấy thông tin lịch đặt phòng
        const schedule = await databaseService.roomSchedule.findOne({ _id: bill.scheduleId })

        return {
          _id: bill._id,
          scheduleId: bill.scheduleId,
          roomId: bill.roomId,
          roomName: room?.roomName || 'Unknown Room',
          roomType: room?.roomType || 'Unknown Type',
          customerName: schedule?.note || '',
          startTime: bill.startTime,
          endTime: bill.endTime,
          formattedStartTime: dayjs(bill.startTime).format('DD/MM/YYYY HH:mm'),
          formattedEndTime: dayjs(bill.endTime).format('DD/MM/YYYY HH:mm'),
          formattedCreatedAt: dayjs(bill.createdAt).format('DD/MM/YYYY HH:mm'),
          totalAmount: bill.totalAmount,
          paymentMethod: bill.paymentMethod,
          itemCount: bill.items?.length || 0,
          usageDuration: billService.calculateHours(bill.startTime, bill.endTime).toFixed(2),
          invoiceCode: bill.invoiceCode || 'N/A'
        }
      })
    )

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get bills by room ID successfully',
      result: {
        roomId,
        roomName: room?.roomName || 'Unknown Room',
        billCount: formattedBills.length,
        bills: formattedBills
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting bills by room ID',
      error: error.message || 'Unknown error'
    })
  }
}

/**
 * Get all bills with pagination and filtering
 * @param req Request object containing query parameters
 * @param res Response object
 * @returns Paginated list of bills
 */
export const getAllBills = async (req: Request, res: Response) => {
  const { page = '1', limit = '10', startDate, endDate, minAmount, maxAmount, paymentMethod, invoiceCode } = req.query

  try {
    // Parse pagination parameters
    const pageNumber = parseInt(page as string, 10)
    const limitNumber = parseInt(limit as string, 10)
    const skip = (pageNumber - 1) * limitNumber

    // Build filter object
    const filter: any = {}

    // Add date range filter if provided
    if (startDate && endDate) {
      // Validate date format
      if (!dayjs(startDate as string).isValid() || !dayjs(endDate as string).isValid()) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          message: 'Invalid date format. Please use ISO date string format'
        })
      }

      const startDateObj = dayjs(startDate as string)
        .startOf('day')
        .toDate()
      const endDateObj = dayjs(endDate as string)
        .endOf('day')
        .toDate()

      filter.endTime = {
        $gte: startDateObj,
        $lte: endDateObj
      }
    }

    // Add amount range filter if provided
    if (minAmount || maxAmount) {
      filter.totalAmount = {}

      if (minAmount) {
        filter.totalAmount.$gte = parseInt(minAmount as string, 10)
      }

      if (maxAmount) {
        filter.totalAmount.$lte = parseInt(maxAmount as string, 10)
      }
    }

    // Add payment method filter if provided
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod
    }

    // Add invoice code filter if provided
    if (invoiceCode) {
      filter.invoiceCode = invoiceCode
    }

    // Get total count for pagination
    const totalCount = await databaseService.bills.countDocuments(filter)
    const totalPages = Math.ceil(totalCount / limitNumber)

    // Get bills with pagination
    const bills = await databaseService.bills
      .find(filter)
      .sort({ endTime: -1 }) // Sort by end time descending (newest first)
      .skip(skip)
      .limit(limitNumber)
      .toArray()

    // Format bills with additional information
    const formattedBills = await Promise.all(
      bills.map(async (bill) => {
        // Get room information
        const room = await databaseService.rooms.findOne({ _id: bill.roomId })

        // Get schedule information
        const schedule = await databaseService.roomSchedule.findOne({ _id: bill.scheduleId })

        return {
          _id: bill._id,
          scheduleId: bill.scheduleId,
          roomId: bill.roomId,
          roomName: room?.roomName || 'Unknown Room',
          roomType: room?.roomType || 'Unknown Type',
          customerName: schedule?.note || '',
          startTime: bill.startTime,
          endTime: bill.endTime,
          formattedStartTime: dayjs(bill.startTime).format('DD/MM/YYYY HH:mm'),
          formattedEndTime: dayjs(bill.endTime).format('DD/MM/YYYY HH:mm'),
          formattedCreatedAt: dayjs(bill.createdAt).format('DD/MM/YYYY HH:mm'),
          totalAmount: bill.totalAmount,
          paymentMethod: bill.paymentMethod,
          itemCount: bill.items?.length || 0,
          usageDuration: billService.calculateHours(bill.startTime, bill.endTime).toFixed(2),
          hasPromotion: !!bill.activePromotion,
          invoiceCode: bill.invoiceCode || 'N/A'
        }
      })
    )

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Get all bills successfully',
      result: {
        bills: formattedBills,
        pagination: {
          totalCount,
          totalPages,
          currentPage: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1
        }
      }
    })
  } catch (error: any) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      message: 'Error getting bills',
      error: error.message || 'Unknown error'
    })
  }
}
