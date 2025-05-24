import { FnbMenu, FnbMenuModel } from '~/models/schemas/FnBMenu.schema'
import databaseService from './database.service'
import { ObjectId } from 'mongodb'

class FnbMenuService {
  async createFnbMenu(menu: FnbMenu): Promise<FnbMenu> {
    const result = await databaseService.fnbMenu.insertOne(menu)
    menu._id = result.insertedId
    return menu
  }

  async getFnbMenuById(id: string): Promise<FnbMenu | null> {
    const menu = await databaseService.fnbMenu.findOne({ _id: new ObjectId(id) })
    if (!menu) return null

    // Ensure inventory exists before accessing its properties
    const inventory = menu.inventory || { quantity: 0, unit: 'piece', minStock: 0, maxStock: 0 }

    return new FnbMenuModel(
      menu.name,
      menu.price,
      menu.description,
      menu.image,
      menu.category,
      {
        quantity: inventory.quantity,
        unit: inventory.unit,
        minStock: inventory.minStock,
        maxStock: inventory.maxStock
      },
      menu.createdBy,
      menu.updatedBy
    )
  }

  async getAllFnbMenu(): Promise<FnbMenuModel[]> {
    const menus = await databaseService.fnbMenu.find({}).toArray()
    return menus
  }

  async deleteFnbMenu(id: string): Promise<FnbMenu | null> {
    const menuToDelete = await this.getFnbMenuById(id)
    if (!menuToDelete) return null

    await databaseService.fnbMenu.deleteOne({ _id: new ObjectId(id) })
    return menuToDelete
  }

  async updateFnbMenu(id: string, menu: Partial<FnbMenu>): Promise<FnbMenu | null> {
    const menuToUpdate = await this.getFnbMenuById(id)
    if (!menuToUpdate) return null

    // Create update object with proper handling of inventory
    const { _id, ...updateData } = { ...menuToUpdate, ...menu }

    // Ensure inventory.lastUpdated is updated
    if (updateData.inventory) {
      updateData.inventory = {
        ...updateData.inventory,
        lastUpdated: new Date()
      }
    }

    // Set updatedAt to current date
    updateData.updatedAt = new Date()

    await databaseService.fnbMenu.updateOne({ _id: new ObjectId(id) }, { $set: updateData })

    // Return the complete updated menu with _id
    return { _id: new ObjectId(id), ...updateData }
  }
}

const fnbMenuService = new FnbMenuService()
export default fnbMenuService
