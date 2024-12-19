import { ObjectId } from 'mongodb'
import databaseService from './database.services'
import { Price } from '~/models/schemas/Price.schema'
import { Pricing } from '~/models/schemas/Price.schema'
import { DayType } from '~/constants/enum'
import { RoomSize } from '~/constants/enum'

class PricingService {
  async getPricing(filter: { room_size?: RoomSize; day_type?: DayType; date?: Date }) {
    const query: any = {}
    if (filter.room_size) query.room_size = filter.room_size
    if (filter.day_type) query.day_type = filter.day_type
    if (filter.date) {
      query.effective_date = { $lte: filter.date }
      query.end_date = { $gte: filter.date }
    }

    return await databaseService.price.find(query).toArray()
  }

  async createPricing(pricing: Pricing) {
    const result = await databaseService.price.insertOne(new Price(pricing))
    return result.insertedId
  }

  async updatePricing(id: string, pricing: Pricing) {
    const result = await databaseService.price.updateOne({ _id: new ObjectId(id) }, { $set: new Price(pricing) })
    return result.modifiedCount
  }

  async deletePricing(id: string) {
    const result = await databaseService.price.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount
  }

  // delete multiple pricing
  async deleteMultiplePricing(ids: string[]) {
    const result = await databaseService.price.deleteMany({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
    return result.deletedCount
  }
}

export const pricingService = new PricingService()
