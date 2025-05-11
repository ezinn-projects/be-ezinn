import { ObjectId } from 'mongodb'

export interface FnbMenu {
  _id?: ObjectId
  name: string
  price: number
  description: string
  image: string
  category: string
  inventory: {
    quantity: number
    unit: string
    minStock: number
    maxStock: number
    lastUpdated: Date
  }
  createdAt: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string
}

export class FnbMenuModel {
  _id?: ObjectId
  name: string
  price: number
  description: string
  image: string
  category: string
  inventory: {
    quantity: number
    unit: string
    minStock: number
    maxStock: number
    lastUpdated: Date
  }
  createdAt: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string

  constructor(
    name: string,
    price: number,
    description: string,
    image: string,
    category: string,
    inventory: {
      quantity: number
      unit: string
      minStock: number
      maxStock: number
    },
    createdBy?: string,
    updatedBy?: string
  ) {
    this.name = name
    this.price = price
    this.description = description
    this.image = image
    this.category = category
    this.inventory = {
      ...inventory,
      lastUpdated: new Date()
    }
    this.createdAt = new Date()
    this.createdBy = createdBy || 'system'
    this.updatedAt = new Date()
    this.updatedBy = updatedBy || 'system'
  }
}
