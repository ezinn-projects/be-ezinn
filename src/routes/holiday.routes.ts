import { Router } from 'express'
import { addHoliday, getHolidays, updateHoliday, deleteHoliday } from '~/controllers/holiday.controller'
import { protect } from '~/middlewares/auth.middleware'
import { UserRole } from '~/constants/enum'
import { wrapRequestHandler } from '~/utils/handlers'

const holidayRouter = Router()

/**
 * @route POST /holiday
 * @description Add a new holiday
 * @access Private (Admin only)
 */
holidayRouter.post('/', protect([UserRole.Admin]), wrapRequestHandler(addHoliday))

/**
 * @route GET /holiday
 * @description Get all holidays
 * @access Private (Admin, Staff)
 */
holidayRouter.get('/', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getHolidays))

/**
 * @route PUT /holiday/:id
 * @description Update a holiday
 * @access Private (Admin only)
 */
holidayRouter.put('/:id', protect([UserRole.Admin]), wrapRequestHandler(updateHoliday))

/**
 * @route DELETE /holiday/:id
 * @description Delete a holiday
 * @access Private (Admin only)
 */
holidayRouter.delete('/:id', protect([UserRole.Admin]), wrapRequestHandler(deleteHoliday))

export default holidayRouter
