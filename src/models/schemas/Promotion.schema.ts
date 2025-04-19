import { ObjectId } from 'mongodb'

export interface IPromotion {
  _id?: ObjectId
  name: string
  description?: string
  discountPercentage: number // percentage of discount (e.g., 50 means 50% off)
  startDate: Date // when the promotion starts
  endDate: Date // when the promotion ends
  isActive: boolean // whether the promotion is currently active
  appliesTo: 'sing' | 'all' | string[] // what the promotion applies to
  createdAt: Date
  updatedAt?: Date
}

/**
 * Promotion model
 */
export class Promotion {
  _id?: ObjectId
  name: string
  description?: string
  discountPercentage: number
  startDate: Date
  endDate: Date
  isActive: boolean
  appliesTo: 'sing' | 'all' | string[]
  createdAt: Date
  updatedAt?: Date

  /**
   * Create a new Promotion
   *
   * @param {string} name - Name of the promotion
   * @param {number} discountPercentage - Percentage discount (e.g., 50 for 50% off)
   * @param {Date} startDate - When the promotion starts
   * @param {Date} endDate - When the promotion ends
   * @param {boolean} isActive - Whether the promotion is active
   * @param {'sing' | 'all' | string[]} appliesTo - What the promotion applies to (karaoke service or all items)
   * @param {string} [description] - Optional description of the promotion
   */
  constructor(
    name: string,
    discountPercentage: number,
    startDate: Date,
    endDate: Date,
    isActive: boolean,
    appliesTo: 'sing' | 'all' | string[],
    description?: string
  ) {
    this.name = name
    this.description = description
    this.discountPercentage = discountPercentage
    this.startDate = startDate
    this.endDate = endDate
    this.isActive = isActive
    this.appliesTo = appliesTo
    this.createdAt = new Date()
  }
}
