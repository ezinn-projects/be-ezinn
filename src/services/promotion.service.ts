import { ObjectId } from 'mongodb'
import { IPromotion, Promotion } from '~/models/schemas/Promotion.schema'
import databaseService from './database.service'

class PromotionService {
  /**
   * Get all promotions
   * @returns Array of promotions
   */
  async getAllPromotions() {
    return await databaseService.promotions.find({}).toArray()
  }

  /**
   * Get active promotion
   * @returns Active promotion or null if no active promotion
   */
  async getActivePromotion(): Promise<IPromotion | null> {
    const currentDate = new Date()
    return await databaseService.promotions.findOne({
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    })
  }

  /**
   * Get promotion by ID
   * @param id Promotion ID
   * @returns Promotion or null if not found
   */
  async getPromotionById(id: string): Promise<IPromotion | null> {
    return await databaseService.promotions.findOne({ _id: new ObjectId(id) })
  }

  /**
   * Create new promotion
   * @param promotion Promotion data
   * @returns Created promotion ID
   */
  async createPromotion(promotion: {
    name: string
    description?: string
    discountPercentage: number
    startDate: Date | string
    endDate: Date | string
    isActive: boolean
    appliesTo: 'sing' | 'all'
  }): Promise<ObjectId> {
    // If this promotion is set to active, deactivate all other promotions
    if (promotion.isActive) {
      await databaseService.promotions.updateMany({}, { $set: { isActive: false } })
    }

    const startDate = new Date(promotion.startDate)
    const endDate = new Date(promotion.endDate)

    const newPromotion = new Promotion(
      promotion.name,
      promotion.discountPercentage,
      startDate,
      endDate,
      promotion.isActive,
      promotion.appliesTo,
      promotion.description
    )

    const result = await databaseService.promotions.insertOne(newPromotion)
    return result.insertedId
  }

  /**
   * Update promotion
   * @param id Promotion ID
   * @param promotion Promotion data
   * @returns Number of modified documents
   */
  async updatePromotion(
    id: string,
    promotion: {
      name?: string
      description?: string
      discountPercentage?: number
      startDate?: Date | string
      endDate?: Date | string
      isActive?: boolean
      appliesTo?: 'sing' | 'all'
    }
  ): Promise<number> {
    // If this promotion is being set to active, deactivate all other promotions
    if (promotion.isActive) {
      await databaseService.promotions.updateMany({ _id: { $ne: new ObjectId(id) } }, { $set: { isActive: false } })
    }

    const updateData: any = { ...promotion, updatedAt: new Date() }

    // Convert dates if they exist
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate)
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate)
    }

    const result = await databaseService.promotions.updateOne({ _id: new ObjectId(id) }, { $set: updateData })
    return result.modifiedCount
  }

  /**
   * Delete promotion
   * @param id Promotion ID
   * @returns Number of deleted documents
   */
  async deletePromotion(id: string): Promise<number> {
    const result = await databaseService.promotions.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount
  }

  /**
   * Apply promotion to bill item
   * @param item Bill item
   * @param activePromotion Active promotion
   * @returns Modified bill item with applied discount
   */
  applyPromotionToItem(
    item: { description: string; quantity: number; unitPrice: number; totalPrice: number },
    activePromotion: IPromotion
  ) {
    // Check if the promotion applies to this item
    // For karaoke service only
    if (activePromotion.appliesTo === 'sing' && item.description.toLowerCase().includes('phi dich vu thu am')) {
      const originalPrice = item.totalPrice
      const discountAmount = Math.floor((originalPrice * activePromotion.discountPercentage) / 100)

      return {
        ...item,
        originalPrice: item.totalPrice, // Keep track of the original price
        totalPrice: originalPrice - discountAmount,
        discountName: activePromotion.name,
        discountPercentage: activePromotion.discountPercentage
      }
    }
    // For all items
    else if (activePromotion.appliesTo === 'all') {
      const originalPrice = item.totalPrice
      const discountAmount = Math.floor((originalPrice * activePromotion.discountPercentage) / 100)

      return {
        ...item,
        originalPrice: item.totalPrice, // Keep track of the original price
        totalPrice: originalPrice - discountAmount,
        discountName: activePromotion.name,
        discountPercentage: activePromotion.discountPercentage
      }
    }

    // If promotion doesn't apply to this item, return it unchanged
    return item
  }
}

const promotionService = new PromotionService()
export default promotionService
