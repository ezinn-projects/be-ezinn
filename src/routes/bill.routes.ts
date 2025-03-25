import { Router } from 'express'
import { generateBill, getBill, printBill } from '~/controllers/bill.controller'
import { protect } from '~/middlewares/auth.middleware'
import { UserRole } from '~/constants/enum'
import { wrapRequestHandler } from '~/utils/handlers'

const billRouter = Router()

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
 * @route POST /bill/:scheduleId/generate
 * @description Generate bill by scheduleId
 * @access Private
 * @author: QuangDoo
 */
billRouter.post('/:scheduleId/generate', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(generateBill))

export default billRouter
