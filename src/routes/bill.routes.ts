import { Router } from 'express'
import {
  getBill,
  printBill,
  printBillWifi,
  printBillWifiRaw,
  printBillShared,
  testPrintWifi,
  testPrinterConnection,
  getDailyRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getCustomRangeRevenue,
  cleanDuplicateBills,
  cleanUpNonFinishedBills,
  testBillWithDiscount,
  getBillById,
  getBillsByRoomId,
  getAllBills,
  saveBill
} from '~/controllers/bill.controller'
import { protect } from '~/middlewares/auth.middleware'
import { UserRole } from '~/constants/enum'
import { wrapRequestHandler } from '~/utils/handlers'

const billRouter = Router()

/**
 * @route GET /bill/revenue/daily
 * @description Get total revenue for a specific date
 * @access Private
 * @author: AI Assistant
 */
billRouter.get('/revenue/daily', protect([UserRole.Admin]), wrapRequestHandler(getDailyRevenue))

/**
 * @route GET /bill/revenue/weekly
 * @description Get total revenue for a specific week
 * @access Private
 * @author: AI Assistant
 */
billRouter.get('/revenue/weekly', protect([UserRole.Admin]), wrapRequestHandler(getWeeklyRevenue))

/**
 * @route GET /bill/revenue/monthly
 * @description Get total revenue for a specific month
 * @access Private
 * @author: AI Assistant
 */
billRouter.get('/revenue/monthly', protect([UserRole.Admin]), wrapRequestHandler(getMonthlyRevenue))

/**
 * @route GET /bill/revenue/custom
 * @description Get total revenue for a custom date range
 * @access Private
 * @author: AI Assistant
 */
billRouter.get('/revenue/custom', protect([UserRole.Admin]), wrapRequestHandler(getCustomRangeRevenue))

/**
 * @route GET /bill/details/:billId
 * @description Get bill details by bill ID
 * @access Private
 */
billRouter.get('/details/:billId', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getBillById))

/**
 * @route GET /bill/room/:roomId
 * @description Get bills by room ID
 * @access Private
 */
billRouter.get('/room/:roomId', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getBillsByRoomId))

/**
 * @route GET /bill/all
 * @description Get all bills with pagination and filtering
 * @access Private
 */
billRouter.get('/all', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getAllBills))

/**
 * @route POST /bill/save
 * @description Save a bill directly to the bills collection
 * @access Private
 */
billRouter.post('/save', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(saveBill))

/**
 * @route GET /bill/:scheduleId
 * @description Get bill by scheduleId
 * @access Private
 * @author: QuangDoo
 */
billRouter.get('/:scheduleId', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getBill))

/**
 * @route POST /bill/:scheduleId
 * @description Print bill by scheduleId
 * @access Private
 * @author: QuangDoo
 */
billRouter.post('/:scheduleId', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(printBill))

/**
 * @route POST /bill/:scheduleId/wifi
 * @description Print bill via WiFi by scheduleId
 * @access Private
 * @author: AI Assistant
 */
billRouter.post('/:scheduleId/wifi', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(printBillWifi))

/**
 * @route POST /bill/:scheduleId/wifi-raw
 * @description Print bill via WiFi using raw socket by scheduleId
 * @access Private
 * @author: AI Assistant
 */
billRouter.post(
  '/:scheduleId/wifi-raw',
  protect([UserRole.Admin, UserRole.Staff]),
  wrapRequestHandler(printBillWifiRaw)
)

/**
 * @route POST /bill/:scheduleId/shared
 * @description Print bill via shared printer by scheduleId
 * @access Private
 * @author: AI Assistant
 */
billRouter.post('/:scheduleId/shared', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(printBillShared))

/**
 * @route POST /bill/test-wifi
 * @description Test print via WiFi with different encodings
 * @access Private
 * @author: AI Assistant
 */
billRouter.post('/test-wifi', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(testPrintWifi))

/**
 * @route POST /bill/test-connection
 * @description Test printer connection on multiple ports
 * @access Private
 * @author: AI Assistant
 */
billRouter.post(
  '/test-connection',
  protect([UserRole.Admin, UserRole.Staff]),
  wrapRequestHandler(testPrinterConnection)
)

/**
 * @route DELETE /bill/clean-duplicates
 * @description Clean duplicate bills
 * @access Private (Admin only)
 */
billRouter.delete('/clean-duplicates', protect([UserRole.Admin]), wrapRequestHandler(cleanDuplicateBills))

/**
 * @route DELETE /bill/clean-non-finished
 * @description Clean bills associated with non-finished room schedules
 * @access Private (Admin only)
 */
billRouter.delete('/clean-non-finished', protect([UserRole.Admin]), wrapRequestHandler(cleanUpNonFinishedBills))

/**
 * @route POST /bill/:scheduleId/test-discount
 * @description Test bill with different discount percentages without saving
 * @access Private
 */
billRouter.post(
  '/:scheduleId/test-discount',
  protect([UserRole.Admin, UserRole.Staff]),
  wrapRequestHandler(testBillWithDiscount)
)

// /**
//  * @route POST /bill/:scheduleId/generate
//  * @description Generate bill by scheduleId
//  * @access Private
//  * @author: QuangDoo
//  */
// billRouter.post('/:scheduleId/generate', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(generateBill))

export default billRouter
