import { Router } from 'express'
import billRouter from './bill.routes'
import holidayRouter from './holiday.routes'

const router = Router()

router.use('/bill', billRouter)
router.use('/holiday', holidayRouter)

export default router
