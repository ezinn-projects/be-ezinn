import { IRoomCategoryRequest } from '~/models/requests/RoomCategory.request'
import { IRoomCategorySchema, RoomCategory } from '~/models/schemas/RoomCategory.schema'
import databaseService from './database.service'
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
   * @param updateData - Partial<IRoomCategoryRequest> room category data to update
   * @returns updated room category
   * @author QuangDoo
   */
  async updateRoomCategory(id: string, updateData: Partial<IRoomCategoryRequest>) {
    // Định nghĩa các trường được phép update
    const allowedFields = ['name', 'capacity', 'price_per_hour', 'equipment', 'description']

    // Lọc ra các trường hợp lệ từ dữ liệu update
    const sanitizedData = Object.keys(updateData)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key as keyof IRoomCategoryRequest] = updateData[key as keyof IRoomCategoryRequest] as any
        return obj
      }, {} as Partial<IRoomCategoryRequest>)

    // Lấy dữ liệu hiện tại
    const currentCategory = await databaseService.roomCategories.findOne({
      _id: new ObjectId(id)
    })

    // Merge equipment nếu có update
    if (sanitizedData.equipment) {
      sanitizedData.equipment = {
        ...currentCategory?.equipment,
        ...sanitizedData.equipment
      }
    }

    // Thêm thời gian update
    const updateTime = new Date().toISOString()

    // Thực hiện update với $set
    const result = await databaseService.roomCategories.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...sanitizedData,
          update_time: updateTime
        }
      },
      { returnDocument: 'after' } // Trả về document sau khi update
    )

    return result
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
