import { ObjectId } from 'mongodb'
import { IPriceRequestBody, IPriceRequestQuery } from '~/models/requests/Price.request'
import databaseService from './database.service'
import { Price } from '~/models/schemas/Price.schema'

class PriceService {
  /**
   * Get Price by filter
   * @param filter - filter object {IPriceRequestQuery}
   * @returns Price
   * @author QuangDoo
   */
  async getPrice(filter: IPriceRequestQuery) {
    const query: any = {}
    if (filter.roomType) query.room_type = filter.roomType
    if (filter.dayType) query.day_type = filter.dayType

    if (filter.date) {
      query.effectiveDate = { $lte: filter.date }
      query.endDate = { $gte: filter.date }
    }

    return await databaseService.price.find(query).toArray()
  }

  /**
   * Get Price by id
   * @param id - Price id
   * @returns Price
   * @author QuangDoo
   */
  async getPriceById(id: string) {
    return await databaseService.price.findOne({ _id: new ObjectId(id) })
  }

  /**
   * Create Price
   * @param Price - Price object
   * @returns Price id
   * @author QuangDoo
   */
  async createPrice(price: IPriceRequestBody) {
    const priceData = new Price({
      day_type: price.dayType,
      time_slots: price.timeSlots.map((slot) => ({
        start: slot.start,
        end: slot.end,
        prices: slot.prices.map((p) => ({
          room_type: p.roomType,
          price: p.price
        }))
      })),
      effective_date: new Date(price.effectiveDate),
      end_date: price.endDate ? new Date(price.endDate) : null,
      note: price.note
    })

    const result = await databaseService.price.insertOne(priceData)
    return result.insertedId
  }

  /**
   * Update Price
   * @param id - Price id
   * @param Price - Price object
   * @returns number of updated Price
   * @author QuangDoo
   */
  async updatePrice(id: string, price: IPriceRequestBody) {
    const priceData = {
      day_type: price.dayType,
      time_slots: price.timeSlots.map((slot) => ({
        start: slot.start,
        end: slot.end,
        prices: slot.prices.map((p) => ({
          room_type: p.roomType,
          price: p.price
        }))
      })),
      effective_date: new Date(price.effectiveDate),
      end_date: price.endDate ? new Date(price.endDate) : null,
      note: price.note
    }
    const result = await databaseService.price.updateOne({ _id: new ObjectId(id) }, { $set: priceData })

    return result.modifiedCount
  }

  /**
   * Delete Price
   * @param id - Price id
   * @returns number of deleted Price
   * @author QuangDoo
   */
  async deletePrice(id: string) {
    const result = await databaseService.price.deleteOne({ _id: new ObjectId(id) })
    return result.deletedCount
  }

  /**
   * Delete multiple Price
   * @param ids - Price ids
   * @returns number of deleted Price
   * @author QuangDoo
   */
  async deleteMultiplePrice(ids: ObjectId[]) {
    const result = await databaseService.price.deleteMany({ _id: { $in: ids } })
    return result.deletedCount
  }
}

export const priceService = new PriceService()
