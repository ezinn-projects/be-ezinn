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
    const promotion = await databaseService.promotions.findOne({
      isActive: true
    })

    console.log('promotion', promotion)
    return promotion
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
   * Get promotion by name
   * @param name Promotion name
   * @returns Promotion or null if not found
   */
  async getPromotionByName(name: string): Promise<IPromotion | null> {
    return await databaseService.promotions.findOne({ name })
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
   * @param roomId Optional room ID to check if promotion applies to this room
   * @param roomTypeId Optional room type ID to check if promotion applies to this room type
   * @returns Modified bill item with applied discount
   */
  applyPromotionToItem(
    item: { description: string; quantity: number; price: number; totalPrice: number },
    activePromotion: IPromotion,
    roomId?: ObjectId,
    roomTypeId?: ObjectId
  ) {
    console.log('Áp dụng promotion cho item:', item.description)
    console.log('activePromotion', activePromotion)
    // Chuẩn hóa appliesTo (có thể là string hoặc array)
    const appliesTo = Array.isArray(activePromotion.appliesTo)
      ? activePromotion.appliesTo[0]?.toLowerCase()
      : activePromotion.appliesTo?.toLowerCase()

    console.log('appliesTo đã chuẩn hóa:', appliesTo)

    // Check if the promotion applies to this item
    let shouldApply = false

    // For karaoke service only
    if (appliesTo === 'sing' && item.description.toLowerCase().includes('phi dich vu thu am')) {
      console.log('Áp dụng promotion cho dịch vụ hát')
      shouldApply = true
    }
    // For specific room type
    else if (appliesTo === 'room_type' && roomTypeId) {
      // Check if promotion applies to this room type
      // Handling both string and array
      const appliesToRoomTypes = Array.isArray(activePromotion.appliesTo)
        ? activePromotion.appliesTo
        : [activePromotion.appliesTo]

      const roomTypeIdStr = roomTypeId.toString()
      shouldApply = appliesToRoomTypes.some((type) => type === roomTypeIdStr)
      console.log('Áp dụng promotion cho loại phòng:', shouldApply)
    }
    // For specific room
    else if (appliesTo === 'room' && roomId) {
      // Check if promotion applies to this specific room
      const appliesToRooms = Array.isArray(activePromotion.appliesTo)
        ? activePromotion.appliesTo
        : [activePromotion.appliesTo]

      const roomIdStr = roomId.toString()
      shouldApply = appliesToRooms.some((room) => room === roomIdStr)
      console.log('Áp dụng promotion cho phòng cụ thể:', shouldApply)
    }
    // For all items
    else if (appliesTo === 'all') {
      console.log('Áp dụng promotion cho tất cả items')
      shouldApply = true
    }

    if (shouldApply) {
      const originalPrice = item.totalPrice
      const discountAmount = Math.floor((originalPrice * activePromotion.discountPercentage) / 100)
      console.log(`Giá gốc: ${originalPrice}, Giảm: ${discountAmount}`)

      return {
        ...item,
        originalPrice: item.totalPrice, // Keep track of the original price
        totalPrice: originalPrice - discountAmount,
        discountName: activePromotion.name,
        discountPercentage: activePromotion.discountPercentage
      }
    }

    console.log('Promotion không áp dụng cho item này')
    // If promotion doesn't apply to this item, return it unchanged
    return item
  }

  /**
   * Get all valid promotions (regardless of active status, but within date range)
   * @param currentDate Current date to check against promotion date range
   * @returns List of valid promotions
   */
  async getValidPromotions(currentDate: Date): Promise<IPromotion[]> {
    // Find all promotions where the current date is between start and end date
    const validPromotions = await databaseService.promotions
      .find({
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate }
      })
      .toArray()

    return validPromotions
  }

  /**
   * Create predefined promotions for standard discounts
   * @param useImmediateStart Whether to start promotions immediately for testing
   * @returns Array of created promotion IDs
   */
  async createStandardDiscountPromotions(useImmediateStart: boolean = false): Promise<ObjectId[]> {
    const standardDiscounts = [
      {
        name: 'discount 5%',
        description: 'Grand opening - 5% discount',
        discountPercentage: 5,
        appliesTo: 'all' as 'all'
      },
      {
        name: 'discount 10%',
        description: 'Grand opening - 10% discount',
        discountPercentage: 10,
        appliesTo: 'all' as 'all'
      },
      {
        name: 'discount 15%',
        description: 'Grand opening - 15% discount',
        discountPercentage: 15,
        appliesTo: 'all' as 'all'
      },
      {
        name: 'discount 20%',
        description: 'Grand opening - 20% discount',
        discountPercentage: 20,
        appliesTo: 'all' as 'all'
      },
      {
        name: 'discount 25%',
        description: 'Grand opening - 25% discount',
        discountPercentage: 25,
        appliesTo: 'all' as 'all'
      },
      {
        name: 'discount 30%',
        description: 'Grand opening - 30% discount',
        discountPercentage: 30,
        appliesTo: 'all' as 'all'
      }
    ]

    // Set the appropriate start date
    const now = new Date()
    let startDate: Date

    if (useImmediateStart) {
      // Start immediately for testing
      startDate = now
    } else {
      // Set start date to the 26th of the current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 26, 0, 0, 0)
    }

    // Set end date to 1 year from the start date
    const endDate = new Date(startDate)
    endDate.setFullYear(endDate.getFullYear() + 1)

    const createdPromotionIds: ObjectId[] = []

    // Check if promotions with these names already exist
    for (const discount of standardDiscounts) {
      const existingPromotion = await databaseService.promotions.findOne({
        name: discount.name,
        discountPercentage: discount.discountPercentage
      })

      if (!existingPromotion) {
        const id = await this.createPromotion({
          ...discount,
          startDate,
          endDate,
          isActive: false // These should not be active by default
        })
        createdPromotionIds.push(id)
      }
    }

    return createdPromotionIds
  }
}

const promotionService = new PromotionService()
export default promotionService
