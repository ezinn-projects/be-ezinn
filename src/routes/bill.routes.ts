import { Router } from 'express'
import {
  getBill,
  printBill,
  getDailyRevenue,
  getWeeklyRevenue,
  getMonthlyRevenue,
  getCustomRangeRevenue
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

// /**
//  * @route POST /bill/:scheduleId/generate
//  * @description Generate bill by scheduleId
//  * @access Private
//  * @author: QuangDoo
//  */
// billRouter.post('/:scheduleId/generate', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(generateBill))

export default billRouter
