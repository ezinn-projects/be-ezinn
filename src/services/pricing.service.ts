import { ObjectId } from 'mongodb'
import { IPricingRequestBody, IPricingRequestQuery } from '~/models/requests/Pricing.request'
import { Price, Pricing } from '~/models/schemas/Price.schema'
import databaseService from './database.services'

class PricingService {
  /**
   * Get pricing by filter
   * @param filter - filter object {IPricingRequestQuery}
   * @returns pricing
   * @author QuangDoo
   */
  async getPricing(filter: IPricingRequestQuery) {
    const query: any = {}
    if (filter.room_size) query.room_size = filter.room_size
    if (filter.day_type) query.day_type = filter.day_type

    if (filter.effective_date) {
      query.effective_date = { $lte: filter.effective_date }
      query.end_date = { $gte: filter.effective_date }
    }

    return await databaseService.price.find(query).toArray()
  }

  /**
   * Create pricing
   * @param pricing - pricing object
   * @returns pricing id
   * @author QuangDoo
   */
  async createPricing(pricing: IPricingRequestBody) {
    const pricingData = new Price({
      ...pricing,
      effective_date: new Date(pricing.effective_date),
      end_date: pricing.end_date ? new Date(pricing.end_date) : undefined
    })

    const result = await databaseService.price.insertOne(pricingData)
    return result.insertedId
  }

  /**
   * Update pricing
   * @param id - pricing id
   * @param pricing - pricing object
   * @returns number of updated pricing
   * @author QuangDoo
   */
  async updatePricing(id: string, pricing: IPricingRequestBody) {
    const pricingData = new Price({
      ...pricing,
      effective_date: new Date(pricing.effective_date),
      end_date: pricing.end_date ? new Date(pricing.end_date) : undefined,
      time_range: pricing.time_range,
      price: pricing.price,
      room_size: pricing.room_size,
      day_type: pricing.day_type,
      _id: new ObjectId(id)
    })
    const result = await databaseService.price.updateOne({ _id: new ObjectId(id) }, { $set: pricingData })

    return result.modifiedCount
  }

  /**
   * Delete pricing
   * @param id - pricing id
   * @returns number of deleted pricing
   * @author QuangDoo
   */
  async deletePricing(id: string) {
    const result = await databaseService.price.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount
  }

  /**
   * Delete multiple pricing
   * @param ids - pricing ids
   * @returns number of deleted pricing
   * @author QuangDoo
   */
  async deleteMultiplePricing(ids: ObjectId[]) {
    const result = await databaseService.price.deleteMany({ _id: { $in: ids } })
    return result.deletedCount
  }
}

export const pricingService = new PricingService()
