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
    return menu ? new FnbMenuModel(menu.name, menu.price, menu.description, menu.image, menu.category) : null
  }

  async getAllFnbMenu(): Promise<FnbMenuModel[]> {
    const menus = await databaseService.fnbMenu.find({}).toArray()
    return menus.map((menu) => new FnbMenuModel(menu.name, menu.price, menu.description, menu.image, menu.category))
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

    const updatedMenu = { ...menuToUpdate, ...menu }
    await databaseService.fnbMenu.updateOne({ _id: new ObjectId(id) }, { $set: updatedMenu })
    return updatedMenu
  }
}

const fnbMenuService = new FnbMenuService()
export default fnbMenuService
