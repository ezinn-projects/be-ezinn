import { Router } from 'express'
import {
  createPromotion,
  deletePromotion,
  getActivePromotion,
  getAllPromotions,
  getPromotionById,
  updatePromotion,
  getPromotionsForCheckout,
  createStandardDiscountPromotions
} from '~/controllers/promotion.controller'
import { protect } from '~/middlewares/auth.middleware'
import { UserRole } from '~/constants/enum'
import { wrapRequestHandler } from '~/utils/handlers'

const promotionRouter = Router()

/**
 * @route GET /promotions
 * @description Get all promotions
 * @access Private - Admin only
 */
promotionRouter.get('/', protect([UserRole.Admin]), wrapRequestHandler(getAllPromotions))

/**
 * @route GET /promotions/active
 * @description Get active promotion
 * @access Private - Admin and Staff
 */
promotionRouter.get('/active', protect([UserRole.Admin, UserRole.Staff]), wrapRequestHandler(getActivePromotion))

/**
 * @route GET /promotions/checkout
 * @description Get valid promotions for checkout selection
 * @access Private - Admin and Staff
 */
promotionRouter.get(
  '/checkout',
  protect([UserRole.Admin, UserRole.Staff]),
  wrapRequestHandler(getPromotionsForCheckout)
)

/**
 * @route POST /promotions/standard-discounts
 * @description Create standard discount promotions (5%, 10%, 15%, 20%, 25%, 30%)
 * @access Private - Admin only
 */
promotionRouter.post(
  '/standard-discounts',
  protect([UserRole.Admin]),
  wrapRequestHandler(createStandardDiscountPromotions)
)

/**
 * @route GET /promotions/:id
 * @description Get promotion by ID
 * @access Private - Admin only
 */
promotionRouter.get('/:id', protect([UserRole.Admin]), wrapRequestHandler(getPromotionById))

/**
 * @route POST /promotions
 * @description Create new promotion
 * @access Private - Admin only
 */
promotionRouter.post('/', protect([UserRole.Admin]), wrapRequestHandler(createPromotion))

/**
 * @route PUT /promotions/:id
 * @description Update promotion
 * @access Private - Admin only
 */
promotionRouter.put('/:id', protect([UserRole.Admin]), wrapRequestHandler(updatePromotion))

/**
 * @route DELETE /promotions/:id
 * @description Delete promotion
 * @access Private - Admin only
 */
promotionRouter.delete('/:id', protect([UserRole.Admin]), wrapRequestHandler(deletePromotion))

export default promotionRouter
