import { IRoomCategoryRequest } from '~/models/requests/RoomCategory.request'
import { IRoomCategorySchema, RoomCategory } from '~/models/schemas/RoomCategory.schema'
import databaseService from './database.services'
import { ObjectId } from 'mongodb'

class RoomCategoryService {
  /**
   * Create room category
   * @param category - @type IRoomCategoryRequest room category object
   * @returns room category id
   * @author QuangDoo
   */
  async createRoomCategory(category: IRoomCategoryRequest) {
    const now = new Date().toISOString()

    const newCategory: Omit<IRoomCategorySchema, '_id'> = {
      ...category,
      createdAt: now,
      updatedAt: now,
      price_per_hour: category.pricePerHour,
      capacity: category.capacity,
      equipment: category.equipment,
      description: category.description,
      name: category.name
    }

    return await databaseService.roomCategories.insertOne(new RoomCategory(newCategory))
  }

  /**
   * Get all room categories
   * @returns all room categories
   * @author QuangDoo
   */
  async getAllRoomCategories() {
    return await databaseService.roomCategories.find().toArray()
  }

  /**
   * Get room category by id
   * @param id - room category id
   * @returns room category
   * @author QuangDoo
   */
  async getRoomCategoryById(id: string) {
    return await databaseService.roomCategories.findOne({ _id: new ObjectId(id) })
  }

  /**
   * Update room category
   * @param id - room category id
   * @param category - @type IRoomCategoryRequest room category object
   * @returns number of updated room categories
   * @author QuangDoo
   */
  async updateRoomCategory(id: string, category: IRoomCategoryRequest) {
    return await databaseService.roomCategories.updateOne({ _id: new ObjectId(id) }, { $set: category })
  }

  /**
   * Delete room category
   * @param id - room category id
   * @returns number of deleted room categories
   * @author QuangDoo
   */
  async deleteRoomCategory(id: string) {
    return await databaseService.roomCategories.deleteOne({ _id: new ObjectId(id) })
  }

  /**
   * Get room category by name
   * @param name - room category name
   * @returns room category
   * @author QuangDoo
   */
  async getRoomCategoryByName(name: string) {
    return await databaseService.roomCategories.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  }
}

export const roomCategoryService = new RoomCategoryService()
