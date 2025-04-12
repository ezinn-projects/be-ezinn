import { ObjectId } from 'mongodb'

export interface FnbMenu {
  _id?: ObjectId
  name: string
  price: number
  description: string
  image: string
  category: string
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
    createdBy?: string,
    updatedBy?: string
  ) {
    this.name = name
    this.price = price
    this.description = description
    this.image = image
    this.category = category
    this.createdAt = new Date()
    this.createdBy = createdBy || 'system'
    this.updatedAt = new Date()
    this.updatedBy = updatedBy || 'system'
  }
}
