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

/**
 * Get all promotions for checkout selection
 * @param req Request
 * @param res Response
 */
export const getPromotionsForCheckout = async (req: Request, res: Response) => {
  // Get current date to filter only valid promotions (within start and end dates)
  const currentDate = new Date()

  // Get all promotions that are valid (current date is between start and end date)
  // regardless of isActive status
  const promotions = await promotionService.getValidPromotions(currentDate)

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get promotions for checkout successfully',
    result: promotions
  })
}

/**
 * Create standard discount promotions
 * @param req Request
 * @param res Response
 */
export const createStandardDiscountPromotions = async (req: Request, res: Response) => {
  // Check if start date is provided for testing
  const { startToday } = req.query
  const useImmediateStart = startToday === 'true'

  const promotionIds = await promotionService.createStandardDiscountPromotions(useImmediateStart)

  // Get the appropriate start date for the message
  const now = new Date()
  const startDate = useImmediateStart ? now : new Date(now.getFullYear(), now.getMonth(), 26, 0, 0, 0)
  const formattedDate = `${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()}`

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: `Created standard discount promotions (5%, 10%, 15%, 20%, 25%, 30%) ${useImmediateStart ? 'starting immediately' : `scheduled to start on ${formattedDate}`}`,
    result: {
      count: promotionIds.length,
      promotionIds,
      startDate,
      isImmediate: useImmediateStart
    }
  })
}
