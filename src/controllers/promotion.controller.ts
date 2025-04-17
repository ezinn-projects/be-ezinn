import { Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import promotionService from '~/services/promotion.service'

/**
 * Get all promotions
 * @param req Request
 * @param res Response
 */
export const getAllPromotions = async (req: Request, res: Response) => {
  const promotions = await promotionService.getAllPromotions()
  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get all promotions successfully',
    result: promotions
  })
}

/**
 * Get active promotion
 * @param req Request
 * @param res Response
 */
export const getActivePromotion = async (req: Request, res: Response) => {
  const promotion = await promotionService.getActivePromotion()
  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get active promotion successfully',
    result: promotion
  })
}

/**
 * Get promotion by ID
 * @param req Request
 * @param res Response
 */
export const getPromotionById = async (req: Request, res: Response) => {
  const { id } = req.params
  const promotion = await promotionService.getPromotionById(id)
  if (!promotion) {
    return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
      message: 'Promotion not found'
    })
  }
  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get promotion successfully',
    result: promotion
  })
}

/**
 * Create promotion
 * @param req Request
 * @param res Response
 */
export const createPromotion = async (req: Request, res: Response) => {
  const { name, description, discountPercentage, startDate, endDate, isActive, appliesTo } = req.body
  const id = await promotionService.createPromotion({
    name,
    description,
    discountPercentage,
    startDate,
    endDate,
    isActive,
    appliesTo
  })
  return res.status(HTTP_STATUS_CODE.CREATED).json({
    message: 'Create promotion successfully',
    result: { id }
  })
}

/**
 * Update promotion
 * @param req Request
 * @param res Response
 */
export const updatePromotion = async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, description, discountPercentage, startDate, endDate, isActive, appliesTo } = req.body

  // Check if promotion exists
  const promotion = await promotionService.getPromotionById(id)
  if (!promotion) {
    return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
      message: 'Promotion not found'
    })
  }

  const modifiedCount = await promotionService.updatePromotion(id, {
    name,
    description,
    discountPercentage,
    startDate,
    endDate,
    isActive,
    appliesTo
  })

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Update promotion successfully',
    result: { modifiedCount }
  })
}

/**
 * Delete promotion
 * @param req Request
 * @param res Response
 */
export const deletePromotion = async (req: Request, res: Response) => {
  const { id } = req.params

  // Check if promotion exists
  const promotion = await promotionService.getPromotionById(id)
  if (!promotion) {
    return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
      message: 'Promotion not found'
    })
  }

  const deletedCount = await promotionService.deletePromotion(id)

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Delete promotion successfully',
    result: { deletedCount }
  })
}
