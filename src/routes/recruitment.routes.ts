import { Router } from 'express'
import { recruitmentController } from '~/controllers/recruitment.controller'
import { protect } from '~/middlewares/auth.middleware'
import { UserRole } from '~/constants/enum'

const router = Router()

// Protected routes (cần đăng nhập admin)
router.use(protect([UserRole.Admin, UserRole.Staff])) // Middleware xác thực cho tất cả routes bên dưới

// Quản lý đơn ứng tuyển (admin only) - Chỉ GET endpoints
router.get('/recruitments', recruitmentController.getRecruitments)
router.get('/recruitments/:id', recruitmentController.getRecruitmentById)
router.get('/stats', recruitmentController.getRecruitmentStats)

export default router
