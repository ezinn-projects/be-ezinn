import { FnBMenuItem } from '~/models/schemas/FnBMenuItem.schema'
import databaseService from './database.service'
import { ObjectId, Collection } from 'mongodb'

const COLLECTION_NAME = 'fnb_menu_item'

class FnBMenuItemService {
  private get collection(): Collection<FnBMenuItem> {
    return databaseService.getCollection<FnBMenuItem>(COLLECTION_NAME)
  }

  async createMenuItem(item: FnBMenuItem): Promise<FnBMenuItem> {
    const result = await this.collection.insertOne(item)
    item._id = result.insertedId
    return item
  }

  async getMenuItemById(id: string): Promise<FnBMenuItem | null> {
    const item = await this.collection.findOne({ _id: new ObjectId(id) })
    return item || null
  }

  async getAllMenuItems(): Promise<FnBMenuItem[]> {
    return await this.collection.find({}).toArray()
  }

  async updateMenuItem(id: string, data: Partial<FnBMenuItem>): Promise<FnBMenuItem | null> {
    await this.collection.updateOne({ _id: new ObjectId(id) }, { $set: data })
    return this.getMenuItemById(id)
  }

  async deleteMenuItem(id: string): Promise<FnBMenuItem | null> {
    const item = await this.getMenuItemById(id)
    if (!item) return null
    await this.collection.deleteOne({ _id: new ObjectId(id) })
    return item
  }

  async getVariantsByParentId(parentId: string): Promise<FnBMenuItem[]> {
    console.log('Getting variants for parentId:', parentId)
    const variants = await this.collection.find({ parentId: parentId }).toArray()
    console.log('Found variants in service:', JSON.stringify(variants, null, 2))
    return variants
  }
}

const fnBMenuItemService = new FnBMenuItemService()
export default fnBMenuItemService
