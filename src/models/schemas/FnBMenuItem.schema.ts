import { ObjectId } from 'mongodb'

export interface Inventory {
  quantity: number
  minStock?: number
  maxStock?: number
  lastUpdated: Date
}

import { FnBCategory } from '~/constants/enum'

export interface FnBMenuItem {
  _id?: ObjectId
  name: string
  parentId: string | null // null nếu là sản phẩm cha, còn lại là id của sản phẩm cha
  hasVariant: boolean // true nếu là sản phẩm cha có variant, false nếu là variant hoặc sản phẩm đơn
  price: number
  image?: string // URL ảnh từ Cloudinary
  category: FnBCategory // snack hoặc drink
  inventory: Inventory
  createdAt: Date
  updatedAt: Date
}
